const deckTitle = document.querySelector("#deck-title");
const cardCount = document.querySelector("#card-count");
const cardStage = document.querySelector("#card-stage");
const statusText = document.querySelector("#status");
const chapterFilter = document.querySelector("#chapter-filter");
const modeButtons = document.querySelectorAll("[data-mode]");
const previousButton = document.querySelector("#previous-card");
const nextButton = document.querySelector("#next-card");

const allChaptersValue = "__all__";

let allCards = [];
let cards = [];
let currentIndex = 0;
let currentMode = "shuffled";
let currentChapter = allChaptersValue;

const fallback = (value, defaultValue = "Untitled") => {
  if (typeof value !== "string" || value.trim() === "") {
    return defaultValue;
  }
  return value;
};

const cleanText = (value) => {
  if (typeof value !== "string" || !value.includes("\u00e2")) {
    return value;
  }

  const replacements = {
    "\u00e2\u20ac\u201d": "\u2014",
    "\u00e2\u20ac\u201c": "\u2013",
    "\u00e2\u20ac\u02dc": "\u2018",
    "\u00e2\u20ac\u2122": "\u2019",
    "\u00e2\u20ac\u0153": "\u201c",
    "\u00e2\u20ac\u009d": "\u201d",
  };

  let cleaned = value;
  for (const [broken, fixed] of Object.entries(replacements)) {
    cleaned = cleaned.replaceAll(broken, fixed);
  }
  return cleaned;
};

const setStatus = (message, visible = true) => {
  statusText.textContent = message;
  statusText.hidden = !visible;
};

const normalizeCard = (card) => Object.fromEntries(
  Object.entries(card).map(([key, value]) => [key, cleanText(value)]),
);

const chapterForCard = (card) => fallback(card.chapter, "No chapter");

const getFilteredCards = () => {
  if (currentChapter === allChaptersValue) {
    return [...allCards];
  }

  return allCards.filter((card) => chapterForCard(card) === currentChapter);
};

const shuffleList = (list) => list
  .map((card) => ({ card, sort: Math.random() }))
  .sort((a, b) => a.sort - b.sort)
  .map(({ card }) => card);

const createOrderedCards = () => {
  const filteredCards = getFilteredCards();
  return currentMode === "shuffled" ? shuffleList(filteredCards) : filteredCards;
};

const updateCount = () => {
  cardCount.textContent = cards.length === 0 ? "0 cards" : `${currentIndex + 1} / ${cards.length}`;
};

const updateNavigation = () => {
  const hasCards = cards.length > 0;
  previousButton.disabled = !hasCards;
  nextButton.disabled = !hasCards;
};

const updateModeButtons = () => {
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === currentMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
};

const populateChapterFilter = () => {
  const chapters = [];
  allCards.forEach((card) => {
    const chapter = chapterForCard(card);
    if (!chapters.includes(chapter)) {
      chapters.push(chapter);
    }
  });

  if (currentChapter !== allChaptersValue && !chapters.includes(currentChapter)) {
    currentChapter = allChaptersValue;
  }

  const allOption = document.createElement("option");
  allOption.value = allChaptersValue;
  allOption.textContent = "All chapters";
  chapterFilter.replaceChildren(allOption);

  chapters.forEach((chapter) => {
    const option = document.createElement("option");
    option.value = chapter;
    option.textContent = chapter;
    chapterFilter.append(option);
  });

  chapterFilter.value = currentChapter;
};

const rebuildCards = () => {
  cards = createOrderedCards();
  currentIndex = 0;
  renderCard();
};

const applyDeck = (data) => {
  if (!Array.isArray(data?.flashcards)) {
    throw new Error("Deck JSON must include a flashcards list.");
  }

  allCards = data.flashcards.map(normalizeCard);
  currentChapter = allChaptersValue;
  currentIndex = 0;
  deckTitle.textContent = fallback(cleanText(data.title), "Flashcards");
  populateChapterFilter();
  rebuildCards();
};

const createCard = (card) => {
  const shell = document.createElement("article");
  shell.className = "flashcard-shell";
  shell.dataset.cardId = card.id;

  const meta = document.createElement("div");
  meta.className = "card-meta";

  const chapter = document.createElement("span");
  chapter.textContent = chapterForCard(card);

  const group = document.createElement("span");
  group.textContent = fallback(card.concept_group, "No concept group");

  meta.append(chapter, group);

  const flipButton = document.createElement("button");
  flipButton.className = "flashcard";
  flipButton.type = "button";
  flipButton.setAttribute("aria-label", `Flip card: ${fallback(card.keyword, "keyword")}`);

  const inner = document.createElement("span");
  inner.className = "flashcard-inner";

  const front = document.createElement("span");
  front.className = "face face-front";

  const keywordLabel = document.createElement("span");
  keywordLabel.className = "face-label";
  keywordLabel.textContent = "Keyword";

  const keyword = document.createElement("strong");
  keyword.className = "keyword";
  keyword.textContent = fallback(card.keyword, "Missing keyword");

  const prompt = document.createElement("span");
  prompt.className = "prompt";
  prompt.textContent = fallback(card.front, "Click to reveal the answer");

  front.append(keywordLabel, keyword, prompt);

  const back = document.createElement("span");
  back.className = "face face-back";

  const answerLabel = document.createElement("span");
  answerLabel.className = "face-label";
  answerLabel.textContent = "Definition";

  const answer = document.createElement("span");
  answer.className = "answer";
  answer.textContent = fallback(card.back, "No answer available");

  back.append(answerLabel, answer);
  inner.append(front, back);
  flipButton.append(inner);

  flipButton.addEventListener("click", () => {
    flipButton.classList.toggle("is-flipped");
  });

  shell.append(meta, flipButton);
  return shell;
};

const renderCard = () => {
  cardStage.replaceChildren();

  if (currentIndex >= cards.length) {
    currentIndex = Math.max(cards.length - 1, 0);
  }

  updateCount();
  updateNavigation();
  updateModeButtons();

  if (cards.length === 0) {
    setStatus(allCards.length === 0 ? "No cards in this deck." : "No cards match this chapter.");
    return;
  }

  setStatus("", false);
  cardStage.append(createCard(cards[currentIndex]));
};

const loadBundledDeck = async () => {
  const response = await fetch("flashcards.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load bundled deck");
  }

  applyDeck(await response.json());
};

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    rebuildCards();
  });
});

chapterFilter.addEventListener("change", () => {
  currentChapter = chapterFilter.value;
  rebuildCards();
});

previousButton.addEventListener("click", () => {
  if (cards.length === 0) {
    return;
  }

  currentIndex = (currentIndex - 1 + cards.length) % cards.length;
  renderCard();
});

nextButton.addEventListener("click", () => {
  if (cards.length === 0) {
    return;
  }

  currentIndex = (currentIndex + 1) % cards.length;
  renderCard();
});

document.addEventListener("keydown", (event) => {
  if (event.target.closest("input, select, textarea")) {
    return;
  }

  if (event.key === "ArrowLeft") {
    previousButton.click();
  }

  if (event.key === "ArrowRight") {
    nextButton.click();
  }
});

loadBundledDeck().catch(() => {
  setStatus("Could not load flashcards.json.");
  updateNavigation();
  updateModeButtons();
});
