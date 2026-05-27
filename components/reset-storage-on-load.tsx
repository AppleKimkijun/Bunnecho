"use client";

import { useEffect } from "react";
import { clearPhotos } from "@/lib/photo-store";
import { clearSharedFaces } from "@/lib/shared-face-store";

export default function ResetStorageOnLoad() {
  useEffect(() => {
    clearPhotos();
    clearSharedFaces();
  }, []);

  return null;
}
