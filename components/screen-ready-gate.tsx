"use client";

import { useEffect, useState, type ReactNode } from "react";

import { preloadImages } from "@/lib/preload-images";

type ScreenReadyGateProps = {
  assets: readonly string[];
  children: ReactNode;
  /** 로딩 중 배경색 — 첫 화면 톤과 맞추면 깜빡임이 적음 */
  placeholderClassName?: string;
};

export function ScreenReadyGate({
  assets,
  children,
  placeholderClassName = "bg-[#b8dcf0]",
}: ScreenReadyGateProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void preloadImages(assets).then(() => {
      if (!cancelled) {
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [assets]);

  return (
    <>
      <div
        className={`fixed inset-0 z-[9999] transition-opacity duration-300 ${placeholderClassName} ${
          ready ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        aria-hidden={ready}
        aria-busy={!ready}
        aria-label={ready ? undefined : "화면 준비 중"}
      />
      <div
        className={`transition-opacity duration-300 ease-out ${
          ready ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden={!ready}
      >
        {children}
      </div>
    </>
  );
}
