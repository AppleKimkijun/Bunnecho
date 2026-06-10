"use client";

import { useEffect, useState, type ReactNode } from "react";

import { preloadImages } from "@/lib/preload-images";

type ScreenReadyGateProps = {
  assets: readonly string[];
  children: ReactNode;
  /** 로딩 중 배경색 — 첫 화면 톤과 맞추면 깜빡임이 적음 */
  placeholderClassName?: string;
};

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export function ScreenReadyGate({
  assets,
  children,
  placeholderClassName = "bg-[#b8dcf0]",
}: ScreenReadyGateProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void preloadImages(assets)
      .then(() => waitForNextPaint())
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [assets]);

  if (!ready) {
    return (
      <div
        className={`fixed inset-0 z-[9999] ${placeholderClassName}`}
        aria-busy
        aria-label="화면 준비 중"
      />
    );
  }

  return (
    <div className="min-h-svh w-full animate-[screen-fade-in_300ms_ease-out_both]">
      {children}
    </div>
  );
}
