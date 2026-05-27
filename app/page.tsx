"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import {
  addPhoto,
  getPhotosServerSnapshot,
  listPhotos,
  subscribePhotos,
} from "@/lib/photo-store";

type CameraFilter = {
  id: string;
  name: string;
  cssFilter: string;
  overlay: string;
};

const CAMERA_FILTERS: CameraFilter[] = [
  { id: "normal", name: "기본", cssFilter: "none", overlay: "transparent" },
  {
    id: "princess",
    name: "공주 필터",
    cssFilter: "brightness(1.12) saturate(1.2) hue-rotate(-8deg)",
    overlay: "linear-gradient(180deg, rgba(255,172,220,0.24), rgba(255,255,255,0.05))",
  },
  {
    id: "prince",
    name: "왕자님 필터",
    cssFilter: "contrast(1.14) saturate(1.1) hue-rotate(8deg)",
    overlay: "linear-gradient(180deg, rgba(103,188,255,0.24), rgba(16,31,94,0.08))",
  },
  {
    id: "fishbowl",
    name: "어항 필터",
    cssFilter: "saturate(1.34) contrast(1.08) hue-rotate(16deg)",
    overlay: "radial-gradient(circle at center, rgba(109,226,255,0.06), rgba(0,97,176,0.34))",
  },
  {
    id: "movie",
    name: "영화관 필터",
    cssFilter: "contrast(1.28) saturate(0.86)",
    overlay: "linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.36))",
  },
  {
    id: "dream",
    name: "꿈속 필터",
    cssFilter: "brightness(1.07) blur(0.3px) saturate(1.22)",
    overlay: "linear-gradient(180deg, rgba(180,155,255,0.2), rgba(255,255,255,0.04))",
  },
  {
    id: "mint",
    name: "민트소다",
    cssFilter: "hue-rotate(24deg) saturate(1.22)",
    overlay: "linear-gradient(180deg, rgba(80,255,220,0.14), rgba(2,81,80,0.2))",
  },
  {
    id: "sunset",
    name: "노을빛",
    cssFilter: "brightness(1.05) saturate(1.25) hue-rotate(-16deg)",
    overlay: "linear-gradient(180deg, rgba(255,149,102,0.25), rgba(77,42,255,0.1))",
  },
  {
    id: "retro",
    name: "레트로",
    cssFilter: "sepia(0.32) contrast(1.15) saturate(0.88)",
    overlay: "linear-gradient(180deg, rgba(240,207,140,0.16), rgba(72,45,14,0.17))",
  },
  {
    id: "blackwhite",
    name: "흑백",
    cssFilter: "grayscale(1) contrast(1.16)",
    overlay: "linear-gradient(180deg, rgba(255,255,255,0.1), rgba(12,12,12,0.25))",
  },
  {
    id: "candy",
    name: "캔디",
    cssFilter: "saturate(1.4) hue-rotate(-12deg)",
    overlay: "linear-gradient(180deg, rgba(255,107,171,0.18), rgba(255,201,107,0.1))",
  },
  {
    id: "forest",
    name: "숲속",
    cssFilter: "hue-rotate(32deg) contrast(1.05)",
    overlay: "linear-gradient(180deg, rgba(93,189,120,0.2), rgba(15,75,34,0.24))",
  },
  {
    id: "neon",
    name: "네온",
    cssFilter: "contrast(1.22) saturate(1.42) hue-rotate(42deg)",
    overlay: "linear-gradient(180deg, rgba(28,255,242,0.15), rgba(248,27,255,0.12))",
  },
  {
    id: "cool",
    name: "쿨톤",
    cssFilter: "brightness(1.03) hue-rotate(12deg) saturate(1.1)",
    overlay: "linear-gradient(180deg, rgba(158,215,255,0.2), rgba(20,42,71,0.08))",
  },
  {
    id: "warm",
    name: "웜톤",
    cssFilter: "brightness(1.06) hue-rotate(-10deg) saturate(1.1)",
    overlay: "linear-gradient(180deg, rgba(255,198,126,0.2), rgba(97,54,18,0.12))",
  },
  {
    id: "grain",
    name: "필름그레인",
    cssFilter: "contrast(1.15) saturate(0.9)",
    overlay: "radial-gradient(circle, rgba(255,255,255,0.05), rgba(0,0,0,0.28))",
  },
  {
    id: "strawberry",
    name: "딸기우유",
    cssFilter: "brightness(1.08) saturate(1.26) hue-rotate(-18deg)",
    overlay: "linear-gradient(180deg, rgba(255,169,196,0.22), rgba(255,236,246,0.08))",
  },
  {
    id: "blueberry",
    name: "블루베리",
    cssFilter: "brightness(1.02) saturate(1.1) hue-rotate(22deg)",
    overlay: "linear-gradient(180deg, rgba(126,157,255,0.23), rgba(44,56,130,0.13))",
  },
  {
    id: "vintagepink",
    name: "빈티지핑크",
    cssFilter: "sepia(0.2) brightness(1.05) saturate(1.14)",
    overlay: "linear-gradient(180deg, rgba(230,155,186,0.2), rgba(76,38,55,0.1))",
  },
  {
    id: "moon",
    name: "달빛",
    cssFilter: "brightness(1.1) contrast(1.1) saturate(0.92)",
    overlay: "linear-gradient(180deg, rgba(201,225,255,0.2), rgba(14,26,55,0.2))",
  },
];

function chunkByTen<T>(items: T[]) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += 10) {
    result.push(items.slice(index, index + 10));
  }
  return result;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const photos = useSyncExternalStore(
    subscribePhotos,
    listPhotos,
    getPhotosServerSnapshot,
  );
  const [lastCaptured, setLastCaptured] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [message, setMessage] = useState("카메라 권한을 확인하는 중입니다.");
  const [selectedFilterId, setSelectedFilterId] = useState("normal");

  const selectedFilter =
    CAMERA_FILTERS.find((filter) => filter.id === selectedFilterId) ??
    CAMERA_FILTERS[0];
  const pagedFilters = useMemo(() => chunkByTen(CAMERA_FILTERS), []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      setPermissionDenied(false);
      setMessage("촬영 준비 완료. 엔터를 누르거나 버튼으로 촬영하세요.");
    } catch {
      stopCamera();
      setCameraActive(false);
      setPermissionDenied(true);
      setMessage("카메라 권한이 필요합니다. 권한 허용 후 다시 시도해주세요.");
    }
  }, [stopCamera]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !cameraActive) {
      setMessage("카메라 권한을 허용한 뒤 촬영할 수 있어요.");
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      setMessage("카메라 화면이 아직 준비되지 않았습니다.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      setMessage("사진 캡처에 실패했습니다.");
      return;
    }

    context.filter = selectedFilter.cssFilter;
    context.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    addPhoto(dataUrl);
    setLastCaptured(dataUrl);
    setMessage(`${selectedFilter.name}로 촬영 완료. 편집 페이지에서 확인해보세요.`);
  }, [cameraActive, selectedFilter.cssFilter, selectedFilter.name]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void startCamera();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        capturePhoto();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [capturePhoto]);

  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-black text-white">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: selectedFilter.cssFilter }}
        muted
        playsInline
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: selectedFilter.overlay,
          boxShadow: "inset 0 0 120px rgba(0,0,0,0.35)",
        }}
      />

      <div className="absolute inset-x-0 top-0 z-10 bg-linear-to-b from-black/70 to-transparent px-4 pb-8 pt-4 md:px-8">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Bunnecho Camera</h1>
            <p className="mt-1 text-xs text-white/80 md:text-sm">{message}</p>
          </div>
          <Link href="/view-photo">
            <Button className="bg-white text-black hover:bg-white/90">
              사진 보기 ({photos.length})
            </Button>
          </Link>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-black/85 via-black/60 to-transparent px-3 pb-3 pt-12 md:px-6 md:pb-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
          {permissionDenied && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/30 bg-black/40 p-2">
              <Button
                onClick={startCamera}
                type="button"
                className="bg-white text-black hover:bg-white/90"
              >
                카메라 권한 다시 요청
              </Button>
              <span className="text-xs text-white/80">
                이미 권한이 있는 경우에는 팝업 없이 바로 카메라가 열립니다.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button
              onClick={capturePhoto}
              type="button"
              disabled={!cameraActive}
              className="h-12 min-w-36 rounded-full bg-white text-base font-semibold text-black hover:bg-white/90"
            >
              촬영 (Enter)
            </Button>
            <div className="rounded-full border border-white/35 bg-black/35 px-3 py-1 text-xs">
              현재 필터: {selectedFilter.name}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/25 bg-black/45 p-2">
            <div className="flex w-full snap-x snap-mandatory">
              {pagedFilters.map((group, pageIndex) => (
                <div
                  key={`filter-page-${pageIndex}`}
                  className="grid min-w-full snap-start grid-cols-5 gap-2 md:grid-cols-10"
                >
                  {group.map((filter) => {
                    const selected = filter.id === selectedFilter.id;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setSelectedFilterId(filter.id)}
                        className={`rounded-lg border px-2 py-2 text-[11px] leading-tight transition md:text-xs ${
                          selected
                            ? "border-white bg-white text-black"
                            : "border-white/35 bg-black/35 text-white hover:bg-white/15"
                        }`}
                      >
                        {filter.name}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-white/80 md:text-xs">
            아래 필터 목록은 10개 단위 페이지입니다. 좌우로 스크롤해서 더 많은 필터를 선택하세요.
          </p>

          {lastCaptured && (
            <div className="rounded-lg border border-white/25 bg-black/45 p-2">
              <p className="mb-2 text-xs text-white/80">최근 촬영 썸네일</p>
              <img
                src={lastCaptured}
                alt="최근 촬영 사진"
                className="h-18 w-24 rounded-md object-cover"
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
