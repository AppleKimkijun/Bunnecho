"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  getPhotosServerSnapshot,
  listPhotos,
  subscribePhotos,
} from "@/lib/photo-store";

export default function PhotoDetailPage() {
  const params = useParams<{ id: string }>();
  const photos = useSyncExternalStore(
    subscribePhotos,
    listPhotos,
    getPhotosServerSnapshot,
  );
  const photo = useMemo(
    () => photos.find((item) => item.id === params.id) ?? null,
    [photos, params.id],
  );

  if (!photo) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">해당 사진을 찾을 수 없습니다.</p>
        <Link href="/view-photo">
          <Button>사진 목록으로</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-4 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          {photo.title || "제목 없는 사진"}
        </h1>
        <Link href="/view-photo">
          <Button variant="secondary">목록으로</Button>
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white p-3">
        <img
          src={photo.dataUrl}
          alt={photo.title || "사진"}
          className="mx-auto max-h-[70svh] w-auto max-w-full rounded object-contain"
          style={{
            transform: `rotate(${photo.edits.rotate}deg)`,
          }}
        />
      </div>

      {photo.memo && (
        <section className="rounded-lg border p-3">
          <h2 className="mb-1 text-sm font-medium">메모</h2>
          <p className="text-sm text-muted-foreground">{photo.memo}</p>
        </section>
      )}
    </main>
  );
}
