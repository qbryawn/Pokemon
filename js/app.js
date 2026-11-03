import { deleteCard, getAllCards, mergeCards, saveCard } from "./db.js";
import { blobToDataUrl, cropCardImage, dataUrlToBlob } from "./cropper.js";
import { calculateStats, cardDisplayValue, createId, duplicateKey, escapeHtml, normalizeText } from "./utils.js";

document.documentElement.dataset.appReady = "loading";

const elements = Object.fromEntries(
  [
    "addCardButton", "mobileAddButton", "emptyAddButton", "cardModal", "cardForm", "modalTitle", "cardId",
    "imageInput", "imageDropzone", "imagePreview", "uploadPrompt", "imageProcessing", "replaceImage",
    "cardName", "cardNumber", "cardSet", "cardLanguage", "ungradedValue", "purchasePrice", "condition",
    "isGraded", "gradingFields", "gradingCompany", "grade", "gradedValue", "certificateNumber", "notes",
    "favorite", "deleteCardButton", "searchInput", "sortSelect", "cardsContainer", "emptyState", "pageTitle",
    "pageEyebrow", "totalCards", "totalUngraded", "totalGraded", "totalDuplicates", "navAllCount",
    "navFavoriteCount", "navDuplicateCount", "navGradedCount", "openBackup", "mobileBackup", "backupModal",
    "exportBackup", "importBackup", "backupInput", "confirmDialog", "confirmTitle", "confirmText", "confirmCancel",
    "confirmOkay", "toast",
  ].map((id) => [id, document.getElementById(id)]),
);

const state = {
  cards: [],
  filter: "all",
  query: "",
  sort: "newest",
  view: localStorage.getItem("kartenarchiv-view") || "grid",
  currentImageBlob: null,
  previewUrl: null,
  renderedUrls: [],
  confirmAction: null,
};

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

function showDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
  else {
    dialog.setAttribute("open", "");
    document.body.classList.add("dialog-open");
  }
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  if (!document.querySelector("dialog[open]")) document.body.classList.remove("dialog-open");
}
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function revokePreview() {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = null;
}

function updateImagePreview(blob) {
  revokePreview();
  state.currentImageBlob = blob || null;
  if (blob) {
    state.previewUrl = URL.createObjectURL(blob);
    elements.imagePreview.src = state.previewUrl;
    elements.imagePreview.hidden = false;
    elements.uploadPrompt.hidden = true;
    elements.replaceImage.hidden = false;
  } else {
    elements.imagePreview.removeAttribute("src");
    elements.imagePreview.hidden = true;
    elements.uploadPrompt.hidden = false;
    elements.replaceImage.hidden = true;
  }
}

function resetForm() {
  elements.cardForm.reset();
  elements.cardId.value = "";
  elements.cardLanguage.value = "Deutsch";
  elements.condition.value = "Near Mint";
  elements.gradingFields.hidden = true;
  elements.deleteCardButton.hidden = true;
  elements.modalTitle.textContent = "Karte hinzufügen";
  updateImagePreview(null);
}

function fillForm(card) {
  resetForm();
  elements.cardId.value = card.id;
  elements.cardName.value = card.name || "";
  elements.cardNumber.value = card.number || "";
  elements.cardSet.value = card.set || "";
  elements.cardLanguage.value = card.language || "Deutsch";
  elements.ungradedValue.value = card.ungradedValue || "";
  elements.purchasePrice.value = card.purchasePrice || "";
  elements.condition.value = card.condition || "Near Mint";
  elements.isGraded.checked = Boolean(card.isGraded);
  elements.gradingFields.hidden = !card.isGraded;
  elements.gradingCompany.value = card.gradingCompany || "PSA";
  elements.grade.value = card.grade || "";
  elements.gradedValue.value = card.gradedValue || "";
  elements.certificateNumber.value = card.certificateNumber || "";
  elements.notes.value = card.notes || "";
  elements.favorite.checked = Boolean(card.favorite);
  elements.modalTitle.textContent = "Karte bearbeiten";
  elements.deleteCardButton.hidden = false;
  updateImagePreview(card.imageBlob || null);
}

function openCardModal(card = null) {
  if (card) fillForm(card);
  else resetForm();
  showDialog(elements.cardModal);
  setTimeout(() => (card ? elements.cardName : elements.imageDropzone).focus(), 80);
}

function closeCardModal() {
  closeDialog(elements.cardModal);
  revokePreview();
}

function displayFilterName(filter) {
  return { all: "Alle Karten", favorites: "Favoriten", duplicates: "Duplikate", graded: "Gegradete Karten" }[filter];
}

function filteredCards() {
  const stats = calculateStats(state.cards);
  const query = normalizeText(state.query);
  let cards = state.cards.filter((card) => {
    if (state.filter === "favorites" && !card.favorite) return false;
    if (state.filter === "duplicates" && !stats.duplicateIds.has(card.id)) return false;
    if (state.filter === "graded" && !card.isGraded) return false;
    if (!query) return true;
    return normalizeText([card.name, card.number, card.set, card.language, card.condition, card.notes].join(" ")).includes(query);
  });

  cards = [...cards].sort((a, b) => {
    if (state.sort === "name") return (a.name || "").localeCompare(b.name || "", "de", { sensitivity: "base" });
    if (state.sort === "number") return (a.number || "").localeCompare(b.number || "", "de", { numeric: true });
    if (state.sort === "value-desc") return cardDisplayValue(b) - cardDisplayValue(a);
    return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  });
  return cards;
}

function placeholderMarkup() {
  return `<div class="card-placeholder"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M4 12h4M16 12h4"/></svg></div>`;
}

function renderCard(card, duplicateCount) {
  let imageMarkup = placeholderMarkup();
  if (card.imageBlob instanceof Blob) {
    const url = URL.createObjectURL(card.imageBlob);
    state.renderedUrls.push(url);
    imageMarkup = `<img src="${url}" alt="${escapeHtml(card.name || "Kartenbild")}" />`;
  }
  const value = cardDisplayValue(card);
  const grade = card.isGraded ? `${escapeHtml(card.gradingCompany || "Grading")} ${escapeHtml(card.grade || "")}` : "";
  return `
    <article class="card-tile" data-id="${escapeHtml(card.id)}">
      <div class="card-image-wrap" data-edit-card>
        ${imageMarkup}
        <button class="favorite-button ${card.favorite ? "active" : ""}" data-favorite-card type="button" aria-label="${card.favorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 17.03l-5.5 2.89 1.05-6.12L3.1 9.47l6.15-.9Z"/></svg>
        </button>
        ${duplicateCount > 1 ? `<span class="duplicate-badge">${duplicateCount}× VORHANDEN</span>` : ""}
        ${card.isGraded ? `<span class="grade-badge">${grade}</span>` : ""}
      </div>
      <div class="card-info" data-edit-card>
        <div>
          <div class="card-title-row"><h3>${escapeHtml(card.name || "Unbenannte Karte")}</h3><span class="card-number">#${escapeHtml(card.number)}</span></div>
          <p class="card-set">${escapeHtml(card.set || card.language || "Kein Set angegeben")}</p>
        </div>
        <div class="card-value-row"><div><span>${card.isGraded ? "Graded Wert" : "Ungraded Wert"}</span><strong>${currency.format(value)}</strong></div><em class="condition-pill">${escapeHtml(card.condition || "–")}</em></div>
      </div>
    </article>`;
}

function render() {
  state.renderedUrls.forEach((url) => URL.revokeObjectURL(url));
  state.renderedUrls = [];
  const stats = calculateStats(state.cards);
  const cards = filteredCards();
  const duplicateCounts = new Map();
  state.cards.forEach((card) => {
    const key = duplicateKey(card);
    if (key) duplicateCounts.set(key, (duplicateCounts.get(key) || 0) + 1);
  });

  elements.totalCards.textContent = stats.total;
  elements.totalUngraded.textContent = currency.format(stats.ungradedValue);
  elements.totalGraded.textContent = currency.format(stats.gradedValue);
  elements.totalDuplicates.textContent = stats.duplicates;
  elements.navAllCount.textContent = stats.total;
  elements.navFavoriteCount.textContent = stats.favorites;
  elements.navDuplicateCount.textContent = stats.duplicates;
  elements.navGradedCount.textContent = stats.graded;
  elements.pageTitle.textContent = displayFilterName(state.filter);
  elements.pageEyebrow.textContent = state.query ? `${cards.length} TREFFER` : "DEINE SAMMLUNG";

  document.querySelectorAll("[data-filter]").forEach((button) => button.classList.toggle("active", button.dataset.filter === state.filter));
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  elements.cardsContainer.classList.toggle("list-view", state.view === "list");

  const trueEmpty = state.cards.length === 0;
  elements.emptyState.hidden = !trueEmpty;
  elements.cardsContainer.hidden = trueEmpty;
  if (!trueEmpty && cards.length === 0) {
    elements.cardsContainer.innerHTML = `<div class="empty-state" style="grid-column:1/-1;margin:55px auto"><h2>Keine Karten gefunden</h2><p>Versuche einen anderen Suchbegriff oder Filter.</p></div>`;
  } else {
    elements.cardsContainer.innerHTML = cards.map((card) => renderCard(card, duplicateCounts.get(duplicateKey(card)) || 1)).join("");
  }
}

async function processImage(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return showToast("Bitte wähle eine Bilddatei aus.");
  if (file.size > 25 * 1024 * 1024) return showToast("Das Bild ist größer als 25 MB.");
  elements.imageProcessing.hidden = false;
  elements.uploadPrompt.hidden = true;
  elements.imagePreview.hidden = true;
  try {
    const cropped = await cropCardImage(file);
    updateImagePreview(cropped);
    showToast("Bild automatisch zugeschnitten.");
  } catch (error) {
    console.error(error);
    updateImagePreview(null);
    showToast("Das Bild konnte nicht verarbeitet werden. Bitte nutze JPG oder PNG.");
  } finally {
    elements.imageProcessing.hidden = true;
    if (!state.currentImageBlob) elements.uploadPrompt.hidden = false;
  }
}

function formCard(existing) {
  const now = new Date().toISOString();
  return {
    id: existing?.id || createId(),
    name: elements.cardName.value.trim(),
    number: elements.cardNumber.value.trim(),
    set: elements.cardSet.value.trim(),
    language: elements.cardLanguage.value,
    ungradedValue: Number(elements.ungradedValue.value || 0),
    purchasePrice: Number(elements.purchasePrice.value || 0),
    condition: elements.condition.value,
    isGraded: elements.isGraded.checked,
    gradingCompany: elements.isGraded.checked ? elements.gradingCompany.value : "",
    grade: elements.isGraded.checked ? Number(elements.grade.value || 0) : 0,
    gradedValue: elements.isGraded.checked ? Number(elements.gradedValue.value || 0) : 0,
    certificateNumber: elements.isGraded.checked ? elements.certificateNumber.value.trim() : "",
    notes: elements.notes.value.trim(),
    favorite: elements.favorite.checked,
    imageBlob: state.currentImageBlob || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function askConfirmation({ title, text, okay = "Bestätigen", danger = true, action }) {
  elements.confirmTitle.textContent = title;
  elements.confirmText.textContent = text;
  elements.confirmOkay.textContent = okay;
  elements.confirmOkay.className = danger ? "danger-button" : "primary-button";
  state.confirmAction = action;
  showDialog(elements.confirmDialog);
}

async function toggleFavorite(id) {
  const card = state.cards.find((item) => item.id === id);
  if (!card) return;
  card.favorite = !card.favorite;
  card.updatedAt = new Date().toISOString();
  await saveCard(card);
  render();
}

async function exportCollection() {
  if (!state.cards.length) return showToast("Noch keine Karten zum Exportieren vorhanden.");
  elements.exportBackup.disabled = true;
  try {
    const cards = await Promise.all(state.cards.map(async ({ imageBlob, ...card }) => ({
      ...card,
      imageDataUrl: await blobToDataUrl(imageBlob),
    })));
    const backup = { app: "Kartenarchiv", version: 1, exportedAt: new Date().toISOString(), cards };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kartenarchiv-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Backup wurde exportiert.");
  } finally {
    elements.exportBackup.disabled = false;
  }
}

async function readBackup(file) {
  try {
    const backup = JSON.parse(await file.text());
    if (backup.app !== "Kartenarchiv" || !Array.isArray(backup.cards)) throw new Error("invalid");
    const cards = await Promise.all(backup.cards.map(async ({ imageDataUrl, ...card }) => ({
      ...card,
      id: card.id || createId(),
      imageBlob: await dataUrlToBlob(imageDataUrl),
      updatedAt: card.updatedAt || new Date().toISOString(),
      createdAt: card.createdAt || new Date().toISOString(),
    })));
    askConfirmation({
      title: `${cards.length} Karten importieren?`,
      text: "Die Karten aus dem Backup werden ergänzt. Karten mit gleicher interner ID werden aktualisiert.",
      okay: "Importieren",
      danger: false,
      action: async () => {
        await mergeCards(cards);
        state.cards = await getAllCards();
        closeDialog(elements.backupModal);
        render();
        showToast("Backup erfolgreich importiert.");
      },
    });
  } catch (error) {
    console.error(error);
    showToast("Dieses Backup ist ungültig oder beschädigt.");
  } finally {
    elements.backupInput.value = "";
  }
}

function bindEvents() {
  [elements.addCardButton, elements.mobileAddButton, elements.emptyAddButton].forEach((button) => button.addEventListener("click", () => openCardModal()));
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeCardModal));
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    render();
  }));
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
    state.view = button.dataset.view;
    localStorage.setItem("kartenarchiv-view", state.view);
    render();
  }));

  elements.searchInput.addEventListener("input", () => { state.query = elements.searchInput.value; render(); });
  elements.sortSelect.addEventListener("change", () => { state.sort = elements.sortSelect.value; render(); });
  elements.isGraded.addEventListener("change", () => { elements.gradingFields.hidden = !elements.isGraded.checked; });
  elements.imageDropzone.addEventListener("click", () => elements.imageInput.click());
  elements.replaceImage.addEventListener("click", () => elements.imageInput.click());
  elements.imageInput.addEventListener("change", () => processImage(elements.imageInput.files[0]));
  elements.imageDropzone.addEventListener("dragover", (event) => { event.preventDefault(); elements.imageDropzone.style.borderColor = "#5a5ce2"; });
  elements.imageDropzone.addEventListener("dragleave", () => { elements.imageDropzone.style.borderColor = ""; });
  elements.imageDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.imageDropzone.style.borderColor = "";
    processImage(event.dataTransfer.files[0]);
  });

  elements.cardForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!elements.cardForm.reportValidity()) return;
    const existing = state.cards.find((card) => card.id === elements.cardId.value);
    const card = formCard(existing);
    await saveCard(card);
    const index = state.cards.findIndex((item) => item.id === card.id);
    if (index >= 0) state.cards[index] = card;
    else state.cards.push(card);
    closeCardModal();
    render();
    showToast(existing ? "Änderungen gespeichert." : "Karte zur Sammlung hinzugefügt.");
  });

  elements.deleteCardButton.addEventListener("click", () => {
    const id = elements.cardId.value;
    askConfirmation({
      title: "Karte löschen?",
      text: "Die Karte und ihr Bild werden dauerhaft von diesem Gerät entfernt.",
      okay: "Löschen",
      action: async () => {
        await deleteCard(id);
        state.cards = state.cards.filter((card) => card.id !== id);
        closeCardModal();
        render();
        showToast("Karte gelöscht.");
      },
    });
  });

  elements.cardsContainer.addEventListener("click", (event) => {
    const tile = event.target.closest("[data-id]");
    if (!tile) return;
    if (event.target.closest("[data-favorite-card]")) toggleFavorite(tile.dataset.id);
    else if (event.target.closest("[data-edit-card]")) openCardModal(state.cards.find((card) => card.id === tile.dataset.id));
  });

  [elements.openBackup, elements.mobileBackup].forEach((button) => button.addEventListener("click", () => showDialog(elements.backupModal)));
  document.querySelectorAll("[data-close-backup]").forEach((button) => button.addEventListener("click", () => closeDialog(elements.backupModal)));
  elements.exportBackup.addEventListener("click", exportCollection);
  elements.importBackup.addEventListener("click", () => elements.backupInput.click());
  elements.backupInput.addEventListener("change", () => elements.backupInput.files[0] && readBackup(elements.backupInput.files[0]));

  elements.confirmCancel.addEventListener("click", () => { state.confirmAction = null; closeDialog(elements.confirmDialog); });
  elements.confirmOkay.addEventListener("click", async () => {
    const action = state.confirmAction;
    state.confirmAction = null;
    closeDialog(elements.confirmDialog);
    if (action) await action();
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      elements.searchInput.focus();
    }
    if (event.key === "Escape") {
      const openDialog = document.querySelector("dialog[open]");
      if (openDialog && typeof openDialog.close !== "function") closeDialog(openDialog);
    }
  });
}

async function init() {
  bindEvents();
  document.documentElement.dataset.appReady = "true";
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  try {
    state.cards = await getAllCards();
    render();
  } catch (error) {
    console.error(error);
    showToast("Lokaler Speicher ist nicht verfügbar. Bitte erlaube Browser-Speicher.");
  }
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => console.warn("PWA-Registrierung fehlgeschlagen", error));
  }
}

init();
