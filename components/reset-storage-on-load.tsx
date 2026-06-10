"use client";

import { clearPhotoOverlaySnapshots } from "@/lib/photo-overlay-store";
import { clearPhotos } from "@/lib/photo-store";
import { clearSharedFaces } from "@/lib/shared-face-store";

let clearedOnBoot = false;

function resetAllStorageOnce() {
  if (clearedOnBoot || typeof window === "undefined") {
    return;
  }

  clearedOnBoot = true;
  clearPhotoOverlaySnapshots();
  clearPhotos();
  clearSharedFaces();
}

// useEffect보다 먼저 실행 — 첫 렌더에서 stale localStorage가 보이지 않게
resetAllStorageOnce();

export default function ResetStorageOnLoad() {
  return null;
}
