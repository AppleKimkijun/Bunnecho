"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createBunnyShareCutoutDataUrls } from "@/lib/bunny-share-cutout";
import {
  getPhotosServerSnapshot,
  listPhotos,
  subscribePhotos,
} from "@/lib/photo-store";
import { getPhotoOverlaySnapshot } from "@/lib/photo-overlay-store";
import { upsertSharedFaces } from "@/lib/shared-face-store";
import { PolaroidPhoto } from "@/components/polaroid-photo";
import { ScreenReadyGate } from "@/components/screen-ready-gate";
import { VIEW_PHOTO_SCREEN_IMAGE_URLS } from "@/lib/screen-assets";

const BG_URL = "/img/background/background2.png";
const BOARD_URL = "/img/board/board.png";
const BOARD_LOGO_URL = "/img/board/board_logo.png";
const CAMERA_BUTTON_URL = "/img/button/카메라 이동.png";
const SHARE_BUTTON_URL = "/img/button/공유 버튼.png";

const BOARD_ASPECT = 2048 / 1185;
const BUTTON_ASPECT = 2501 / 1181;

/** scale 1 기준 레이아웃 (화면에 맞춰 비율로 축소·확대) */
const LAYOUT_BASE = {
  boardWidth: 1140,
  boardHeightScale: 1.22,
  buttonWidth: 300,
  rowGap: 0,
  columnGap: 0,
} as const;

/** 보드 안 촬영 사진 위치·크기 — 보드 PNG 기준 % + px 보정 (scale 1 기준) */
const BOARD_PHOTO_AREA = {
  left: "calc(17% + 50px)",
  top: "calc(18% - 20px)",
  width: "calc(66% - 100px)",
  height: "calc(66% + 100px)",
} as const;

/** 보드 왼쪽 상단 로고 */
const BOARD_LOGO_AREA = {
  left: "-.5rem",
  top: "-1rem",
  width: "19%",
} as const;

function getBoardHeight(boardWidth: number) {
  return (boardWidth / BOARD_ASPECT) * LAYOUT_BASE.boardHeightScale;
}

function getLayoutMetrics(isStacked: boolean) {
  const boardHeight = getBoardHeight(LAYOUT_BASE.boardWidth);
  const buttonHeight = LAYOUT_BASE.buttonWidth / BUTTON_ASPECT;

  if (isStacked) {
    return {
      contentWidth: LAYOUT_BASE.boardWidth,
      contentHeight:
        boardHeight + LAYOUT_BASE.columnGap + buttonHeight * 2 + 16,
    };
  }

  return {
    contentWidth:
      LAYOUT_BASE.boardWidth + LAYOUT_BASE.rowGap + LAYOUT_BASE.buttonWidth,
    contentHeight: Math.max(boardHeight, buttonHeight * 2 + 20),
  };
}

function useViewPhotoScale(isStacked: boolean) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const padding = 28;
      const { contentWidth, contentHeight } = getLayoutMetrics(isStacked);
      const availableWidth = window.innerWidth - padding * 2;
      const availableHeight = window.innerHeight - padding * 2;

      const nextScale = Math.min(
        availableWidth / contentWidth,
        availableHeight / contentHeight,
      );

      setScale(Math.max(0.42, Math.min(nextScale, 1.85)));
    };

    updateScale();
    window.addEventListener("resize", updateScale);

    return () => {
      window.removeEventListener("resize", updateScale);
    };
  }, [isStacked]);

  return scale;
}

function ShareSuccessModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-sky-200/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-sm animate-[pop-in_0.35s_ease-out] rounded-[2rem] border-4 border-white bg-gradient-to-b from-[#fff7fb] to-[#f3ecff] px-6 py-8 text-center shadow-[0_20px_50px_rgba(167,139,250,0.35)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-success-title"
      >
        <div className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1 text-lg shadow-sm">
          ✨
        </div>

        <p
          id="share-success-title"
          className="font-luxurious-script text-3xl leading-tight text-violet-700 md:text-4xl"
        >
          Shared!
        </p>

        <p className="mt-4 text-base leading-relaxed font-medium text-neutral-700 md:text-lg">
          공유 화면에 공유 되었습니다!
          <br />
          지금 바로 확인해 보세요!
        </p>

        <Link
          href="/"
          className="mt-7 inline-flex w-full items-center justify-center rounded-full border-2 border-white bg-gradient-to-r from-[#ffd6e8] via-[#ffe9a8] to-[#c9b6ff] px-6 py-3.5 text-base font-bold tracking-tight text-violet-800 shadow-[0_6px_0_#d8b4fe,0_10px_24px_rgba(192,132,252,0.35)] transition hover:translate-y-0.5 hover:shadow-[0_4px_0_#d8b4fe,0_8px_20px_rgba(192,132,252,0.3)] active:translate-y-1 active:shadow-[0_2px_0_#d8b4fe]"
        >
          카메라로 돌아가기 🐰
        </Link>
      </div>
    </div>
  );
}

export default function ViewPhotoPage() {
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isStacked, setIsStacked] = useState(false);
  const scale = useViewPhotoScale(isStacked);

  const photos = useSyncExternalStore(
    subscribePhotos,
    listPhotos,
    getPhotosServerSnapshot,
  );
  const latestPhoto = photos[0] ?? null;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const syncStacked = () => {
      setIsStacked(media.matches);
    };

    syncStacked();
    media.addEventListener("change", syncStacked);

    return () => {
      media.removeEventListener("change", syncStacked);
    };
  }, []);

  const handleShare = async () => {
    if (!latestPhoto || isSharing) {
      return;
    }

    setIsSharing(true);
    setShareError(null);

    try {
      const overlaySnapshot = getPhotoOverlaySnapshot(latestPhoto.id);
      const faceCutouts = await createBunnyShareCutoutDataUrls(
        latestPhoto.dataUrl,
        overlaySnapshot,
      );
      upsertSharedFaces(`${latestPhoto.id}:bunny-v2`, faceCutouts);
      setShowShareModal(true);
    } catch {
      setShareError("공유에 실패했어요. 다시 시도해주세요.");
    } finally {
      setIsSharing(false);
    }
  };

  const boardHeight = getBoardHeight(LAYOUT_BASE.boardWidth);

  return (
    <ScreenReadyGate assets={VIEW_PHOTO_SCREEN_IMAGE_URLS}>
    <main className="fixed inset-0 h-[100dvh] w-full overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BG_URL})` }}
        aria-hidden
      />

      <div className="relative z-10 flex h-full w-full items-center justify-center">
        <div
          className={`flex origin-center items-center ${
            isStacked ? "flex-col" : "flex-row"
          }`}
          style={{
            transform: `scale(${scale})`,
            gap: isStacked ? LAYOUT_BASE.columnGap : LAYOUT_BASE.rowGap,
          }}
        >
          <div
            className="relative shrink-0"
            style={{ width: LAYOUT_BASE.boardWidth, height: boardHeight }}
          >
            <img
              src={BOARD_URL}
              alt=""
              className="block h-full w-full select-none object-fill"
              draggable={false}
            />

            <img
              src={BOARD_LOGO_URL}
              alt="Bunnecho"
              className="pointer-events-none absolute h-auto select-none"
              style={{
                left: BOARD_LOGO_AREA.left,
                top: BOARD_LOGO_AREA.top,
                width: BOARD_LOGO_AREA.width,
              }}
              draggable={false}
            />

            <div
              className="absolute flex items-center justify-center "
              style={{
                left: BOARD_PHOTO_AREA.left,
                top: BOARD_PHOTO_AREA.top,
                width: BOARD_PHOTO_AREA.width,
                height: BOARD_PHOTO_AREA.height,
              }}
            >
              <PolaroidPhoto
                src={latestPhoto?.dataUrl ?? null}
                rotationDeg={-2.5}
              />
            </div>
          </div>

          <div
            className="flex shrink-0 flex-col items-center"
            style={{
              width: LAYOUT_BASE.buttonWidth,
              gap: isStacked ? 16 : 20,
            }}
          >
            <Link
              href="/"
              className="block w-full transition hover:scale-[1.02] active:scale-[0.98]"
            >
              <img
                src={CAMERA_BUTTON_URL}
                alt="Back to Camera"
                className="h-auto w-full select-none"
                draggable={false}
              />
            </Link>

            <button
              type="button"
              onClick={handleShare}
              disabled={!latestPhoto || isSharing}
              className="block w-full transition hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <img
                src={SHARE_BUTTON_URL}
                alt="Share"
                className="h-auto w-full select-none"
                draggable={false}
              />
            </button>

            {shareError ? (
              <p className="text-center text-sm font-medium text-red-600">
                {shareError}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {showShareModal ? (
        <ShareSuccessModal onClose={() => setShowShareModal(false)} />
      ) : null}
    </main>
    </ScreenReadyGate>
  );
}
