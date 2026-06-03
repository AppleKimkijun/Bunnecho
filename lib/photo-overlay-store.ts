export type StoredParticleOverlay = {
  xRatio: number;
  yRatio: number;
  sizeRatio: number;
  rotationDeg: number;
  opacity: number;
  color: string;
  imageSrc: string;
};

export type StoredFrameOverlay = {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
};

export type StoredPhotoOverlaySnapshot = {
  photoId: string;
  createdAt: string;
  particles: StoredParticleOverlay[];
  frames: StoredFrameOverlay[];
};

const STORAGE_KEY = "bunnecho-photo-overlays";

function canUseStorage() {
  return typeof window !== "undefined";
}

function readRaw(): StoredPhotoOverlaySnapshot[] {
  if (!canUseStorage()) {
    return [];
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

        const typed = item as Partial<StoredPhotoOverlaySnapshot>;
        if (
          typeof typed.photoId !== "string" ||
          typeof typed.createdAt !== "string" ||
          !Array.isArray(typed.particles)
        ) {
          return null;
        }

        const framesSource = Array.isArray(typed.frames) ? typed.frames : [];
        const frames = framesSource
          .map((frame) => {
            if (!frame || typeof frame !== "object") {
              return null;
            }

            const f = frame as Partial<StoredFrameOverlay>;
            if (
              typeof f.xRatio !== "number" ||
              typeof f.yRatio !== "number" ||
              typeof f.widthRatio !== "number" ||
              typeof f.heightRatio !== "number"
            ) {
              return null;
            }

            return {
              xRatio: f.xRatio,
              yRatio: f.yRatio,
              widthRatio: f.widthRatio,
              heightRatio: f.heightRatio,
            } satisfies StoredFrameOverlay;
          })
          .filter((frame): frame is StoredFrameOverlay => frame !== null);

        const particles = typed.particles
          .map((particle) => {
            if (!particle || typeof particle !== "object") {
              return null;
            }

            const p = particle as Partial<StoredParticleOverlay>;
            if (
              typeof p.xRatio !== "number" ||
              typeof p.yRatio !== "number" ||
              typeof p.sizeRatio !== "number" ||
              typeof p.rotationDeg !== "number" ||
              typeof p.opacity !== "number" ||
              typeof p.color !== "string" ||
              typeof p.imageSrc !== "string"
            ) {
              return null;
            }

            return {
              xRatio: p.xRatio,
              yRatio: p.yRatio,
              sizeRatio: p.sizeRatio,
              rotationDeg: p.rotationDeg,
              opacity: p.opacity,
              color: p.color,
              imageSrc: p.imageSrc,
            } satisfies StoredParticleOverlay;
          })
          .filter((particle): particle is StoredParticleOverlay => particle !== null);

        return {
          photoId: typed.photoId,
          createdAt: typed.createdAt,
          particles,
          frames,
        } satisfies StoredPhotoOverlaySnapshot;
      })
      .filter((item): item is StoredPhotoOverlaySnapshot => item !== null);
  } catch {
    return [];
  }
}

function writeRaw(items: StoredPhotoOverlaySnapshot[]) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getPhotoOverlaySnapshot(photoId: string) {
  const items = readRaw();
  return items.find((item) => item.photoId === photoId) ?? null;
}

export function upsertPhotoOverlaySnapshot(
  photoId: string,
  particles: StoredParticleOverlay[],
  frames: StoredFrameOverlay[] = [],
) {
  const items = readRaw();
  const next: StoredPhotoOverlaySnapshot = {
    photoId,
    createdAt: new Date().toISOString(),
    particles,
    frames,
  };

  const index = items.findIndex((item) => item.photoId === photoId);
  if (index >= 0) {
    items[index] = next;
    writeRaw(items);
    return;
  }

  writeRaw([next, ...items]);
}

export function clearPhotoOverlaySnapshots() {
  writeRaw([]);
}
