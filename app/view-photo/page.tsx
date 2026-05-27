"use client";

import Link from "next/link";
import { useState } from "react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { createFaceCutoutDataUrl } from "@/lib/face-cutout";
import { upsertSharedFace } from "@/lib/shared-face-store";
import {
  getPhotosServerSnapshot,
  listPhotos,
  subscribePhotos,
} from "@/lib/photo-store";

const BG_URL = "/img/%EB%B2%84%EB%84%A4%EB%B0%B0%EA%B2%BD1.png";

export default function ViewPhotoPage() {
  const photos = useSyncExternalStore(
    subscribePhotos,
    listPhotos,
    getPhotosServerSnapshot,
  );
  const latestPhoto = photos[0] ?? null;
  const [isSharing, setIsSharing] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);

  async function handleShare() {
    if (!latestPhoto || isSharing) {
      return;
    }

    try {
      setIsSharing(true);
      const faceCutout = await createFaceCutoutDataUrl(latestPhoto.dataUrl);
      upsertSharedFace(latestPhoto.id, faceCutout);
      setNoticeOpen(true);
      window.setTimeout(() => {
        setNoticeOpen(false);
      }, 1800);
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <main className="relative min-h-svh w-full overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BG_URL})` }}
      />
      <div className="absolute inset-0 bg-black/35" />

      <div className="relative mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-5 p-6 md:p-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">사진 보기</h1>
        <Link href="/">
          <Button variant="secondary">카메라로 돌아가기</Button>
        </Link>
      </div>

      {latestPhoto ? (
        <section className="overflow-hidden rounded-2xl border border-white/30 bg-black/70 p-3 backdrop-blur-sm md:p-4">
          <img
            src={latestPhoto.dataUrl}
            alt="최근 촬영 사진"
            className="mx-auto max-h-[78svh] w-auto max-w-full rounded-lg object-contain"
          />

          <div className="mt-4 flex justify-end">
            <Button onClick={handleShare} disabled={isSharing}>
              {isSharing ? "얼굴 누끼 준비 중..." : "공유하기"}
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-white/40 bg-black/45 p-10 text-center text-white">
          아직 촬영된 사진이 없습니다.
        </section>
      )}

      {noticeOpen && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="rounded-2xl border border-white/35 bg-black/75 px-6 py-4 text-center text-white shadow-2xl backdrop-blur-sm animate-pulse">
            <p className="text-base font-semibold">공유 완료</p>
            <p className="mt-1 text-sm text-white/85">
              옆 화면에서 둥둥 떠다니는 얼굴을 확인해보세요.
            </p>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}
