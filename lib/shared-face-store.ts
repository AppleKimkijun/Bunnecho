export type SharedFaceItem = {
  id: string;
  photoId: string;
  dataUrl: string;
  createdAt: string;
  frameIndices?: number[];
};

export type SharedFaceCutout = {
  dataUrl: string;
  frameIndices: number[];
};

const STORAGE_KEY = "bunnecho-shared-faces";
const REMOVED_STORAGE_KEY = "bunnecho-removed-shared-faces";
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

        const sharedFace: SharedFaceItem = {
          id,
          photoId: typed.photoId,
          dataUrl: typed.dataUrl,
          createdAt: typed.createdAt,
          frameIndices: Array.isArray(typed.frameIndices)
            ? typed.frameIndices.filter((index): index is number => Number.isSafeInteger(index) && index >= 0)
            : undefined,
        };
        return sharedFace;
      })
      .filter((item): item is SharedFaceItem => item !== null);
  } catch {
    return [];
  }
}

function readRemovedIds() {
  if (!canUseStorage()) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(REMOVED_STORAGE_KEY) ?? "[]") as unknown;
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [],
    );
  } catch {
    return new Set<string>();
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

export function wasPhotoShared(photoId: string) {
  return (
    readRaw().some((item) => item.photoId === photoId) ||
    [...readRemovedIds()].some((id) => id === photoId || id.startsWith(`${photoId}:`))
  );
}

export function upsertSharedFace(photoId: string, dataUrl: string) {
  if (readRemovedIds().has(photoId)) {
    return;
  }

  const items = readRaw();
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

export function upsertSharedFaces(photoId: string, cutouts: SharedFaceCutout[]) {
  const items = readRaw();
  const createdAt = new Date().toISOString();
  const removedIds = readRemovedIds();

  for (const id of removedIds) {
    if (id === photoId || id.startsWith(`${photoId}:`)) removedIds.delete(id);
  }
  if (canUseStorage()) {
    window.localStorage.setItem(REMOVED_STORAGE_KEY, JSON.stringify([...removedIds]));
  }

  // 같은 사진의 이전 공유(구 id 형식 포함)를 모두 교체
  const filtered = items.filter(
    (item) =>
      item.photoId !== photoId &&
      !item.id.startsWith(`${photoId}:`) &&
      !removedIds.has(item.id) &&
      !removedIds.has(item.photoId),
  );

  const nextItems = cutouts.flatMap(({ dataUrl, frameIndices }) => {
        const indices = [...new Set(frameIndices)].sort((a, b) => a - b);
        if (indices.length === 0) return [];
        const id = `${photoId}:${indices.join("+")}`;
        return [{ id, photoId, dataUrl, createdAt, frameIndices: indices }];
      });

  writeRaw([...filtered, ...nextItems]);
  return nextItems.length;
}

export function clearSharedFaces() {
  writeRaw([]);
}

export function removeSharedFace(id: string) {
  const items = readRaw();
  if (canUseStorage()) {
    const removedIds = readRemovedIds();
    removedIds.add(id);
    const item = items.find((entry) => entry.id === id);
    for (const index of item?.frameIndices ?? []) {
      removedIds.add(`${item?.photoId}:${index}`);
    }
    window.localStorage.setItem(REMOVED_STORAGE_KEY, JSON.stringify([...removedIds]));
  }

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
