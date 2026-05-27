const DB_NAME = "bunnecho";
const DB_VERSION = 1;
const STORE_NAME = "raw_photos";
const LEGACY_STORAGE_KEY = "bunnecho-raw-photos";

function canUseIndexedDb() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error("IndexedDB를 사용할 수 없습니다."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("DB 열기 실패"));
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openDb();
  return await new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("DB 요청 실패"));
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
    tx.onerror = () => db.close();
  });
}

function dataUrlToBlob(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    throw new Error("dataUrl 형식이 올바르지 않습니다.");
  }
  const header = dataUrl.slice(0, commaIndex);
  const base64 = dataUrl.slice(commaIndex + 1);
  const match = /data:([^;]+);base64/i.exec(header);
  const mime = match?.[1] ?? "application/octet-stream";

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Blob 변환 실패"));
    reader.readAsDataURL(blob);
  });
}

function clearLegacyLocalStorage() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function upsertRawPhoto(photoId: string, dataUrl: string) {
  clearLegacyLocalStorage();
  const blob = dataUrlToBlob(dataUrl);
  await runTransaction("readwrite", (store) => store.put(blob, photoId));
}

export async function getRawPhoto(photoId: string) {
  clearLegacyLocalStorage();
  try {
    const blob = await runTransaction<Blob | undefined>("readonly", (store) =>
      store.get(photoId),
    );
    if (!blob) {
      return null;
    }
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

export async function clearRawPhotos() {
  clearLegacyLocalStorage();
  await runTransaction("readwrite", (store) => store.clear());
}

