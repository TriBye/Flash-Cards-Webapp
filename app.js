const deckTitle = document.querySelector("#deck-title");
const cardCount = document.querySelector("#card-count");
const cardStage = document.querySelector("#card-stage");
const statusText = document.querySelector("#status");
const chapterFilter = document.querySelector("#chapter-filter");
const modeButtons = document.querySelectorAll("[data-mode]");
const openButton = document.querySelector("#open-button");
const exportButton = document.querySelector("#export-button");
const fileInput = document.querySelector("#file-input");
const previousButton = document.querySelector("#previous-card");
const nextButton = document.querySelector("#next-card");

const cardsKeys = ["flashcards", "clashcards", "cards"];
const localDeckKey = "staticFlashcardsDeck";
const allChaptersValue = "__all__";

let deckData = null;
let cardsKey = "clashcards";
let allCards = [];
let cards = [];
let currentIndex = 0;
let currentMode = "shuffled";
let currentChapter = allChaptersValue;
let fileHandle = null;

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

const getCardsKey = (data) => cardsKeys.find((key) => Array.isArray(data?.[key]));

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
  exportButton.disabled = !deckData;
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

const rebuildCards = ({ resetIndex = true } = {}) => {
  cards = createOrderedCards();
  if (resetIndex) {
    currentIndex = 0;
  } else if (currentIndex >= cards.length) {
    currentIndex = Math.max(cards.length - 1, 0);
  }
  renderCard();
};

const closeOpenMenus = (exceptMenu = null) => {
  document.querySelectorAll(".card-menu.is-open").forEach((menu) => {
    if (menu !== exceptMenu) {
      menu.classList.remove("is-open");
      const button = menu.querySelector(".menu-trigger");
      button?.setAttribute("aria-expanded", "false");
    }
  });
};

const applyDeck = (data) => {
  const foundKey = getCardsKey(data);
  if (!foundKey) {
    throw new Error("Deck JSON must include a flashcards, clashcards, or cards list.");
  }

  deckData = data;
  cardsKey = foundKey;
  allCards = deckData[cardsKey].map(normalizeCard);
  currentChapter = allChaptersValue;
  currentIndex = 0;
  deckTitle.textContent = fallback(cleanText(deckData.title), "Flashcards");
  populateChapterFilter();
  rebuildCards();
};

const saveDeckToBrowser = () => {
  if (deckData) {
    localStorage.setItem(localDeckKey, JSON.stringify(deckData));
  }
};

const writeDeckToFile = async () => {
  if (!fileHandle || !deckData) {
    saveDeckToBrowser();
    return false;
  }

  const writable = await fileHandle.createWritable();
  await writable.write(`${JSON.stringify(deckData, null, 2)}\n`);
  await writable.close();
  return true;
};

const exportDeck = () => {
  if (!deckData) {
    return;
  }

  const blob = new Blob([`${JSON.stringify(deckData, null, 2)}\n`], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "flashcards.json";
  link.click();
  URL.revokeObjectURL(link.href);
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

  const menu = document.createElement("div");
  menu.className = "card-menu";

  const menuButton = document.createElement("button");
  menuButton.className = "menu-trigger icon-button";
  menuButton.type = "button";
  menuButton.setAttribute("aria-label", `Open menu for ${fallback(card.keyword, "card")}`);
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.textContent = "\u22ef";

  const menuPanel = document.createElement("div");
  menuPanel.className = "menu-panel";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-action";
  deleteButton.textContent = "Delete";

  menuPanel.append(deleteButton);
  menu.append(menuButton, menuPanel);

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
    closeOpenMenus();
    flipButton.classList.toggle("is-flipped");
  });

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = menu.classList.toggle("is-open");
    closeOpenMenus(menu);
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  deleteButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    closeOpenMenus();

    const shouldDelete = window.confirm(`Delete "${fallback(card.keyword, "this card")}"?`);
    if (!shouldDelete) {
      return;
    }

    deleteButton.disabled = true;
    await deleteCard(card.id);
  });

  shell.append(meta, menu, flipButton);
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
    setStatus(allCards.length === 0 ? "No cards left in this deck." : "No cards match this chapter.");
    return;
  }

  setStatus("", false);
  cardStage.append(createCard(cards[currentIndex]));
};

const deleteCard = async (cardId) => {
  if (!deckData) {
    return;
  }

  const chapterWasAvailable = currentChapter === allChaptersValue
    || allCards.some((card) => chapterForCard(card) === currentChapter && String(card.id) !== String(cardId));

  deckData[cardsKey] = deckData[cardsKey].filter((card) => String(card.id) !== String(cardId));
  allCards = allCards.filter((card) => String(card.id) !== String(cardId));

  if (Number.isInteger(deckData.card_count)) {
    deckData.card_count = deckData[cardsKey].length;
  }

  populateChapterFilter();

  if (currentMode === "shuffled" && chapterWasAvailable) {
    cards = cards.filter((card) => String(card.id) !== String(cardId));
    if (currentIndex >= cards.length) {
      currentIndex = Math.max(cards.length - 1, 0);
    }
  } else {
    cards = createOrderedCards();
    if (currentIndex >= cards.length) {
      currentIndex = Math.max(cards.length - 1, 0);
    }
  }

  try {
    const savedToFile = await writeDeckToFile();
    setStatus(savedToFile ? "Saved." : "Saved in browser. Export JSON to write a file.", true);
    window.setTimeout(() => {
      if (cards.length > 0) {
        setStatus("", false);
      }
    }, 1800);
  } catch (error) {
    saveDeckToBrowser();
    setStatus("Saved in browser. Export JSON to write a file.", true);
  }

  renderCard();
};

const openDeckFile = async () => {
  if (!("showOpenFilePicker" in window)) {
    fileInput.click();
    return;
  }

  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    types: [
      {
        description: "JSON files",
        accept: {
          "application/json": [".json"],
        },
      },
    ],
  });

  const file = await handle.getFile();
  const data = JSON.parse(await file.text());
  fileHandle = handle;
  applyDeck(data);
  saveDeckToBrowser();
};

const loadDeckFromInput = async () => {
  const [file] = fileInput.files;
  if (!file) {
    return;
  }

  fileHandle = null;
  applyDeck(JSON.parse(await file.text()));
  saveDeckToBrowser();
  fileInput.value = "";
};

const loadBundledDeck = async () => {
  const savedDeck = localStorage.getItem(localDeckKey);
  if (savedDeck) {
    applyDeck(JSON.parse(savedDeck));
    return;
  }

  const response = await fetch("flashcards.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load bundled deck");
  }

  applyDeck(await response.json());
  saveDeckToBrowser();
};

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    closeOpenMenus();
    rebuildCards();
  });
});

chapterFilter.addEventListener("change", () => {
  currentChapter = chapterFilter.value;
  closeOpenMenus();
  rebuildCards();
});

openButton.addEventListener("click", async () => {
  try {
    await openDeckFile();
  } catch (error) {
    setStatus("Could not open JSON deck.");
  }
});

exportButton.addEventListener("click", exportDeck);
fileInput.addEventListener("change", () => {
  loadDeckFromInput().catch(() => setStatus("Could not open JSON deck."));
});

previousButton.addEventListener("click", () => {
  if (cards.length === 0) {
    return;
  }

  currentIndex = (currentIndex - 1 + cards.length) % cards.length;
  closeOpenMenus();
  renderCard();
});

nextButton.addEventListener("click", () => {
  if (cards.length === 0) {
    return;
  }

  currentIndex = (currentIndex + 1) % cards.length;
  closeOpenMenus();
  renderCard();
});

document.addEventListener("click", () => closeOpenMenus());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeOpenMenus();
  }

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
  setStatus("Could not load flashcards.json. Use Open JSON.");
  updateNavigation();
  updateModeButtons();
});
