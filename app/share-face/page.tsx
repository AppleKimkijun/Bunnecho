"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { PencilXMark } from "@/components/pencil-x-mark";
import { Button } from "@/components/ui/button";
import { getShareFaceBubbleSize } from "@/lib/share-face-size";
import {
  getVisibleBounds,
  makeAlphaShape,
  visiblePixelsOverlap,
  type AlphaShape,
} from "@/lib/share-face-collision";
import {
  getSharedFacesServerSnapshot,
  listSharedFaces,
  removeSharedFace,
  subscribeSharedFaces,
  type SharedFaceItem,
} from "@/lib/shared-face-store";

const BG_URL = "/img/background/share-face-bg.gif";
type Bubble = {
  id: string;
  src: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
};

type CachedShape = { src: string; shape: AlphaShape };

function getActiveShapes(bubbles: Bubble[], cache: Map<string, CachedShape>) {
  return new Map(bubbles.flatMap((bubble) => {
    const cached = cache.get(bubble.id);
    return cached?.src === bubble.src ? [[bubble.id, cached.shape] as const] : [];
  }));
}

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
  const baseSize = seedRange(`${item.id}-size`, 165, 210);
  const size = getShareFaceBubbleSize(baseSize, item.frameIndices?.length ?? 1, width, height);
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

function getBubbleCenter(bubble: Bubble) {
  return {
    cx: bubble.x + bubble.size / 2,
    cy: bubble.y + bubble.size / 2,
  };
}

function clampBubbleToBounds(bubble: Bubble, width: number, height: number, shape?: AlphaShape) {
  const bounds = shape ? getVisibleBounds(bubble, shape) : {
    left: bubble.x, top: bubble.y, right: bubble.x + bubble.size, bottom: bubble.y + bubble.size,
  };
  bubble.x += Math.max(0, -bounds.left) - Math.max(0, bounds.right - width);
  bubble.y += Math.max(0, -bounds.top) - Math.max(0, bounds.bottom - height);
}

function bounceBubbleOffWalls(bubble: Bubble, width: number, height: number, shape: AlphaShape) {
  const bounds = getVisibleBounds(bubble, shape);
  if (bounds.left <= 0) {
    bubble.x -= bounds.left;
    bubble.vx = Math.abs(bubble.vx);
  } else if (bounds.right >= width) {
    bubble.x += width - bounds.right;
    bubble.vx = -Math.abs(bubble.vx);
  }

  if (bounds.top <= 0) {
    bubble.y -= bounds.top;
    bubble.vy = Math.abs(bubble.vy);
  } else if (bounds.bottom >= height) {
    bubble.y += height - bounds.bottom;
    bubble.vy = -Math.abs(bubble.vy);
  }
}

function resolveBubblePairCollisions(bubbles: Bubble[], shapes: Map<string, AlphaShape>) {
  for (let i = 0; i < bubbles.length; i += 1) {
    for (let j = i + 1; j < bubbles.length; j += 1) {
      const a = bubbles[i];
      const b = bubbles[j];
      const aShape = shapes.get(a.id);
      const bShape = shapes.get(b.id);
      if (!aShape || !bShape || !visiblePixelsOverlap(a, aShape, b, bShape)) continue;

      const aBounds = getVisibleBounds(a, aShape);
      const bBounds = getVisibleBounds(b, bShape);
      const dx = (bBounds.left + bBounds.right - aBounds.left - aBounds.right) / 2;
      const dy = (bBounds.top + bBounds.bottom - aBounds.top - aBounds.bottom) / 2;
      const distance = Math.hypot(dx, dy) || 1;
      const nx = dx / distance || 1;
      const ny = dy / distance;
      const startAX = a.x;
      const startAY = a.y;
      const startBX = b.x;
      const startBY = b.y;
      let low = 0;
      let high = Math.max(a.size, b.size) * 2;
      for (let step = 0; step < 10; step += 1) {
        const offset = (low + high) / 2;
        a.x = startAX - nx * offset / 2;
        a.y = startAY - ny * offset / 2;
        b.x = startBX + nx * offset / 2;
        b.y = startBY + ny * offset / 2;
        if (visiblePixelsOverlap(a, aShape, b, bShape)) low = offset;
        else high = offset;
      }
      a.x = startAX - nx * (high + 1) / 2;
      a.y = startAY - ny * (high + 1) / 2;
      b.x = startBX + nx * (high + 1) / 2;
      b.y = startBY + ny * (high + 1) / 2;

      const dvx = b.vx - a.vx;
      const dvy = b.vy - a.vy;
      const velAlongNormal = dvx * nx + dvy * ny;
      if (velAlongNormal < 0) {
        const impulse = -velAlongNormal;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
      }
    }
  }
}

export default function ShareFacePage() {
  const sharedFaces = useSyncExternalStore(
    subscribeSharedFaces,
    listSharedFaces,
    getSharedFacesServerSnapshot,
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const shapesRef = useRef<Map<string, CachedShape>>(new Map());
  const [shapeVersion, setShapeVersion] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [hoveredBubbleId, setHoveredBubbleId] = useState<string | null>(null);

  const memoFaces = useMemo(() => sharedFaces, [sharedFaces]);
  const hoveredBubble = useMemo(
    () => bubbles.find((bubble) => bubble.id === hoveredBubbleId) ?? null,
    [bubbles, hoveredBubbleId],
  );
  const hoveredBubbleRotation = hoveredBubble
    ? seedRange(`${hoveredBubble.id}-xrot`, -12, 12)
    : 0;

  const updateHoveredBubble = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;

    let nextHoveredId: string | null = null;

    for (const bubble of bubblesRef.current) {
      const { cx, cy } = getBubbleCenter(bubble);
      const hitRadius = bubble.size * 0.52;

      if (Math.hypot(pointerX - cx, pointerY - cy) <= hitRadius) {
        nextHoveredId = bubble.id;
        break;
      }
    }

    setHoveredBubbleId((current) =>
      current === nextHoveredId ? current : nextHoveredId,
    );
  };

  useEffect(() => {
    let cancelled = false;
    void Promise.all(memoFaces.map(async (item): Promise<[string, CachedShape]> => {
      const cached = shapesRef.current.get(item.id);
      if (cached?.src === item.dataUrl) return [item.id, cached];

      const image = new Image();
      image.src = item.dataUrl;
      await image.decode();
      const scale = Math.min(1, 384 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("공유 이미지의 투명 영역을 읽을 수 없습니다.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      return [item.id, { src: item.dataUrl, shape: makeAlphaShape(canvas.width, canvas.height, rgba) }];
    })).then((entries) => {
      if (cancelled) return;
      shapesRef.current = new Map(entries);
      setShapeVersion((version) => version + 1);
    }).catch((error) => console.error("공유 이미지 충돌 영역을 읽지 못했습니다.", error));
    return () => { cancelled = true; };
  }, [memoFaces]);

  useEffect(() => {
    const width = containerRef.current?.clientWidth ?? window.innerWidth;
    const height = containerRef.current?.clientHeight ?? window.innerHeight;

    const existing = new Map(
      bubblesRef.current.map((bubble) => [bubble.id, bubble]),
    );
    const nextBubbles: Bubble[] = memoFaces.map((item) => {
      const current = existing.get(item.id);
      if (current && current.src === item.dataUrl) {
        return current;
      }
      if (current) {
        return {
          ...makeBubble(item, width, height),
          x: current.x,
          y: current.y,
          vx: current.vx,
          vy: current.vy,
          size: current.size,
        };
      }
      return makeBubble(item, width, height);
    });

    const shapes = getActiveShapes(nextBubbles, shapesRef.current);
    for (let pass = 0; pass < 6; pass += 1) {
      resolveBubblePairCollisions(nextBubbles, shapes);
      nextBubbles.forEach((bubble) =>
        clampBubbleToBounds(bubble, width, height, shapes.get(bubble.id)),
      );
    }

    bubblesRef.current = nextBubbles;
    setBubbles(nextBubbles.map((bubble) => ({ ...bubble })));
  }, [memoFaces]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      const { clientWidth: width, clientHeight: height } = container;
      const facesById = new Map(memoFaces.map((item) => [item.id, item]));
      bubblesRef.current = bubblesRef.current.map((bubble) => {
        const item = facesById.get(bubble.id);
        if (!item) return bubble;
        const resized = {
          ...bubble,
          size: getShareFaceBubbleSize(
            seedRange(`${item.id}-size`, 165, 210),
            item.frameIndices?.length ?? 1,
            width,
            height,
          ),
        };
        clampBubbleToBounds(resized, width, height, shapesRef.current.get(bubble.id)?.shape);
        return resized;
      });
      setBubbles(bubblesRef.current.map((bubble) => ({ ...bubble })));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [memoFaces]);

  useEffect(() => {
    if (bubblesRef.current.length === 0) {
      return;
    }

    let rafId = 0;

    const animate = () => {
      const width = containerRef.current?.clientWidth ?? window.innerWidth;
      const height = containerRef.current?.clientHeight ?? window.innerHeight;

      const next = bubblesRef.current.map((bubble) => ({
        ...bubble,
        x: bubble.x + bubble.vx,
        y: bubble.y + bubble.vy,
      }));
      const shapes = getActiveShapes(next, shapesRef.current);

      for (const bubble of next) {
        const shape = shapes.get(bubble.id);
        if (shape) bounceBubbleOffWalls(bubble, width, height, shape);
      }

      for (let pass = 0; pass < 3; pass += 1) {
        resolveBubblePairCollisions(next, shapes);
      }

      for (const bubble of next) {
        const shape = shapes.get(bubble.id);
        if (shape) bounceBubbleOffWalls(bubble, width, height, shape);
      }

      bubblesRef.current = next;
      setBubbles(next.map((bubble) => ({ ...bubble })));

      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [memoFaces.length, shapeVersion]);

  const handleRemoveHoveredBubble = () => {
    if (!hoveredBubbleId) {
      return;
    }

    removeSharedFace(hoveredBubbleId);
    bubblesRef.current = bubblesRef.current.filter(
      (bubble) => bubble.id !== hoveredBubbleId,
    );
    setBubbles((current) =>
      current.filter((bubble) => bubble.id !== hoveredBubbleId),
    );
    setHoveredBubbleId(null);
  };

  return (
    <main
      ref={containerRef}
      className="relative min-h-svh w-full overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${BG_URL})` }}
      />

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
        <div
          className="absolute inset-0 z-10"
          onPointerMove={(event) => {
            updateHoveredBubble(event.clientX, event.clientY);
          }}
          onPointerLeave={() => {
            setHoveredBubbleId(null);
          }}
        >
          {bubbles.map((bubble) => (
            <img
              key={`${bubble.id}-${bubble.src.length}-${bubble.src.slice(-48)}`}
              src={bubble.src}
              alt="떠다니는 얼굴"
              className="pointer-events-none absolute select-none object-contain"
              style={{
                width: `${bubble.size}px`,
                height: `${bubble.size}px`,
                transform: `translate(${bubble.x}px, ${bubble.y}px)`,
                willChange: "transform",
              }}
            />
          ))}

          {hoveredBubble ? (
            <button
              type="button"
              aria-label="얼굴 삭제"
              className="absolute z-20 cursor-pointer border-0 bg-transparent p-0 drop-shadow-[0_3px_6px_rgba(239,79,115,0.35)]"
              style={{
                left: hoveredBubble.x + hoveredBubble.size / 2,
                top: hoveredBubble.y + hoveredBubble.size / 2,
                transform: `translate(-50%, -50%) rotate(${hoveredBubbleRotation}deg)`,
              }}
              onClick={handleRemoveHoveredBubble}
            >
              <PencilXMark size={hoveredBubble.size * 1.28} />
            </button>
          ) : null}
        </div>
      )}
    </main>
  );
}
