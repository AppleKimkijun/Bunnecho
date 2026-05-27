"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  getPhotosServerSnapshot,
  listPhotos,
  removePhoto,
  subscribePhotos,
  updatePhoto,
  type StoredPhoto,
} from "@/lib/photo-store";

function photoStyle(photo: StoredPhoto) {
  const { brightness, contrast, saturate, rotate } = photo.edits;
  return {
    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`,
    transform: `rotate(${rotate}deg)`,
  };
}

export default function ViewPhotoPage() {
  const photos = useSyncExternalStore(
    subscribePhotos,
    listPhotos,
    getPhotosServerSnapshot,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    photoId: string;
    title: string;
    memo: string;
    brightness: number;
    contrast: number;
    saturate: number;
    rotate: number;
  } | null>(null);

  const activeId = selectedId ?? photos[0]?.id ?? null;

  const selectedPhoto = useMemo(
    () => photos.find((photo) => photo.id === activeId) ?? null,
    [photos, activeId],
  );

  const currentDraft = selectedPhoto
    ? draft?.photoId === selectedPhoto.id
      ? draft
      : {
          photoId: selectedPhoto.id,
          title: selectedPhoto.title,
          memo: selectedPhoto.memo,
          brightness: selectedPhoto.edits.brightness,
          contrast: selectedPhoto.edits.contrast,
          saturate: selectedPhoto.edits.saturate,
          rotate: selectedPhoto.edits.rotate,
        }
    : null;

  function saveEdit() {
    if (!selectedPhoto) {
      return;
    }

    updatePhoto(selectedPhoto.id, {
      title: currentDraft?.title ?? selectedPhoto.title,
      memo: currentDraft?.memo ?? selectedPhoto.memo,
      edits: {
        brightness: currentDraft?.brightness ?? selectedPhoto.edits.brightness,
        contrast: currentDraft?.contrast ?? selectedPhoto.edits.contrast,
        saturate: currentDraft?.saturate ?? selectedPhoto.edits.saturate,
        rotate: currentDraft?.rotate ?? selectedPhoto.edits.rotate,
      },
    });
  }

  function deleteSelected() {
    if (!selectedPhoto) {
      return;
    }
    removePhoto(selectedPhoto.id);
    setSelectedId(null);
    setDraft(null);
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          사진 편집/보기
        </h1>
        <Link href="/">
          <Button variant="secondary">촬영 페이지로</Button>
        </Link>
      </div>

      <section className="grid gap-6 md:grid-cols-[280px_1fr]">
        <aside className="space-y-3 rounded-xl border p-3">
          <h2 className="text-sm font-medium">사진 리스트 ({photos.length})</h2>
          <div className="max-h-[70svh] space-y-2 overflow-auto pr-1">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => {
                  setSelectedId(photo.id);
                  setDraft(null);
                }}
                className={`w-full rounded-lg border p-2 text-left transition ${
                  activeId === photo.id
                    ? "border-primary bg-accent"
                    : "border-border"
                }`}
              >
                <img
                  src={photo.dataUrl}
                  alt="저장된 사진"
                  className="aspect-video w-full rounded object-cover"
                />
                <p className="mt-2 truncate text-sm font-medium">
                  {photo.title || "제목 없음"}
                </p>
              </button>
            ))}
            {photos.length === 0 && (
              <p className="text-sm text-muted-foreground">
                저장된 사진이 없습니다.
              </p>
            )}
          </div>
        </aside>

        <section className="space-y-4 rounded-xl border p-4">
          {selectedPhoto ? (
            <>
              <div className="overflow-hidden rounded-lg border bg-black/70 p-2">
                <img
                  src={selectedPhoto.dataUrl}
                  alt="선택한 사진"
                  className="mx-auto max-h-[50svh] w-auto max-w-full rounded object-contain"
                  style={photoStyle({
                    ...selectedPhoto,
                    title: currentDraft?.title ?? selectedPhoto.title,
                    memo: currentDraft?.memo ?? selectedPhoto.memo,
                    edits: {
                      brightness:
                        currentDraft?.brightness ??
                        selectedPhoto.edits.brightness,
                      contrast:
                        currentDraft?.contrast ?? selectedPhoto.edits.contrast,
                      saturate:
                        currentDraft?.saturate ?? selectedPhoto.edits.saturate,
                      rotate:
                        currentDraft?.rotate ?? selectedPhoto.edits.rotate,
                    },
                  })}
                />
              </div>

              <div className="grid gap-3">
                <label className="grid gap-1 text-sm">
                  제목
                  <input
                    value={currentDraft?.title ?? ""}
                    onChange={(event) =>
                      setDraft((prev) => {
                        const base =
                          prev && prev.photoId === selectedPhoto.id
                            ? prev
                            : {
                                photoId: selectedPhoto.id,
                                title: selectedPhoto.title,
                                memo: selectedPhoto.memo,
                                brightness: selectedPhoto.edits.brightness,
                                contrast: selectedPhoto.edits.contrast,
                                saturate: selectedPhoto.edits.saturate,
                                rotate: selectedPhoto.edits.rotate,
                              };

                        return { ...base, title: event.target.value };
                      })
                    }
                    className="h-10 rounded-md border bg-background px-3"
                    placeholder="사진 제목"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  메모
                  <textarea
                    value={currentDraft?.memo ?? ""}
                    onChange={(event) =>
                      setDraft((prev) => {
                        const base =
                          prev && prev.photoId === selectedPhoto.id
                            ? prev
                            : {
                                photoId: selectedPhoto.id,
                                title: selectedPhoto.title,
                                memo: selectedPhoto.memo,
                                brightness: selectedPhoto.edits.brightness,
                                contrast: selectedPhoto.edits.contrast,
                                saturate: selectedPhoto.edits.saturate,
                                rotate: selectedPhoto.edits.rotate,
                              };

                        return { ...base, memo: event.target.value };
                      })
                    }
                    className="min-h-20 rounded-md border bg-background p-3"
                    placeholder="사진 메모"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  밝기 ({currentDraft?.brightness ?? 100}%)
                  <input
                    type="range"
                    min={50}
                    max={150}
                    value={currentDraft?.brightness ?? 100}
                    onChange={(event) =>
                      setDraft((prev) => {
                        const base =
                          prev && prev.photoId === selectedPhoto.id
                            ? prev
                            : {
                                photoId: selectedPhoto.id,
                                title: selectedPhoto.title,
                                memo: selectedPhoto.memo,
                                brightness: selectedPhoto.edits.brightness,
                                contrast: selectedPhoto.edits.contrast,
                                saturate: selectedPhoto.edits.saturate,
                                rotate: selectedPhoto.edits.rotate,
                              };

                        return {
                          ...base,
                          brightness: Number(event.target.value),
                        };
                      })
                    }
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  대비 ({currentDraft?.contrast ?? 100}%)
                  <input
                    type="range"
                    min={50}
                    max={150}
                    value={currentDraft?.contrast ?? 100}
                    onChange={(event) =>
                      setDraft((prev) => {
                        const base =
                          prev && prev.photoId === selectedPhoto.id
                            ? prev
                            : {
                                photoId: selectedPhoto.id,
                                title: selectedPhoto.title,
                                memo: selectedPhoto.memo,
                                brightness: selectedPhoto.edits.brightness,
                                contrast: selectedPhoto.edits.contrast,
                                saturate: selectedPhoto.edits.saturate,
                                rotate: selectedPhoto.edits.rotate,
                              };

                        return {
                          ...base,
                          contrast: Number(event.target.value),
                        };
                      })
                    }
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  채도 ({currentDraft?.saturate ?? 100}%)
                  <input
                    type="range"
                    min={0}
                    max={200}
                    value={currentDraft?.saturate ?? 100}
                    onChange={(event) =>
                      setDraft((prev) => {
                        const base =
                          prev && prev.photoId === selectedPhoto.id
                            ? prev
                            : {
                                photoId: selectedPhoto.id,
                                title: selectedPhoto.title,
                                memo: selectedPhoto.memo,
                                brightness: selectedPhoto.edits.brightness,
                                contrast: selectedPhoto.edits.contrast,
                                saturate: selectedPhoto.edits.saturate,
                                rotate: selectedPhoto.edits.rotate,
                              };

                        return {
                          ...base,
                          saturate: Number(event.target.value),
                        };
                      })
                    }
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  회전 ({currentDraft?.rotate ?? 0}deg)
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={currentDraft?.rotate ?? 0}
                    onChange={(event) =>
                      setDraft((prev) => {
                        const base =
                          prev && prev.photoId === selectedPhoto.id
                            ? prev
                            : {
                                photoId: selectedPhoto.id,
                                title: selectedPhoto.title,
                                memo: selectedPhoto.memo,
                                brightness: selectedPhoto.edits.brightness,
                                contrast: selectedPhoto.edits.contrast,
                                saturate: selectedPhoto.edits.saturate,
                                rotate: selectedPhoto.edits.rotate,
                              };

                        return {
                          ...base,
                          rotate: Number(event.target.value),
                        };
                      })
                    }
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={saveEdit} type="button">
                  편집 저장
                </Button>
                <Button
                  onClick={deleteSelected}
                  type="button"
                  variant="destructive"
                >
                  삭제
                </Button>
                <Link href={`/photos/${selectedPhoto.id}`}>
                  <Button type="button" variant="secondary">
                    단일 보기 페이지
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              좌측 리스트에서 사진을 선택하세요.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
