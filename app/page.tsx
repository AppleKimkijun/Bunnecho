"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addPhoto } from "@/lib/photo-store";

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
    overlay:
      "linear-gradient(180deg, rgba(255,172,220,0.24), rgba(255,255,255,0.05))",
  },
  {
    id: "prince",
    name: "왕자님 필터",
    cssFilter: "contrast(1.14) saturate(1.1) hue-rotate(8deg)",
    overlay:
      "linear-gradient(180deg, rgba(103,188,255,0.24), rgba(16,31,94,0.08))",
  },
  {
    id: "fishbowl",
    name: "어항 필터",
    cssFilter: "saturate(1.34) contrast(1.08) hue-rotate(16deg)",
    overlay:
      "radial-gradient(circle at center, rgba(109,226,255,0.06), rgba(0,97,176,0.34))",
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
    overlay:
      "linear-gradient(180deg, rgba(180,155,255,0.2), rgba(255,255,255,0.04))",
  },
  {
    id: "mint",
    name: "민트소다",
    cssFilter: "hue-rotate(24deg) saturate(1.22)",
    overlay:
      "linear-gradient(180deg, rgba(80,255,220,0.14), rgba(2,81,80,0.2))",
  },
  {
    id: "sunset",
    name: "노을빛",
    cssFilter: "brightness(1.05) saturate(1.25) hue-rotate(-16deg)",
    overlay:
      "linear-gradient(180deg, rgba(255,149,102,0.25), rgba(77,42,255,0.1))",
  },
  {
    id: "retro",
    name: "레트로",
    cssFilter: "sepia(0.32) contrast(1.15) saturate(0.88)",
    overlay:
      "linear-gradient(180deg, rgba(240,207,140,0.16), rgba(72,45,14,0.17))",
  },
  {
    id: "blackwhite",
    name: "흑백",
    cssFilter: "grayscale(1) contrast(1.16)",
    overlay:
      "linear-gradient(180deg, rgba(255,255,255,0.1), rgba(12,12,12,0.25))",
  },
  {
    id: "candy",
    name: "캔디",
    cssFilter: "saturate(1.4) hue-rotate(-12deg)",
    overlay:
      "linear-gradient(180deg, rgba(255,107,171,0.18), rgba(255,201,107,0.1))",
  },
  {
    id: "forest",
    name: "숲속",
    cssFilter: "hue-rotate(32deg) contrast(1.05)",
    overlay:
      "linear-gradient(180deg, rgba(93,189,120,0.2), rgba(15,75,34,0.24))",
  },
  {
    id: "neon",
    name: "네온",
    cssFilter: "contrast(1.22) saturate(1.42) hue-rotate(42deg)",
    overlay:
      "linear-gradient(180deg, rgba(28,255,242,0.15), rgba(248,27,255,0.12))",
  },
  {
    id: "cool",
    name: "쿨톤",
    cssFilter: "brightness(1.03) hue-rotate(12deg) saturate(1.1)",
    overlay:
      "linear-gradient(180deg, rgba(158,215,255,0.2), rgba(20,42,71,0.08))",
  },
  {
    id: "warm",
    name: "웜톤",
    cssFilter: "brightness(1.06) hue-rotate(-10deg) saturate(1.1)",
    overlay:
      "linear-gradient(180deg, rgba(255,198,126,0.2), rgba(97,54,18,0.12))",
  },
  {
    id: "grain",
    name: "필름그레인",
    cssFilter: "contrast(1.15) saturate(0.9)",
    overlay:
      "radial-gradient(circle, rgba(255,255,255,0.05), rgba(0,0,0,0.28))",
  },
  {
    id: "strawberry",
    name: "딸기우유",
    cssFilter: "brightness(1.08) saturate(1.26) hue-rotate(-18deg)",
    overlay:
      "linear-gradient(180deg, rgba(255,169,196,0.22), rgba(255,236,246,0.08))",
  },
  {
    id: "blueberry",
    name: "블루베리",
    cssFilter: "brightness(1.02) saturate(1.1) hue-rotate(22deg)",
    overlay:
      "linear-gradient(180deg, rgba(126,157,255,0.23), rgba(44,56,130,0.13))",
  },
  {
    id: "vintagepink",
    name: "빈티지핑크",
    cssFilter: "sepia(0.2) brightness(1.05) saturate(1.14)",
    overlay:
      "linear-gradient(180deg, rgba(230,155,186,0.2), rgba(76,38,55,0.1))",
  },
  {
    id: "moon",
    name: "달빛",
    cssFilter: "brightness(1.1) contrast(1.1) saturate(0.92)",
    overlay:
      "linear-gradient(180deg, rgba(201,225,255,0.2), rgba(14,26,55,0.2))",
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
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [permissionState, setPermissionState] = useState<
    "checking" | "prompt" | "requesting" | "granted" | "denied"
  >("checking");
  const [message, setMessage] = useState("카메라 권한을 확인하는 중입니다.");
  const [selectedFilterId, setSelectedFilterId] = useState("normal");
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [capturePhase, setCapturePhase] = useState<"idle" | "freeze" | "slide">(
    "idle",
  );
  const [showShutterFlash, setShowShutterFlash] = useState(false);

  const selectedFilter =
    CAMERA_FILTERS.find((filter) => filter.id === selectedFilterId) ??
    CAMERA_FILTERS[0];
  const pagedFilters = useMemo(() => chunkByTen(CAMERA_FILTERS), []);
  const showPermissionModal = permissionState !== "granted";
  const isDenied = permissionState === "denied";
  const isCapturingTransition = capturedFrame !== null;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setPermissionState("requesting");
    setMessage("카메라 권한을 요청하고 있습니다.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      setPermissionState("granted");
      setMessage("촬영 준비 완료");
    } catch {
      stopCamera();
      setPermissionState("denied");
      setMessage("카메라 권한이 거절되었습니다. 재시도해주세요.");
    }
  }, [stopCamera]);

  const checkPermissionAndInit = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setPermissionState("denied");
      setMessage("이 브라우저는 카메라를 지원하지 않습니다.");
      return;
    }

    try {
      const permissionsApi = navigator.permissions;
      if (!permissionsApi?.query) {
        setPermissionState("prompt");
        setMessage("카메라 권한 허용이 필요합니다.");
        return;
      }

      const status = await permissionsApi.query({
        name: "camera" as PermissionName,
      });
      if (status.state === "granted") {
        await startCamera();
        return;
      }

      if (status.state === "denied") {
        setPermissionState("denied");
        setMessage("카메라 권한이 거절되었습니다. 재시도해주세요.");
        return;
      }

      setPermissionState("prompt");
      setMessage("카메라 권한 허용이 필요합니다.");
    } catch {
      setPermissionState("prompt");
      setMessage("카메라 권한 허용이 필요합니다.");
    }
  }, [startCamera]);

  const playShutterSound = useCallback(() => {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      380,
      audioContext.currentTime + 0.08,
    );

    gain.gain.setValueAtTime(0.001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.25,
      audioContext.currentTime + 0.01,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.12,
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.12);

    window.setTimeout(() => {
      void audioContext.close();
    }, 200);
  }, []);

  const capturePhoto = useCallback(() => {
    if (isCapturingTransition) {
      return;
    }

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
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    addPhoto(dataUrl);
    setCapturedFrame(dataUrl);
    setCapturePhase("freeze");
    setShowShutterFlash(true);
    setMessage("찰칵");
    playShutterSound();

    window.setTimeout(() => {
      setShowShutterFlash(false);
    }, 70);

    window.setTimeout(() => {
      setCapturePhase("slide");
    }, 300);

    window.setTimeout(() => {
      router.replace("/view-photo");
    }, 980);
  }, [
    cameraActive,
    isCapturingTransition,
    playShutterSound,
    router,
    selectedFilter.cssFilter,
  ]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void checkPermissionAndInit();
      router.prefetch("/view-photo");
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      stopCamera();
    };
  }, [checkPermissionAndInit, router, stopCamera]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      capturePhoto();
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
        className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ${
          isDenied ? "opacity-0" : "opacity-100"
        }`}
        style={{
          filter: selectedFilter.cssFilter,
          transform: "scaleX(-1)",
        }}
        muted
        playsInline
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isDenied ? "rgba(0,0,0,1)" : selectedFilter.overlay,
          boxShadow: "inset 0 0 120px rgba(0,0,0,0.35)",
        }}
      />

      {showShutterFlash && (
        <div className="pointer-events-none absolute inset-0 z-30 animate-pulse bg-white/85" />
      )}

      {capturedFrame && (
        <div
          className={`pointer-events-none absolute inset-0 z-40 transition-all ${
            capturePhase === "freeze"
              ? "duration-300 ease-out scale-[0.988] opacity-100"
              : capturePhase === "slide"
                ? "duration-700 ease-[cubic-bezier(0.22,0.8,0.2,1)] translate-x-[116%] scale-[0.985] opacity-0"
                : "duration-150 ease-linear scale-100 opacity-100"
          }`}
        >
          <img
            src={capturedFrame}
            alt="방금 촬영한 사진"
            className="h-full w-full object-cover"
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/55 px-4 py-2 text-lg font-semibold text-white">
            찰칵
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 z-10 bg-linear-to-b from-black/70 to-transparent px-4 pb-8 pt-4 md:px-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Bunnecho Camera
          </h1>
          <p className="mt-1 text-xs text-white/80 md:text-sm">{message}</p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-black/85 via-black/60 to-transparent px-3 pb-3 pt-12 md:px-6 md:pb-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
          <div className="flex items-center justify-end gap-3">
            <div className="rounded-full border border-white/35 bg-black/35 px-3 py-1 text-xs">
              엔터로 촬영
            </div>
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
        </div>
      </div>

      {showPermissionModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-black/85 p-5 text-white">
            <h2 className="text-lg font-semibold">카메라 권한 필요</h2>
            <p className="mt-2 text-sm text-white/85">
              {isDenied
                ? "권한이 거절되어 화면이 검게 표시됩니다. 아래 버튼으로 다시 시도해주세요."
                : "촬영을 위해 카메라 권한을 허용해주세요."}
            </p>
            <button
              onClick={startCamera}
              type="button"
              className="mt-4 w-full rounded-md bg-white py-2 text-black transition hover:bg-white/90"
              disabled={permissionState === "requesting"}
            >
              {permissionState === "requesting"
                ? "권한 요청 중..."
                : "카메라 권한 재시도"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
