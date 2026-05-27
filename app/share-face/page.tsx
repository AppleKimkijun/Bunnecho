"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  getSharedFacesServerSnapshot,
  listSharedFaces,
  subscribeSharedFaces,
  type SharedFaceItem,
} from "@/lib/shared-face-store";

const BG_URL = "/img/%EB%B2%84%EB%84%A4%EB%B0%B0%EA%B2%BD1.png";

type BodyState = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotate: number;
  vr: number;
  src: string;
};

function hashToUnit(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = (hash >>> 0) / 4294967295;
  return normalized;
}

function seedRange(seed: string, min: number, max: number) {
  return min + hashToUnit(seed) * (max - min);
}

function seedSign(seed: string) {
  return hashToUnit(seed) > 0.5 ? 1 : -1;
}

function makeBody(item: SharedFaceItem, width: number, height: number): BodyState {
  const size = seedRange(`${item.photoId}-size`, 86, 152);
  const maxX = Math.max(width - size, 1);
  const maxY = Math.max(height - size, 1);

  return {
    id: item.photoId,
    src: item.dataUrl,
    size,
    x: seedRange(`${item.photoId}-x`, 0, maxX),
    y: seedRange(`${item.photoId}-y`, 0, maxY),
    vx: seedRange(`${item.photoId}-vx`, 0.8, 2.0) * seedSign(`${item.photoId}-sx`),
    vy: seedRange(`${item.photoId}-vy`, 0.7, 1.8) * seedSign(`${item.photoId}-sy`),
    rotate: seedRange(`${item.photoId}-r`, 0, 360),
    vr: seedRange(`${item.photoId}-vr`, 0.18, 0.7) * seedSign(`${item.photoId}-sr`),
  };
}

export default function ShareFacePage() {
  const sharedFaces = useSyncExternalStore(
    subscribeSharedFaces,
    listSharedFaces,
    getSharedFacesServerSnapshot,
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const bodiesRef = useRef<BodyState[]>([]);
  const [frames, setFrames] = useState<BodyState[]>([]);

  const memoFaces = useMemo(() => sharedFaces, [sharedFaces]);

  useEffect(() => {
    const width = containerRef.current?.clientWidth ?? window.innerWidth;
    const height = containerRef.current?.clientHeight ?? window.innerHeight;

    const existing = new Map(bodiesRef.current.map((body) => [body.id, body]));
    const nextBodies: BodyState[] = memoFaces.map((item) => {
      const current = existing.get(item.photoId);
      if (current) {
        return { ...current, src: item.dataUrl };
      }
      return makeBody(item, width, height);
    });

    bodiesRef.current = nextBodies;
    setFrames(nextBodies.map((body) => ({ ...body })));
  }, [memoFaces]);

  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      const width = containerRef.current?.clientWidth ?? window.innerWidth;
      const height = containerRef.current?.clientHeight ?? window.innerHeight;

      const bodies = bodiesRef.current;

      for (let i = 0; i < bodies.length; i += 1) {
        const body = bodies[i];
        body.x += body.vx;
        body.y += body.vy;
        body.rotate += body.vr;

        if (body.x <= 0 || body.x + body.size >= width) {
          body.vx *= -1;
          body.x = Math.max(0, Math.min(width - body.size, body.x));
        }

        if (body.y <= 0 || body.y + body.size >= height) {
          body.vy *= -1;
          body.y = Math.max(0, Math.min(height - body.size, body.y));
        }
      }

      for (let i = 0; i < bodies.length; i += 1) {
        for (let j = i + 1; j < bodies.length; j += 1) {
          const a = bodies[i];
          const b = bodies[j];

          const ax = a.x + a.size / 2;
          const ay = a.y + a.size / 2;
          const bx = b.x + b.size / 2;
          const by = b.y + b.size / 2;

          const dx = bx - ax;
          const dy = by - ay;
          const distance = Math.hypot(dx, dy) || 0.0001;
          const minDistance = a.size / 2 + b.size / 2;

          if (distance >= minDistance) {
            continue;
          }

          const nx = dx / distance;
          const ny = dy / distance;
          const overlap = minDistance - distance;

          a.x -= (nx * overlap) / 2;
          a.y -= (ny * overlap) / 2;
          b.x += (nx * overlap) / 2;
          b.y += (ny * overlap) / 2;

          const aVn = a.vx * nx + a.vy * ny;
          const bVn = b.vx * nx + b.vy * ny;
          const swap = aVn;

          a.vx += (bVn - aVn) * nx;
          a.vy += (bVn - aVn) * ny;
          b.vx += (swap - bVn) * nx;
          b.vy += (swap - bVn) * ny;

          const damping = 0.98;
          a.vx *= damping;
          a.vy *= damping;
          b.vx *= damping;
          b.vy *= damping;
        }
      }

      setFrames(bodies.map((body) => ({ ...body })));
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <main ref={containerRef} className="relative min-h-svh w-full overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BG_URL})` }}
      />
      <div className="absolute inset-0 bg-black/25" />

      <div className="relative z-10 flex items-center justify-between px-4 py-4 md:px-8">
        <h1 className="text-lg font-semibold text-white md:text-2xl">둥둥 얼굴 공유 화면</h1>
        <Link href="/view-photo">
          <Button variant="secondary">사진 페이지로</Button>
        </Link>
      </div>

      {frames.length === 0 ? (
        <div className="relative z-10 flex min-h-[70svh] items-center justify-center p-6">
          <div className="rounded-2xl border border-white/35 bg-black/50 p-6 text-center text-white">
            공유된 얼굴이 없습니다. 사진 보기 페이지에서 공유하기를 눌러보세요.
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 z-10">
          {frames.map((body) => (
            <img
              key={body.id}
              src={body.src}
              alt="떠다니는 얼굴"
              className="pointer-events-none absolute select-none"
              style={{
                width: `${body.size}px`,
                height: `${body.size}px`,
                transform: `translate(${body.x}px, ${body.y}px) rotate(${body.rotate}deg)`,
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
