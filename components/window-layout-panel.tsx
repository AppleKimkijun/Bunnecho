"use client";

import { useState } from "react";
import type { DesktopWindowId, WindowLayout } from "@/components/desktop-window";
import {
  formatWindowLayout,
  WINDOW_LAYOUT_LABELS,
} from "@/lib/desktop-window-layout-store";

type WindowLayoutPanelProps = {
  layouts: Record<DesktopWindowId, WindowLayout>;
  updatedAt: string | null;
};

const WINDOW_ORDER: DesktopWindowId[] = ["camera", "particle", "frame"];

export function WindowLayoutPanel({
  layouts,
  updatedAt,
}: WindowLayoutPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const jsonText = JSON.stringify({ layouts }, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-[100] max-w-[min(92vw,360px)]">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="rounded-md bg-black/70 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur-sm"
      >
        {isOpen ? "레이아웃 숨기기" : "레이아웃 보기"}
      </button>

      {isOpen ? (
        <div className="mt-2 rounded-lg border border-white/20 bg-black/75 p-3 text-xs text-white shadow-xl backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-medium">저장된 창 위치·크기</span>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded bg-white/15 px-2 py-0.5 text-[11px] hover:bg-white/25"
            >
              {copied ? "복사됨" : "JSON 복사"}
            </button>
          </div>

          <ul className="space-y-1.5 font-mono text-[11px] leading-relaxed text-white/90">
            {WINDOW_ORDER.map((windowId) => (
              <li key={windowId}>
                <span className="text-white/60">{WINDOW_LAYOUT_LABELS[windowId]}: </span>
                {formatWindowLayout(layouts[windowId])}
              </li>
            ))}
          </ul>

          {updatedAt ? (
            <p className="mt-2 text-[10px] text-white/50">
              마지막 저장: {new Date(updatedAt).toLocaleString("ko-KR")}
            </p>
          ) : null}

          <pre className="mt-2 max-h-40 overflow-auto rounded bg-black/40 p-2 text-[10px] text-white/80">
            {jsonText}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
