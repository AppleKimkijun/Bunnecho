"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import {
  getSharedFacesServerSnapshot,
  listSharedFaces,
  subscribeSharedFaces,
  type SharedFaceItem,
} from "@/lib/shared-face-store";

const BG_URL = "/img/%EB%B2%84%EB%84%A4%EB%B0%B0%EA%B2%BD1.png";

type Bubble = {
  id: string;
  src: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
};

function hashToUnit(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function seedRange(seed: string, min: number, max: number) {
  return min + hashToUnit(seed) * (max - min);
}

function seedSign(seed: string) {
  return hashToUnit(seed) > 0.5 ? 1 : -1;
}

function makeBubble(
  item: SharedFaceItem,
  width: number,
  height: number,
): Bubble {
  const size = seedRange(`${item.id}-size`, 96, 164);
  const maxX = Math.max(width - size, 1);
  const maxY = Math.max(height - size, 1);

  return {
    id: item.id,
    src: item.dataUrl,
    size,
    x: seedRange(`${item.id}-x`, 0, maxX),
    y: seedRange(`${item.id}-y`, 0, maxY),
    vx: seedRange(`${item.id}-vx`, 0.8, 2) * seedSign(`${item.id}-sx`),
    vy: seedRange(`${item.id}-vy`, 0.7, 1.8) * seedSign(`${item.id}-sy`),
  };
}

export default function ShareFacePage() {
  const sharedFaces = useSyncExternalStore(
    subscribeSharedFaces,
    listSharedFaces,
    getSharedFacesServerSnapshot,
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  const memoFaces = useMemo(() => sharedFaces, [sharedFaces]);

  useEffect(() => {
    const width = containerRef.current?.clientWidth ?? window.innerWidth;
    const height = containerRef.current?.clientHeight ?? window.innerHeight;

    const existing = new Map(
      bubblesRef.current.map((bubble) => [bubble.id, bubble]),
    );
    const nextBubbles: Bubble[] = memoFaces.map((item) => {
      const current = existing.get(item.id);
      if (current) {
        return { ...current, src: item.dataUrl };
      }
      return makeBubble(item, width, height);
    });

    bubblesRef.current = nextBubbles;
    setBubbles(nextBubbles.map((bubble) => ({ ...bubble })));
  }, [memoFaces]);

  useEffect(() => {
    if (bubblesRef.current.length === 0) {
      return;
    }

    let rafId = 0;

    const animate = () => {
      const width = containerRef.current?.clientWidth ?? window.innerWidth;
      const height = containerRef.current?.clientHeight ?? window.innerHeight;

      const next = bubblesRef.current.map((bubble) => {
        const updated = {
          ...bubble,
          x: bubble.x + bubble.vx,
          y: bubble.y + bubble.vy,
        };

        if (updated.x <= 0 || updated.x + updated.size >= width) {
          updated.vx *= -1;
          updated.x = Math.max(0, Math.min(width - updated.size, updated.x));
        }

        if (updated.y <= 0 || updated.y + updated.size >= height) {
          updated.vy *= -1;
          updated.y = Math.max(0, Math.min(height - updated.size, updated.y));
        }

        return updated;
      });

      bubblesRef.current = next;
      setBubbles(next.map((bubble) => ({ ...bubble })));

      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [memoFaces.length]);

  return (
    <main
      ref={containerRef}
      className="relative min-h-svh w-full overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BG_URL})` }}
      />
      <div className="absolute inset-0 bg-black/25" />

      <div className="relative z-10 flex items-center justify-between px-4 py-4 md:px-8">
        <h1 className="text-lg font-semibold text-white md:text-2xl">
          둥둥 얼굴 공유 화면
        </h1>
        <Link href="/view-photo">
          <Button variant="secondary">사진 페이지로</Button>
        </Link>
      </div>

      {bubbles.length === 0 ? (
        <div className="relative z-10 flex min-h-[70svh] items-center justify-center p-6">
          <div className="rounded-2xl border border-white/35 bg-black/50 p-6 text-center text-white">
            공유할 얼굴 누끼가 없습니다. 사진 페이지에서 공유하기를 눌러주세요.
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 z-10">
          {bubbles.map((bubble) => (
            <img
              key={bubble.id}
              src={bubble.src}
              alt="떠다니는 얼굴"
              className="pointer-events-none absolute select-none"
              style={{
                width: `${bubble.size}px`,
                height: `${bubble.size}px`,
                transform: `translate(${bubble.x}px, ${bubble.y}px)`,
                willChange: "transform",
                filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.28))",
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
