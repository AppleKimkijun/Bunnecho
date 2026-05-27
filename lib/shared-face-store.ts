export type SharedFaceItem = {
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
    const parsed = JSON.parse(raw) as SharedFaceItem[];
    return Array.isArray(parsed) ? parsed : [];
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
  const index = items.findIndex((item) => item.photoId === photoId);
  const nextItem: SharedFaceItem = {
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