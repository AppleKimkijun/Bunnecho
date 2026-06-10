"use client";

import type { ReactNode } from "react";

import { ScreenReadyGate } from "@/components/screen-ready-gate";
import { ALL_APP_IMAGE_URLS } from "@/lib/screen-assets";

type AppReadyProviderProps = {
  children: ReactNode;
};

export function AppReadyProvider({ children }: AppReadyProviderProps) {
  return (
    <ScreenReadyGate
      assets={ALL_APP_IMAGE_URLS}
      placeholderClassName="bg-[#b8dcf0]"
    >
      {children}
    </ScreenReadyGate>
  );
}
