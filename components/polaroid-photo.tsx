"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const POLAROID_FRAME_URL = "/img/board/polaroid.png";

/** 사진 크기 대비 폴라로이드 여백 비율 */
const MARGIN_EDGE = 0.06;
const MARGIN_BOTTOM = 0.26;

const DEFAULT_PHOTO_ASPECT = 4 / 3;

type PolaroidPhotoProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  rotationDeg?: number;
  emptyLabel?: string;
};

type PhotoSize = {
  width: number;
  height: number;
};

function getPolaroidMetrics(
  photo: PhotoSize,
  maxWidth: number,
  maxHeight: number,
) {
  const { width: photoW, height: photoH } = photo;
  if (photoW <= 0 || photoH <= 0 || maxWidth <= 0 || maxHeight <= 0) {
    return null;
  }

  const frameWidthForUnitPhoto = photoW * (1 + MARGIN_EDGE * 2);
  const frameHeightForUnitPhoto =
    photoH + photoW * MARGIN_EDGE + photoW * MARGIN_BOTTOM;

  const scale = Math.min(
    maxWidth / frameWidthForUnitPhoto,
    maxHeight / frameHeightForUnitPhoto,
  );

  const photoWidth = photoW * scale;
  const photoHeight = photoH * scale;
  const edgePadding = photoWidth * MARGIN_EDGE;

  return {
    photoWidth,
    photoHeight,
    paddingTop: edgePadding,
    paddingBottom: photoWidth * MARGIN_BOTTOM,
    paddingLeft: edgePadding,
    paddingRight: edgePadding,
    frameWidth: photoWidth + edgePadding * 2,
    frameHeight: photoHeight + edgePadding + photoWidth * MARGIN_BOTTOM,
  };
}

export function PolaroidPhoto({
  src,
  alt = "촬영한 사진",
  className = "",
  rotationDeg = -2.5,
  emptyLabel = "아직 촬영된 사진이 없습니다",
}: PolaroidPhotoProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [photoSize, setPhotoSize] = useState<PhotoSize | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  const handlePhotoLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      if (!image.naturalWidth || !image.naturalHeight) {
        return;
      }

      setPhotoSize({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    },
    [],
  );

  useEffect(() => {
    if (!src) {
      setPhotoSize(null);
      return;
    }

    const probe = new Image();
    probe.onload = () => {
      if (probe.naturalWidth && probe.naturalHeight) {
        setPhotoSize({
          width: probe.naturalWidth,
          height: probe.naturalHeight,
        });
      }
    };
    probe.src = src;
  }, [src]);

  const effectivePhoto = photoSize ?? {
    width: DEFAULT_PHOTO_ASPECT,
    height: 1,
  };

  const metrics = useMemo(
    () =>
      getPolaroidMetrics(
        effectivePhoto,
        containerSize.width,
        containerSize.height,
      ),
    [containerSize.height, containerSize.width, effectivePhoto],
  );

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full items-center justify-center ${className}`}
    >
      {metrics ? (
        <div
          className="pointer-events-none relative select-none"
          style={{
            width: metrics.frameWidth,
            height: metrics.frameHeight,
            transform: `rotate(${rotationDeg}deg)`,
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 shadow-[0_12px_32px_rgba(0,0,0,0.22),0_4px_10px_rgba(0,0,0,0.12)]"
            aria-hidden
          />

          <img
            src={POLAROID_FRAME_URL}
            alt=""
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-fill object-bottom"
            draggable={false}
            aria-hidden
          />

          <div
            className="relative z-[1] box-border"
            style={{
              paddingTop: metrics.paddingTop,
              paddingBottom: metrics.paddingBottom,
              paddingLeft: metrics.paddingLeft,
              paddingRight: metrics.paddingRight,
            }}
          >
            {src ? (
              <img
                src={src}
                alt={alt}
                onLoad={handlePhotoLoad}
                className="block"
                style={{
                  width: metrics.photoWidth,
                  height: metrics.photoHeight,
                }}
                draggable={false}
              />
            ) : (
              <div
                className="flex items-center justify-center bg-white/80 px-3 text-center text-[0.72rem] leading-snug font-medium text-neutral-400"
                style={{
                  width: metrics.photoWidth,
                  height: metrics.photoHeight,
                }}
              >
                {emptyLabel}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { POLAROID_FRAME_URL };
