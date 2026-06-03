"use client";

import { useEffect } from "react";
import { clearPhotoOverlaySnapshots } from "@/lib/photo-overlay-store";
import { clearPhotos } from "@/lib/photo-store";
import { clearSharedFaces } from "@/lib/shared-face-store";

export default function ResetStorageOnLoad() {
  useEffect(() => {
    clearPhotoOverlaySnapshots();
    clearPhotos();
    clearSharedFaces();
  }, []);

  return null;
}
