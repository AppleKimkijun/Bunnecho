"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
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
  buttonWidth: 300,
  rowGap: 0,
  columnGap: 0,
} as const;

/** 보드 안 촬영 사진 위치·크기 — 보드 PNG 기준 % + px 보정 (scale 1 기준) */
const BOARD_PHOTO_AREA = {
  left: "calc(17% + 50px)",
  top: "calc(18% - 20px - 2rem)",
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
  return boardWidth / BOARD_ASPECT;
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

const IMAGE_BUTTON_CLASS =
  "block w-full cursor-pointer transition-transform duration-200 ease-out hover:scale-[1.1] hover:-translate-y-1 active:scale-[0.96] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100 disabled:hover:translate-y-0";

function ShareModalShell({
  children,
  onClose,
  labelledBy,
}: {
  children: ReactNode;
  onClose: () => void;
  labelledBy: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-sky-200/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-sm animate-[pop-in_0.35s_ease-out] overflow-hidden rounded-[1.75rem] border-2 border-white/90 bg-gradient-to-b from-[#fffefb] to-[#f7f2ea] px-6 py-7 shadow-[0_18px_48px_rgba(147,197,253,0.28)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-200/80 via-pink-200/70 to-violet-200/80"
          aria-hidden
        />
        {children}
      </div>
    </div>
  );
}

function ShareConfirmModal({
  onConfirm,
  onCancel,
  isSharing,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isSharing: boolean;
}) {
  return (
    <ShareModalShell onClose={onCancel} labelledBy="share-confirm-title">
      <p className="font-luxurious-script text-center text-3xl leading-none text-violet-600/90">
        Share
      </p>

      <p
        id="share-confirm-title"
        className="mt-4 text-center text-base leading-relaxed font-medium text-neutral-700"
      >
        공유 화면에 사진을 띄우시겠습니까?
      </p>
      <p className="mt-2 text-center text-sm leading-relaxed text-neutral-500">
        촬영한 얼굴이 공유 화면에 올라갑니다.
      </p>

      <div className="mt-7 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSharing}
          className="flex-1 cursor-pointer rounded-full border border-sky-200/90 bg-white/90 px-4 py-3 text-sm font-medium text-sky-900/80 transition hover:border-sky-300 hover:bg-sky-50/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSharing}
          className="flex-1 cursor-pointer rounded-full border border-white/80 bg-gradient-to-r from-sky-200/90 via-pink-200/85 to-violet-200/90 px-4 py-3 text-sm font-medium text-violet-900/90 shadow-[0_4px_14px_rgba(192,132,252,0.18)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSharing ? "공유 중..." : "공유하기"}
        </button>
      </div>
    </ShareModalShell>
  );
}

function ShareSuccessModal({ onClose }: { onClose: () => void }) {
  return (
    <ShareModalShell onClose={onClose} labelledBy="share-success-title">
      <p className="font-luxurious-script text-center text-3xl leading-none text-violet-600/90">
        Done
      </p>

      <p
        id="share-success-title"
        className="mt-4 text-center text-base leading-relaxed font-medium text-neutral-700"
      >
        공유 되었습니다
      </p>
      <p className="mt-2 text-center text-sm leading-relaxed text-neutral-500">
        공유 화면에서 확인할 수 있어요.
      </p>

      <button
        type="button"
        onClick={onClose}
        className="mt-7 inline-flex w-full cursor-pointer items-center justify-center rounded-full border border-white/80 bg-gradient-to-r from-sky-200/90 via-pink-200/85 to-violet-200/90 px-4 py-3 text-sm font-medium text-violet-900/90 shadow-[0_4px_14px_rgba(192,132,252,0.18)] transition hover:brightness-[1.03]"
      >
        확인
      </button>
    </ShareModalShell>
  );
}

export default function ViewPhotoPage() {
  const [shareModal, setShareModal] = useState<"confirm" | "success" | null>(
    null,
  );
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

  const handleShareClick = () => {
    if (!latestPhoto || isSharing) {
      return;
    }

    setShareError(null);
    setShareModal("confirm");
  };

  const handleShareConfirm = async () => {
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
      setShareModal("success");
    } catch {
      setShareError("공유에 실패했어요. 다시 시도해주세요.");
      setShareModal(null);
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
              className="block h-full w-full select-none object-contain object-center"
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
            <Link href="/" className={IMAGE_BUTTON_CLASS}>
              <img
                src={CAMERA_BUTTON_URL}
                alt="Back to Camera"
                className="h-auto w-full select-none"
                draggable={false}
              />
            </Link>

            <button
              type="button"
              onClick={handleShareClick}
              disabled={!latestPhoto || isSharing}
              className={IMAGE_BUTTON_CLASS}
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

      {shareModal === "confirm" ? (
        <ShareConfirmModal
          onConfirm={handleShareConfirm}
          onCancel={() => setShareModal(null)}
          isSharing={isSharing}
        />
      ) : null}

      {shareModal === "success" ? (
        <ShareSuccessModal onClose={() => setShareModal(null)} />
      ) : null}
    </main>
    </ScreenReadyGate>
  );
}
