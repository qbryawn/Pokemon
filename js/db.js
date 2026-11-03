const DB_NAME = "kartenarchiv-db";
const DB_VERSION = 1;
const STORE = "cards";

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        const store = database.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("number", "number");
        store.createIndex("favorite", "favorite");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, callback) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, mode);
  const store = transaction.objectStore(STORE);
  const result = await callback(store);
  await transactionDone(transaction);
  database.close();
  return result;
}

export async function getAllCards() {
  return withStore("readonly", (store) => requestToPromise(store.getAll()));
}

export async function saveCard(card) {
  return withStore("readwrite", (store) => requestToPromise(store.put(card)));
}

export async function deleteCard(id) {
  return withStore("readwrite", (store) => requestToPromise(store.delete(id)));
}

export async function replaceAllCards(cards) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, "readwrite");
  const store = transaction.objectStore(STORE);
  store.clear();
  cards.forEach((card) => store.put(card));
  await transactionDone(transaction);
  database.close();
}

export async function mergeCards(cards) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, "readwrite");
  const store = transaction.objectStore(STORE);
  cards.forEach((card) => store.put(card));
  await transactionDone(transaction);
  database.close();
}
