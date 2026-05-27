export type PhotoEdits = {
  brightness: number;
  contrast: number;
  saturate: number;
  rotate: number;
};

export type StoredPhoto = {
  id: string;
  dataUrl: string;
  createdAt: string;
  title: string;
  memo: string;
  edits: PhotoEdits;
};

const STORAGE_KEY = "bunnecho-photos";
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT: StoredPhoto[] = [];

let isHydrated = false;
let cachedPhotos: StoredPhoto[] = [];

const defaultEdits: PhotoEdits = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  rotate: 0,
};

function canUseStorage() {
  return typeof window !== "undefined";
}

function sortByCreatedAtDesc(photos: StoredPhoto[]) {
  return [...photos].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function ensureHydrated() {
  if (!canUseStorage() || isHydrated) {
    return;
  }
  cachedPhotos = sortByCreatedAtDesc(readPhotos());
  isHydrated = true;
}

function readPhotos(): StoredPhoto[] {
  if (!canUseStorage()) {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as StoredPhoto[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

function writePhotos(photos: StoredPhoto[]) {
  if (!canUseStorage()) {
    return;
  }

  // localStorage 용량을 초과하면(QuotaExceededError) 오래된 사진부터 제거하며 재시도한다.
  // dataUrl이 매우 커서(특히 iOS/Safari) 5~10MB 한도를 쉽게 넘길 수 있다.
  let next = sortByCreatedAtDesc(photos);
  while (true) {
    try {
      cachedPhotos = next;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedPhotos));
      listeners.forEach((listener) => listener());
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : "";
      const isQuota =
        (error as { name?: string } | null)?.name === "QuotaExceededError" ||
        /quota/i.test(message);
      if (!isQuota || next.length === 0) {
        throw error;
      }

      // 가장 오래된(마지막) 사진 1장 제거 후 재시도
      next = next.slice(0, -1);
    }
  }
}

export function listPhotos() {
  ensureHydrated();
  return cachedPhotos;
}

export function getPhoto(id: string) {
  ensureHydrated();
  return cachedPhotos.find((photo) => photo.id === id) ?? null;
}

export function addPhoto(dataUrl: string) {
  const next: StoredPhoto = {
    id: crypto.randomUUID(),
    dataUrl,
    createdAt: new Date().toISOString(),
    title: "",
    memo: "",
    edits: { ...defaultEdits },
  };

  const photos = listPhotos();
  writePhotos([next, ...photos]);
  return next;
}

export function updatePhoto(
  id: string,
  patch: Partial<Omit<StoredPhoto, "id" | "createdAt" | "dataUrl">>,
) {
  const photos = listPhotos();
  const updated = photos.map((photo) => {
    if (photo.id !== id) {
      return photo;
    }

    return {
      ...photo,
      ...patch,
      edits: {
        ...photo.edits,
        ...(patch.edits ?? {}),
      },
    };
  });

  writePhotos(updated);
}

export function removePhoto(id: string) {
  const photos = listPhotos();
  writePhotos(photos.filter((photo) => photo.id !== id));
}

export function clearPhotos() {
  writePhotos([]);
}

export function subscribePhotos(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPhotosServerSnapshot() {
  return SERVER_SNAPSHOT;
}
