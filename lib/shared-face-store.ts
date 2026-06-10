export type SharedFaceItem = {
  id: string;
  photoId: string;
  dataUrl: string;
  createdAt: string;
};

const STORAGE_KEY = "bunnecho-shared-faces";
const SYNC_EVENT = "bunnecho-shared-faces-sync";
const SERVER_SNAPSHOT: SharedFaceItem[] = [];

let isHydrated = false;
let cachedItems: SharedFaceItem[] = [];

function canUseStorage() {
  return typeof window !== "undefined";
}

function sortByCreatedAt(items: SharedFaceItem[]) {
  return [...items].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

function readRaw() {
  if (!canUseStorage()) {
    return [] as SharedFaceItem[];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const typed = item as Partial<SharedFaceItem>;
        const id =
          typeof typed.id === "string" && typed.id.length > 0
            ? typed.id
            : typeof typed.photoId === "string"
              ? typed.photoId
              : null;

        if (
          !id ||
          typeof typed.photoId !== "string" ||
          typeof typed.dataUrl !== "string" ||
          typeof typed.createdAt !== "string"
        ) {
          return null;
        }

        return {
          id,
          photoId: typed.photoId,
          dataUrl: typed.dataUrl,
          createdAt: typed.createdAt,
        } satisfies SharedFaceItem;
      })
      .filter((item): item is SharedFaceItem => item !== null);
  } catch {
    return [];
  }
}

function ensureHydrated() {
  if (!canUseStorage() || isHydrated) {
    return;
  }

  cachedItems = sortByCreatedAt(readRaw());
  isHydrated = true;
}

function writeRaw(items: SharedFaceItem[]) {
  if (!canUseStorage()) {
    return;
  }

  cachedItems = sortByCreatedAt(items);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedItems));
  window.dispatchEvent(new Event(SYNC_EVENT));
}

export function listSharedFaces() {
  ensureHydrated();
  return cachedItems;
}

export function upsertSharedFace(photoId: string, dataUrl: string) {
  const items = listSharedFaces();
  const index = items.findIndex((item) => item.id === photoId);
  const nextItem: SharedFaceItem = {
    id: photoId,
    photoId,
    dataUrl,
    createdAt: new Date().toISOString(),
  };

  if (index >= 0) {
    items[index] = nextItem;
    writeRaw(items);
    return;
  }

  writeRaw([...items, nextItem]);
}

export function upsertSharedFaces(photoId: string, dataUrls: string[]) {
  const items = listSharedFaces();
  const createdAt = new Date().toISOString();

  // 같은 사진의 이전 공유(구 id 형식 포함)를 모두 교체
  const filtered = items.filter(
    (item) =>
      item.photoId !== photoId && !item.id.startsWith(`${photoId}:`),
  );

  const nextItems = dataUrls.map((dataUrl, index) => ({
    id: `${photoId}:${index}`,
    photoId,
    dataUrl,
    createdAt,
  }));

  writeRaw([...filtered, ...nextItems]);
}

export function clearSharedFaces() {
  writeRaw([]);
}

export function removeSharedFace(id: string) {
  const items = listSharedFaces();
  writeRaw(items.filter((item) => item.id !== id));
}

export function subscribeSharedFaces(listener: () => void) {
  if (!canUseStorage()) {
    return () => {};
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }
    cachedItems = sortByCreatedAt(readRaw());
    isHydrated = true;
    listener();
  };

  const onSync = () => {
    cachedItems = sortByCreatedAt(readRaw());
    isHydrated = true;
    listener();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(SYNC_EVENT, onSync);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SYNC_EVENT, onSync);
  };
}

export function getSharedFacesServerSnapshot() {
  return SERVER_SNAPSHOT;
}
