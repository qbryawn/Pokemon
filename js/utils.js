export function normalizeText(value = "") {
  return String(value).trim().toLocaleLowerCase("de-DE").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function duplicateKey(card) {
  const number = normalizeText(card.number).replace(/\s+/g, "");
  const set = normalizeText(card.set).replace(/\s+/g, "");
  return number ? `${set}::${number}` : "";
}

export function getDuplicateInfo(cards) {
  const counts = new Map();
  cards.forEach((card) => {
    const key = duplicateKey(card);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  });
  const ids = new Set(cards.filter((card) => (counts.get(duplicateKey(card)) || 0) > 1).map((card) => card.id));
  const extraCount = [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  return { counts, ids, extraCount };
}

export function cardDisplayValue(card) {
  return card.isGraded ? Number(card.gradedValue || 0) : Number(card.ungradedValue || 0);
}

export function calculateStats(cards) {
  const duplicates = getDuplicateInfo(cards);
  return {
    total: cards.length,
    favorites: cards.filter((card) => card.favorite).length,
    graded: cards.filter((card) => card.isGraded).length,
    ungradedValue: cards.reduce((sum, card) => sum + Number(card.ungradedValue || 0), 0),
    gradedValue: cards.reduce((sum, card) => sum + (card.isGraded ? Number(card.gradedValue || 0) : 0), 0),
    duplicateIds: duplicates.ids,
    duplicates: duplicates.extraCount,
  };
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function createId() {
  return globalThis.crypto?.randomUUID?.() || `card-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
