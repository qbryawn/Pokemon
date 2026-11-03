import test from "node:test";
import assert from "node:assert/strict";
import { calculateStats, duplicateKey, escapeHtml, normalizeText } from "../js/utils.js";

test("normalizeText normalisiert deutsche Suche", () => {
  assert.equal(normalizeText("  PIKACHÚ  "), "pikachu");
});

test("duplicateKey kombiniert Set und Kartennummer", () => {
  assert.equal(duplicateKey({ set: " 151 ", number: " 199 / 165 " }), "151::199/165");
});

test("calculateStats erkennt Duplikate und summiert Werte", () => {
  const cards = [
    { id: "a", set: "151", number: "25/165", favorite: true, ungradedValue: 10 },
    { id: "b", set: "151", number: "25/165", isGraded: true, ungradedValue: 12, gradedValue: 50 },
    { id: "c", set: "Basis", number: "4/102", ungradedValue: 100 },
  ];
  const stats = calculateStats(cards);
  assert.equal(stats.total, 3);
  assert.equal(stats.favorites, 1);
  assert.equal(stats.graded, 1);
  assert.equal(stats.ungradedValue, 122);
  assert.equal(stats.gradedValue, 50);
  assert.equal(stats.duplicates, 1);
  assert.deepEqual([...stats.duplicateIds].sort(), ["a", "b"]);
});

test("escapeHtml entschärft Nutzereingaben", () => {
  assert.equal(escapeHtml('<img src=x onerror="x">'), "&lt;img src=x onerror=&quot;x&quot;&gt;");
});
