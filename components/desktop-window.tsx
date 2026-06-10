"use client";

import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

export type DesktopWindowId = "camera" | "particle" | "frame";

export type WindowLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ResizeEdge = "e" | "w" | "s" | "n" | "se" | "sw" | "ne" | "nw";

const WINDOW_MIN_WIDTH: Record<DesktopWindowId, number> = {
  camera: 280,
  particle: 260,
  frame: 260,
};

const WINDOW_MIN_HEIGHT: Record<DesktopWindowId, number> = {
  camera: 300,
  particle: 130,
  frame: 160,
};

const MAX_SIZE_VIEWPORT_RATIO = 0.98;

/** 저장된 레이아웃이 없을 때만 쓰는 초기 배치 */
export const DEFAULT_WINDOW_Z_ORDER: DesktopWindowId[] = [
  "camera",
  "frame",
  "particle",
];

const CAMERA_TITLE_BAR_HEIGHT = 36;
const CAMERA_FOOTER_HEIGHT = 88;
/** 미리보기 영역 높이 — 가로(cameraWidth)와 무관하게 여기서만 조절 */
const CAMERA_VIEWPORT_HEIGHT = 600;

function estimateCameraHeight() {
  return CAMERA_TITLE_BAR_HEIGHT + CAMERA_VIEWPORT_HEIGHT + CAMERA_FOOTER_HEIGHT;
}

function estimateFrameHeight(width: number) {
  return 36 + width * 0.55 + 24;
}

function estimateParticleHeight() {
  return 36 + 120;
}

export function createDefaultWindowLayouts(
  viewportWidth: number,
  viewportHeight: number,
): Record<DesktopWindowId, WindowLayout> {
  const cameraWidth = Math.min(1100, viewportWidth * MAX_SIZE_VIEWPORT_RATIO);
  const sideWidth = Math.min(450, viewportWidth * MAX_SIZE_VIEWPORT_RATIO);
  const marginX = viewportWidth * 0.03;
  const marginY = viewportHeight * 0.06;

  const cameraHeight = estimateCameraHeight();
  const frameHeight = estimateFrameHeight(sideWidth);
  const particleHeight = estimateParticleHeight();

  return {
    camera: clampLayout(
      {
        x: (viewportWidth - cameraWidth) / 2-180,
        y: viewportWidth < 768 ? 72 : (viewportHeight - cameraHeight) / 2+20,
        width: cameraWidth,
        height: cameraHeight,
      },
      WINDOW_MIN_WIDTH.camera,
      WINDOW_MIN_HEIGHT.camera,
    ),
    particle: clampLayout(
      {
        x: viewportWidth - sideWidth - marginX,
        y: marginY,
        width: sideWidth,
        height: particleHeight,
      },
      WINDOW_MIN_WIDTH.particle,
      WINDOW_MIN_HEIGHT.particle,
    ),
    frame: clampLayout(
      {
        x: viewportWidth - sideWidth - marginX,
        y: Math.max(marginY, viewportHeight - frameHeight - marginY),
        width: sideWidth,
        height: frameHeight,
      },
      WINDOW_MIN_WIDTH.frame,
      WINDOW_MIN_HEIGHT.frame,
    ),
  };
}

function clampLayout(
  layout: WindowLayout,
  minWidth: number,
  minHeight: number,
): WindowLayout {
  const maxWidth = window.innerWidth * MAX_SIZE_VIEWPORT_RATIO;
  const maxHeight = window.innerHeight * MAX_SIZE_VIEWPORT_RATIO;

  let { x, y, width, height } = layout;

  width = Math.min(maxWidth, Math.max(minWidth, width));
  height = Math.min(maxHeight, Math.max(minHeight, height));

  const maxX = window.innerWidth - minWidth;
  const maxY = window.innerHeight - minHeight;
  x = Math.min(maxX, Math.max(0, x));
  y = Math.min(maxY, Math.max(0, y));

  if (x + width > window.innerWidth) {
    x = Math.max(0, window.innerWidth - width);
  }
  if (y + height > window.innerHeight) {
    y = Math.max(0, window.innerHeight - height);
  }

  return { x, y, width, height };
}

function applyResize(
  edge: ResizeEdge,
  origin: WindowLayout,
  dx: number,
  dy: number,
  minWidth: number,
  minHeight: number,
): WindowLayout {
  let { x, y, width, height } = origin;

  if (edge.includes("e")) {
    width = origin.width + dx;
  }
  if (edge.includes("w")) {
    width = origin.width - dx;
    x = origin.x + dx;
  }
  if (edge.includes("s")) {
    height = origin.height + dy;
  }
  if (edge.includes("n")) {
    height = origin.height - dy;
    y = origin.y + dy;
  }

  if (width < minWidth) {
    if (edge.includes("w")) {
      x -= minWidth - width;
    }
    width = minWidth;
  }
  if (height < minHeight) {
    if (edge.includes("n")) {
      y -= minHeight - height;
    }
    height = minHeight;
  }

  return clampLayout({ x, y, width, height }, minWidth, minHeight);
}

function MacTrafficLights() {
  return (
    <div className="flex gap-1.5" aria-hidden>
      <span className="size-3 rounded-full bg-[#ff5f57]" />
      <span className="size-3 rounded-full bg-[#febc2e]" />
      <span className="size-3 rounded-full bg-[#28c840]" />
    </div>
  );
}

function MacWindow({
  children,
  className = "",
  titleBar,
  onTitleBarPointerDown,
}: {
  children: ReactNode;
  className?: string;
  titleBar?: ReactNode;
  onTitleBarPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-black/10 bg-[#ececec] shadow-[0_4px_12px_rgba(0,0,0,0.12),0_16px_48px_rgba(0,0,0,0.22),0_32px_80px_rgba(0,0,0,0.18)] ${className}`}
    >
      <div
        className={`relative flex h-9 shrink-0 touch-none items-center border-b border-black/8 bg-[#f5f5f5] px-3 select-none active:cursor-grabbing ${
          onTitleBarPointerDown ? "cursor-grab" : ""
        }`}
        onPointerDown={onTitleBarPointerDown}
      >
        <MacTrafficLights />
        {titleBar ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {titleBar}
          </div>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

type ResizeHandleProps = {
  edge: ResizeEdge;
  className: string;
  cursor: string;
  onResizeStart: (
    event: ReactPointerEvent<HTMLDivElement>,
    edge: ResizeEdge,
  ) => void;
};

function ResizeHandle({
  edge,
  className,
  cursor,
  onResizeStart,
}: ResizeHandleProps) {
  return (
    <div
      className={`absolute z-20 touch-none ${className}`}
      style={{ cursor }}
      onPointerDown={(event) => onResizeStart(event, edge)}
      aria-hidden
    />
  );
}

type DesktopWindowProps = {
  layout: WindowLayout;
  zIndex: number;
  windowId: DesktopWindowId;
  titleBar?: ReactNode;
  footer?: ReactNode;
  onLayoutChange: (layout: WindowLayout) => void;
  onFocus: () => void;
  children: ReactNode;
};

export function DesktopWindow({
  layout,
  zIndex,
  windowId,
  titleBar,
  footer,
  onLayoutChange,
  onFocus,
  children,
}: DesktopWindowProps) {
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const resizeStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: WindowLayout;
    edge: ResizeEdge;
  } | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const minWidth = WINDOW_MIN_WIDTH[windowId];
  const minHeight = WINDOW_MIN_HEIGHT[windowId];

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (dragState && event.pointerId === dragState.pointerId) {
        const nextX = dragState.originX + (event.clientX - dragState.startX);
        const nextY = dragState.originY + (event.clientY - dragState.startY);
        onLayoutChange(
          clampLayout(
            {
              ...layoutRef.current,
              x: nextX,
              y: nextY,
            },
            minWidth,
            minHeight,
          ),
        );
        return;
      }

      const resizeState = resizeStateRef.current;
      if (resizeState && event.pointerId === resizeState.pointerId) {
        const dx = event.clientX - resizeState.startX;
        const dy = event.clientY - resizeState.startY;
        onLayoutChange(
          applyResize(
            resizeState.edge,
            resizeState.origin,
            dx,
            dy,
            minWidth,
            minHeight,
          ),
        );
      }
    };

    const endInteraction = (event: PointerEvent) => {
      if (dragStateRef.current?.pointerId === event.pointerId) {
        dragStateRef.current = null;
      }
      if (resizeStateRef.current?.pointerId === event.pointerId) {
        resizeStateRef.current = null;
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", endInteraction);
    window.addEventListener("pointercancel", endInteraction);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endInteraction);
      window.removeEventListener("pointercancel", endInteraction);
    };
  }, [minHeight, minWidth, onLayoutChange]);

  const handleTitleBarPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    onFocus();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: layout.x,
      originY: layout.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    edge: ResizeEdge,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onFocus();
    resizeStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: layout,
      edge,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return (
    <div
      className="absolute touch-none"
      style={{
        left: layout.x,
        top: layout.y,
        width: layout.width,
        height: layout.height,
        zIndex,
      }}
      onPointerDown={onFocus}
    >
      <div className="relative h-full">
        <MacWindow
          titleBar={titleBar}
          onTitleBarPointerDown={handleTitleBarPointerDown}
        >
          {children}
        </MacWindow>

        <ResizeHandle
          edge="e"
          className="top-9 right-0 bottom-2 w-2"
          cursor="ew-resize"
          onResizeStart={handleResizePointerDown}
        />
        <ResizeHandle
          edge="w"
          className="top-9 bottom-2 left-0 w-2"
          cursor="ew-resize"
          onResizeStart={handleResizePointerDown}
        />
        <ResizeHandle
          edge="s"
          className="right-2 bottom-0 left-2 h-2"
          cursor="ns-resize"
          onResizeStart={handleResizePointerDown}
        />
        <ResizeHandle
          edge="n"
          className="top-9 right-2 left-2 h-1"
          cursor="ns-resize"
          onResizeStart={handleResizePointerDown}
        />
        <ResizeHandle
          edge="se"
          className="right-0 bottom-0 h-4 w-4"
          cursor="nwse-resize"
          onResizeStart={handleResizePointerDown}
        />
        <ResizeHandle
          edge="sw"
          className="bottom-0 left-0 h-4 w-4"
          cursor="nesw-resize"
          onResizeStart={handleResizePointerDown}
        />
        <ResizeHandle
          edge="ne"
          className="top-9 right-0 h-3 w-3"
          cursor="nesw-resize"
          onResizeStart={handleResizePointerDown}
        />
        <ResizeHandle
          edge="nw"
          className="top-9 left-0 h-3 w-3"
          cursor="nwse-resize"
          onResizeStart={handleResizePointerDown}
        />
      </div>

      {footer}
    </div>
  );
}
