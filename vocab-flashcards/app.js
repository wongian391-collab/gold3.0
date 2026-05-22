const STORAGE_KEY = "vocab-vault-cards-v1";
const DOMESTIC_LOG_KEY = "vocab-vault-domestic-log-v1";
const DOMESTIC_LOG_LIMIT = 500;
const DOMESTIC_API = "/api/domestic-store";

const state = {
  cards: loadCards(),
  domesticLog: loadDomesticLog(),
  activeView: "add",
  currentReviewId: null,
  lastSavedAt: null,
  domesticSync: {
    available: false,
    syncing: false,
    lastError: null,
  },
};

const els = {
  form: document.querySelector("#entry-form"),
  wordInput: document.querySelector("#word-input"),
  dateInput: document.querySelector("#date-input"),
  meaningInput: document.querySelector("#meaning-input"),
  exampleInput: document.querySelector("#example-input"),
  notesInput: document.querySelector("#notes-input"),
  tagsInput: document.querySelector("#tags-input"),
  todayList: document.querySelector("#today-list"),
  todayLabel: document.querySelector("#today-label"),
  todayCount: document.querySelector("#today-count"),
  dueCount: document.querySelector("#due-count"),
  totalCount: document.querySelector("#total-count"),
  streakCount: document.querySelector("#streak-count"),
  reviewStage: document.querySelector("#review-stage"),
  deckList: document.querySelector("#deck-list"),
  searchInput: document.querySelector("#search-input"),
  filterDate: document.querySelector("#filter-date"),
  clearFilter: document.querySelector("#clear-filter"),
  syncNowBtn: document.querySelector("#sync-now-btn"),
  exportBtn: document.querySelector("#export-btn"),
  exportLogBtn: document.querySelector("#export-log-btn"),
  importInput: document.querySelector("#import-input"),
  localSaveStatus: document.querySelector("#local-save-status"),
  wordTemplate: document.querySelector("#word-template"),
};

init();

function init() {
  els.dateInput.value = todayKey();
  els.todayLabel.textContent = formatDate(todayKey());

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });

  els.form.addEventListener("submit", addCard);
  els.searchInput.addEventListener("input", renderDeck);
  els.filterDate.addEventListener("input", renderDeck);
  els.clearFilter.addEventListener("click", clearFilters);
  if (els.syncNowBtn) els.syncNowBtn.addEventListener("click", pushLocalToDomesticStore);
  els.exportBtn.addEventListener("click", exportDeck);
  if (els.exportLogBtn) els.exportLogBtn.addEventListener("click", exportDomesticLog);
  els.importInput.addEventListener("change", importDeck);

  render();
  syncFromDomesticStore();
}

function loadCards() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadDomesticLog() {
  try {
    const raw = localStorage.getItem(DOMESTIC_LOG_KEY);
    const entries = raw ? JSON.parse(raw) : [];
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function saveCards(action = "autosave", details = {}) {
  const savedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cards));
  appendDomesticLog({
    action,
    savedAt,
    cardCount: state.cards.length,
    ...details,
  });
  state.lastSavedAt = savedAt;
  renderLocalSaveStatus();
  syncDomesticStore(action, details);
}

function appendDomesticLog(entry) {
  state.domesticLog.unshift({
    id: createId(),
    app: "Vocab Vault",
    ...entry,
  });
  state.domesticLog = state.domesticLog.slice(0, DOMESTIC_LOG_LIMIT);
  localStorage.setItem(DOMESTIC_LOG_KEY, JSON.stringify(state.domesticLog));
}

async function syncFromDomesticStore() {
  try {
    state.domesticSync.syncing = true;
    renderLocalSaveStatus();

    const response = await fetch(DOMESTIC_API, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    const serverCards = normalizeCardArray(payload.cards);
    const serverLog = normalizeLogArray(payload.log);
    const mergedCards = mergeCards(serverCards, state.cards);
    const mergedLog = mergeLogs(serverLog, state.domesticLog);
    const shouldPushLocalCache = mergedCards.length !== serverCards.length || mergedLog.length !== serverLog.length;

    state.cards = mergedCards;
    state.domesticLog = mergedLog;
    state.lastSavedAt = payload.savedAt || mergedLog[0]?.savedAt || state.lastSavedAt;
    state.domesticSync.available = true;
    state.domesticSync.lastError = null;
    persistLocalCache();
    render();

    if (shouldPushLocalCache) {
      await syncDomesticStore("startup-merge", { source: "local-cache" });
    }
  } catch (error) {
    state.domesticSync.available = false;
    state.domesticSync.lastError = error.message || "Domestic server unavailable";
    renderLocalSaveStatus();
  } finally {
    state.domesticSync.syncing = false;
    renderLocalSaveStatus();
  }
}

async function syncDomesticStore(action = "autosave", details = {}) {
  try {
    state.domesticSync.syncing = true;
    renderLocalSaveStatus();

    const response = await fetch(DOMESTIC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        details,
        savedAt: state.lastSavedAt || new Date().toISOString(),
        cards: state.cards,
        log: state.domesticLog,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    state.domesticSync.available = true;
    state.domesticSync.lastError = null;
    state.domesticLog = normalizeLogArray(payload.log).length ? normalizeLogArray(payload.log) : state.domesticLog;
    state.lastSavedAt = payload.savedAt || state.lastSavedAt;
    persistLocalCache();
  } catch (error) {
    state.domesticSync.available = false;
    state.domesticSync.lastError = error.message || "Domestic server unavailable";
  } finally {
    state.domesticSync.syncing = false;
    renderLocalSaveStatus();
  }
}

async function pushLocalToDomesticStore() {
  appendDomesticLog({
    action: "manual-sync",
    savedAt: new Date().toISOString(),
    cardCount: state.cards.length,
    source: "sync-now",
  });
  state.lastSavedAt = state.domesticLog[0].savedAt;
  persistLocalCache();
  await syncDomesticStore("manual-sync", { source: "sync-now" });
  await syncFromDomesticStore();
}

function persistLocalCache() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cards));
  localStorage.setItem(DOMESTIC_LOG_KEY, JSON.stringify(state.domesticLog));
}

function addCard(event) {
  event.preventDefault();

  const word = els.wordInput.value.trim();
  const meaning = els.meaningInput.value.trim();
  if (!word || !meaning) return;

  const card = {
    id: createId(),
    word,
    meaning,
    example: els.exampleInput.value.trim(),
    notes: els.notesInput.value.trim(),
    tags: parseTags(els.tagsInput.value),
    createdAt: new Date().toISOString(),
    date: els.dateInput.value || todayKey(),
    dueAt: todayKey(),
    interval: 0,
    ease: 2.5,
    reviews: 0,
    lastReviewed: null,
  };

  state.cards.unshift(card);
  saveCards("add", { cardId: card.id, word: card.word, date: card.date });
  els.form.reset();
  els.dateInput.value = todayKey();
  els.wordInput.focus();
  render();
}

function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function setView(view) {
  state.activeView = view;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.id === `view-${view}`);
  });

  if (view === "review") pickNextReviewCard();
  render();
}

function render() {
  renderStats();
  renderToday();
  renderDeck();
  renderLocalSaveStatus();
  if (state.activeView === "review") renderReview();
}

function renderStats() {
  const today = todayKey();
  const dueCards = getDueCards();

  els.todayCount.textContent = state.cards.filter((card) => card.date === today).length;
  els.dueCount.textContent = dueCards.length;
  els.totalCount.textContent = state.cards.length;
  els.streakCount.textContent = calculateStreak();
}

function renderLocalSaveStatus() {
  if (!els.localSaveStatus) return;

  const latest = state.lastSavedAt || state.domesticLog[0]?.savedAt;
  if (state.domesticSync.syncing) {
    els.localSaveStatus.textContent = "Domestic memory syncing...";
    return;
  }

  if (state.domesticSync.available && latest) {
    els.localSaveStatus.textContent = `Domestic memory saved ${formatTime(latest)}`;
    return;
  }

  if (!latest) {
    els.localSaveStatus.textContent = state.domesticSync.lastError ? "Browser-only memory" : "Domestic memory ready";
    return;
  }

  els.localSaveStatus.textContent = `Browser-only saved ${formatTime(latest)}`;
}

function renderToday() {
  const todayCards = state.cards.filter((card) => card.date === todayKey());
  renderCardList(els.todayList, todayCards);
}

function renderDeck() {
  const query = els.searchInput.value.trim().toLowerCase();
  const date = els.filterDate.value;

  const cards = state.cards.filter((card) => {
    const text = [card.word, card.meaning, card.example, card.notes, card.tags.join(" ")]
      .join(" ")
      .toLowerCase();
    return (!query || text.includes(query)) && (!date || card.date === date);
  });

  els.deckList.innerHTML = "";
  if (!cards.length) {
    els.deckList.append(emptyState("No cards found", "Add words or adjust your filters."));
    return;
  }

  groupByDate(cards).forEach(([dateKey, groupCards]) => {
    const section = document.createElement("section");
    section.className = "day-group";

    const heading = document.createElement("h2");
    heading.textContent = formatDate(dateKey);
    section.append(heading);

    const list = document.createElement("div");
    list.className = "word-list";
    renderCardList(list, groupCards);
    section.append(list);
    els.deckList.append(section);
  });
}

function renderCardList(container, cards) {
  container.innerHTML = "";

  if (!cards.length) {
    container.append(emptyState("Nothing here yet", "Add a word to start building today's deck."));
    return;
  }

  cards.forEach((card) => {
    const item = els.wordTemplate.content.firstElementChild.cloneNode(true);
    item.querySelector("h3").textContent = card.word;
    item.querySelector(".meaning").textContent = card.meaning;
    item.querySelector(".example").textContent = card.example ? `"${card.example}"` : "";
    item.querySelector(".meta").textContent = buildMeta(card);
    item.querySelector(".delete-btn").addEventListener("click", () => deleteCard(card.id));
    container.append(item);
  });
}

function buildMeta(card) {
  const chunks = [`Due ${formatDate(card.dueAt)}`, `${card.reviews} reviews`];
  if (card.notes) chunks.push(card.notes);
  if (card.tags.length) chunks.push(card.tags.map((tag) => `#${tag}`).join(" "));
  return chunks.join(" · ");
}

function deleteCard(id) {
  const removed = state.cards.find((card) => card.id === id);
  state.cards = state.cards.filter((card) => card.id !== id);
  if (state.currentReviewId === id) state.currentReviewId = null;
  saveCards("delete", { cardId: id, word: removed?.word || "" });
  render();
}

function getDueCards() {
  const today = todayKey();
  return state.cards
    .filter((card) => card.dueAt <= today)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.createdAt.localeCompare(b.createdAt));
}

function pickNextReviewCard() {
  const dueCards = getDueCards();
  state.currentReviewId = dueCards[0]?.id ?? null;
}

function renderReview() {
  const card = state.cards.find((item) => item.id === state.currentReviewId);
  if (!card) {
    els.reviewStage.innerHTML = "";
    els.reviewStage.append(emptyState("No cards due", "Add a new word or come back when your next review is ready."));
    return;
  }

  els.reviewStage.innerHTML = `
    <article class="flashcard" aria-live="polite">
      <div class="flashcard-inner">
        <span class="prompt">Remember this word</span>
        <strong class="word"></strong>
        <div class="answer">
          <p class="meaning"></p>
          <p class="example"></p>
          <p class="meta"></p>
        </div>
      </div>
      <div class="review-actions">
        <button class="primary-btn reveal-btn" type="button">Show answer</button>
        <div class="rating-row" hidden>
          <button class="rating-btn" data-rating="again" type="button">Again</button>
          <button class="rating-btn" data-rating="hard" type="button">Hard</button>
          <button class="rating-btn" data-rating="good" type="button">Good</button>
          <button class="rating-btn" data-rating="easy" type="button">Easy</button>
        </div>
      </div>
    </article>
  `;

  const flashcard = els.reviewStage.querySelector(".flashcard");
  flashcard.querySelector(".word").textContent = card.word;
  flashcard.querySelector(".meaning").textContent = card.meaning;
  flashcard.querySelector(".example").textContent = card.example ? `"${card.example}"` : "";
  flashcard.querySelector(".meta").textContent = buildMeta(card);

  flashcard.querySelector(".reveal-btn").addEventListener("click", () => {
    flashcard.classList.add("revealed");
    flashcard.querySelector(".reveal-btn").hidden = true;
    flashcard.querySelector(".rating-row").hidden = false;
  });

  flashcard.querySelectorAll(".rating-btn").forEach((button) => {
    button.addEventListener("click", () => reviewCard(card.id, button.dataset.rating));
  });
}

function reviewCard(id, rating) {
  const card = state.cards.find((item) => item.id === id);
  if (!card) return;

  const next = nextSchedule(card, rating);
  card.interval = next.interval;
  card.ease = next.ease;
  card.dueAt = addDays(todayKey(), next.interval);
  card.reviews += 1;
  card.lastReviewed = new Date().toISOString();

  saveCards("review", { cardId: card.id, word: card.word, rating, dueAt: card.dueAt });
  pickNextReviewCard();
  render();
}

function nextSchedule(card, rating) {
  const interval = Number(card.interval) || 0;
  const ease = Number(card.ease) || 2.5;

  if (rating === "again") {
    return { interval: 0, ease: Math.max(1.3, ease - 0.25) };
  }

  if (rating === "hard") {
    return { interval: Math.max(1, Math.round(interval * 1.2) || 1), ease: Math.max(1.3, ease - 0.15) };
  }

  if (rating === "easy") {
    return { interval: Math.max(4, Math.round((interval || 1) * (ease + 0.8))), ease: ease + 0.15 };
  }

  return { interval: Math.max(1, Math.round((interval || 1) * ease)), ease };
}

function clearFilters() {
  els.searchInput.value = "";
  els.filterDate.value = "";
  renderDeck();
}

function exportDeck() {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), cards: state.cards }, null, 2);
  downloadJson(payload, `vocab-vault-${todayKey()}.json`);
}

function exportDomesticLog() {
  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    storageKey: DOMESTIC_LOG_KEY,
    entries: state.domesticLog,
  }, null, 2);
  downloadJson(payload, `vocab-vault-domestic-log-${todayKey()}.json`);
}

function importDeck(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(reader.result);
      const cards = Array.isArray(payload) ? payload : payload.cards;
      if (!Array.isArray(cards)) throw new Error("Invalid deck");

      const byId = new Map(state.cards.map((card) => [card.id, card]));
      cards.forEach((card) => {
        if (card.word && card.meaning) {
          const normalized = normalizeImportedCard(card);
          byId.set(normalized.id, normalized);
        }
      });
      state.cards = Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      saveCards("import", { imported: cards.length, total: state.cards.length });
      render();
    } catch {
      alert("That file does not look like a Vocab Vault export.");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function normalizeImportedCard(card) {
  return {
    id: card.id || createId(),
    word: String(card.word || "").trim(),
    meaning: String(card.meaning || "").trim(),
    example: String(card.example || "").trim(),
    notes: String(card.notes || "").trim(),
    tags: Array.isArray(card.tags) ? card.tags : [],
    createdAt: card.createdAt || new Date().toISOString(),
    date: card.date || todayKey(),
    dueAt: card.dueAt || todayKey(),
    interval: Number(card.interval) || 0,
    ease: Number(card.ease) || 2.5,
    reviews: Number(card.reviews) || 0,
    lastReviewed: card.lastReviewed || null,
  };
}

function normalizeCardArray(cards) {
  if (!Array.isArray(cards)) return [];
  return cards
    .filter((card) => card && card.word && card.meaning)
    .map(normalizeImportedCard)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function normalizeLogArray(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => entry && entry.savedAt)
    .map((entry) => ({
      ...entry,
      id: entry.id || createId(),
      app: entry.app || "Vocab Vault",
    }))
    .slice(0, DOMESTIC_LOG_LIMIT);
}

function mergeCards(primaryCards, secondaryCards) {
  const byId = new Map();
  normalizeCardArray(secondaryCards).forEach((card) => byId.set(card.id, card));
  normalizeCardArray(primaryCards).forEach((card) => byId.set(card.id, card));
  return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function mergeLogs(primaryLog, secondaryLog) {
  const byId = new Map();
  normalizeLogArray(secondaryLog).forEach((entry) => byId.set(entry.id, entry));
  normalizeLogArray(primaryLog).forEach((entry) => byId.set(entry.id, entry));
  return Array.from(byId.values())
    .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))
    .slice(0, DOMESTIC_LOG_LIMIT);
}

function emptyState(title, text) {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.innerHTML = `<h2></h2><p></p>`;
  div.querySelector("h2").textContent = title;
  div.querySelector("p").textContent = text;
  return div;
}

function downloadJson(payload, filename) {
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function groupByDate(cards) {
  const groups = new Map();
  cards.forEach((card) => {
    if (!groups.has(card.date)) groups.set(card.date, []);
    groups.get(card.date).push(card);
  });
  return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

function calculateStreak() {
  const days = new Set(state.cards.map((card) => card.date));
  let streak = 0;
  let cursor = todayKey();

  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function todayKey() {
  const now = new Date();
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return toDateKey(local);
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `card-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function addDays(dateKey, days) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "locally";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
