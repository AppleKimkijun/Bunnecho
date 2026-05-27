"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { createBunnyShareCutoutDataUrls } from "@/lib/bunny-share-cutout";
import {
  getPhotosServerSnapshot,
  listPhotos,
  subscribePhotos,
} from "@/lib/photo-store";
import { getRawPhoto } from "@/lib/photo-raw-store";
import { upsertSharedFaces } from "@/lib/shared-face-store";

const BG_URL = "/img/%EB%B2%84%EB%84%A4%EB%B0%B0%EA%B2%BD1.png";

export default function ViewPhotoPage() {
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const photos = useSyncExternalStore(
    subscribePhotos,
    listPhotos,
    getPhotosServerSnapshot,
  );
  const latestPhoto = photos[0] ?? null;

  const handleShare = async () => {
    if (!latestPhoto || isSharing) {
      return;
    }

    setIsSharing(true);
    setShareMessage(null);

    try {
      const shareSource =
        (await getRawPhoto(latestPhoto.id)) ?? latestPhoto.dataUrl;
      const faceCutouts = await createBunnyShareCutoutDataUrls(
        shareSource,
      );
      upsertSharedFaces(`${latestPhoto.id}:bunny-v2`, faceCutouts);
      setShareMessage("공유 완료! 공유 화면에서 확인하세요.");
    } catch {
      setShareMessage("공유 이미지 생성에 실패했어요. 다시 시도해주세요.");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <main className="relative min-h-svh w-full overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BG_URL})` }}
      />
      <div className="absolute inset-0 bg-black/25" />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-5 p-6 md:p-8">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            사진 보기
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/share-face">
              <Button variant="secondary">공유 화면</Button>
            </Link>
            <Link href="/">
              <Button variant="secondary">카메라로 돌아가기</Button>
            </Link>
          </div>
        </div>

        {latestPhoto ? (
          <>
            <section className="overflow-hidden rounded-2xl border bg-black/80 p-3 md:p-4">
              <img
                src={latestPhoto.dataUrl}
                alt="최근 촬영 사진"
                className="mx-auto max-h-[72svh] w-auto max-w-full rounded-lg object-contain"
              />
            </section>

            <div className="flex items-center justify-center gap-3">
              <Button onClick={handleShare} disabled={isSharing}>
                {isSharing ? "공유 중..." : "공유하기"}
              </Button>
            </div>

            {shareMessage && (
              <div className="rounded-xl border border-white/35 bg-black/45 px-4 py-3 text-center text-sm text-white">
                {shareMessage}
              </div>
            )}
          </>
        ) : (
          <section className="rounded-2xl border border-dashed p-10 text-center text-white/80">
            아직 촬영된 사진이 없습니다.
          </section>
        )}
      </div>
    </main>
  );
}
