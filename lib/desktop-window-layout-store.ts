import type {
  DesktopWindowId,
  WindowLayout,
} from "@/components/desktop-window";

const STORAGE_KEY = "bunnecho:desktop-window-layout";

export type SavedDesktopWindowLayout = {
  layouts: Record<DesktopWindowId, WindowLayout>;
  zOrder: DesktopWindowId[];
  updatedAt: string;
};

const WINDOW_IDS: DesktopWindowId[] = ["camera", "particle", "frame"];

function isWindowLayout(value: unknown): value is WindowLayout {
  if (!value || typeof value !== "object") {
    return false;
  }

  const layout = value as WindowLayout;
  return (
    typeof layout.x === "number" &&
    typeof layout.y === "number" &&
    typeof layout.width === "number" &&
    typeof layout.height === "number"
  );
}

function isSavedDesktopWindowLayout(
  value: unknown,
): value is SavedDesktopWindowLayout {
  if (!value || typeof value !== "object") {
    return false;
  }

  const saved = value as SavedDesktopWindowLayout;
  if (!saved.layouts || typeof saved.layouts !== "object") {
    return false;
  }

  if (!Array.isArray(saved.zOrder) || saved.zOrder.length !== WINDOW_IDS.length) {
    return false;
  }

  return WINDOW_IDS.every(
    (windowId) =>
      isWindowLayout(saved.layouts[windowId]) &&
      saved.zOrder.includes(windowId),
  );
}

export function loadDesktopWindowLayout(): SavedDesktopWindowLayout | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    return isSavedDesktopWindowLayout(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDesktopWindowLayout(layout: SavedDesktopWindowLayout) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...layout,
      updatedAt: new Date().toISOString(),
    }),
  );
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveDesktopWindowLayoutDebounced(
  layout: Omit<SavedDesktopWindowLayout, "updatedAt">,
) {
  if (typeof window === "undefined") {
    return;
  }

  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    saveDesktopWindowLayout({
      ...layout,
      updatedAt: new Date().toISOString(),
    });
    saveTimer = null;
  }, 120);
}

export const WINDOW_LAYOUT_LABELS: Record<DesktopWindowId, string> = {
  camera: "카메라",
  particle: "파티클",
  frame: "필터",
};

export function formatWindowLayout(layout: WindowLayout) {
  return `x:${Math.round(layout.x)} y:${Math.round(layout.y)} w:${Math.round(layout.width)} h:${Math.round(layout.height)}`;
}
