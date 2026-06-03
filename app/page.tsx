"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addPhoto } from "@/lib/photo-store";
import { upsertRawPhoto } from "@/lib/photo-raw-store";
import { detectFacesInVideo, type FaceBox } from "@/lib/face-detection";
import { PARTICLE_COLOR_PALETTE } from "@/lib/particle-colors";

type CameraFilter = {
  id: string;
  name: string;
  cssFilter: string;
  overlay: string;
};

type ParticlePreset = {
  id: string;
  name: string;
  imageSrc: string | null;
  count: number;
  sizeRange: [number, number];
  durationRangeMs: [number, number];
  swayRangePx: [number, number];
  swayCyclesPerFallRange: [number, number];
  spinDegPerSecRange: [number, number];
  opacityRange: [number, number];
};

type ParticleSeed = {
  xRatio: number;
  offsetMs: number;
  durationMs: number;
  sizePx: number;
  swayPx: number;
  swayCyclesPerFall: number;
  swayPhase: number;
  spinStartDeg: number;
  spinDegPerSec: number;
  opacity: number;
  color: string;
  imageSrc: string;
};

type RenderedParticle = {
  x: number;
  y: number;
  sizePx: number;
  rotationDeg: number;
  opacity: number;
  color: string;
  imageSrc: string;
};

const CAMERA_FILTERS: CameraFilter[] = [
  {
    id: "bunny",
    name: "버니 필터",
    cssFilter: "brightness(1.05) saturate(1.12)",
    overlay:
      "linear-gradient(180deg, rgba(255,189,214,0.2), rgba(255,255,255,0.06))",
  },
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

const BUNNY_FRAME_URL = "/img/frame/bunny.png";
const BUNNY_BOTTOM_OFFSET_FACE_RATIO = 0.15;
const BUNNY_FRAME_SCALE = 2.2;
const TWO_PI = Math.PI * 2;

const PARTICLE_PRESETS: ParticlePreset[] = [
  {
    id: "none",
    name: "없음",
    imageSrc: null,
    count: 0,
    sizeRange: [0, 0],
    durationRangeMs: [0, 0],
    swayRangePx: [0, 0],
    swayCyclesPerFallRange: [0, 0],
    spinDegPerSecRange: [0, 0],
    opacityRange: [0, 0],
  },
  {
    id: "star",
    name: "별",
    imageSrc: "/img/particle/star.png",
    count: 28,
    sizeRange: [46, 86],
    durationRangeMs: [6500, 9800],
    swayRangePx: [6, 22],
    swayCyclesPerFallRange: [0.8, 1.8],
    spinDegPerSecRange: [-42, 42],
    opacityRange: [0.65, 0.96],
  },
  {
    id: "apple",
    name: "사과",
    imageSrc: "/img/particle/apple.png",
    count: 28,
    sizeRange: [46, 86],
    durationRangeMs: [6500, 9800],
    swayRangePx: [6, 22],
    swayCyclesPerFallRange: [0.8, 1.8],
    spinDegPerSecRange: [-42, 42],
    opacityRange: [0.65, 0.96],
  },
  {
    id: "bunny",
    name: "토끼",
    imageSrc: "/img/particle/bunny.png.png",
    count: 28,
    sizeRange: [46, 86],
    durationRangeMs: [6500, 9800],
    swayRangePx: [6, 22],
    swayCyclesPerFallRange: [0.8, 1.8],
    spinDegPerSecRange: [-42, 42],
    opacityRange: [0.65, 0.96],
  },
  {
    id: "rose",
    name: "장미",
    imageSrc: "/img/particle/rose.png",
    count: 28,
    sizeRange: [46, 86],
    durationRangeMs: [6500, 9800],
    swayRangePx: [6, 22],
    swayCyclesPerFallRange: [0.8, 1.8],
    spinDegPerSecRange: [-42, 42],
    opacityRange: [0.65, 0.96],
  },
  {
    id: "note",
    name: "음표",
    imageSrc: "/img/particle/note.png",
    count: 28,
    sizeRange: [46, 86],
    durationRangeMs: [6500, 9800],
    swayRangePx: [6, 22],
    swayCyclesPerFallRange: [0.8, 1.8],
    spinDegPerSecRange: [-42, 42],
    opacityRange: [0.65, 0.96],
  },
];

type OverlayRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function getFrameBox(face: FaceBox) {
  const size = Math.max(face.width, face.height) * BUNNY_FRAME_SCALE;
  const x = face.x + face.width / 2 - size / 2;
  const y =
    face.y + face.height - size + face.height * BUNNY_BOTTOM_OFFSET_FACE_RATIO;
  return { x, y, width: size, height: size };
}

function chunkByTen<T>(items: T[]) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += 10) {
    result.push(items.slice(index, index + 10));
  }
  return result;
}

function mapVideoRectToViewport(
  rect: OverlayRect,
  videoWidth: number,
  videoHeight: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const scale = Math.max(
    viewportWidth / videoWidth,
    viewportHeight / videoHeight,
  );
  const renderWidth = videoWidth * scale;
  const renderHeight = videoHeight * scale;
  const offsetX = (viewportWidth - renderWidth) / 2;
  const offsetY = (viewportHeight - renderHeight) / 2;

  const xMirrored = viewportWidth - (offsetX + (rect.x + rect.width) * scale);

  return {
    x: xMirrored,
    y: offsetY + rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function shuffledRatios(count: number) {
  const ratios = Array.from({ length: count }, (_, index) =>
    (index + 0.5) / count,
  );

  for (let index = ratios.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = ratios[index];
    ratios[index] = ratios[swapIndex];
    ratios[swapIndex] = temp;
  }

  return ratios;
}

function createParticleSeeds(preset: ParticlePreset): ParticleSeed[] {
  if (preset.id === "none" || !preset.imageSrc) {
    return [];
  }

  const imageSrc = preset.imageSrc;

  const xRatios = shuffledRatios(preset.count);
  const timeRatios = shuffledRatios(preset.count);

  return Array.from({ length: preset.count }, (_, index) => {
    const color =
      PARTICLE_COLOR_PALETTE[
        Math.floor(Math.random() * PARTICLE_COLOR_PALETTE.length)
      ];
    const xRatio = clamp(xRatios[index] + randomBetween(-0.05, 0.05), 0.04, 0.96);
    const phaseDuration = randomBetween(
      preset.durationRangeMs[0],
      preset.durationRangeMs[1],
    );
    const offsetMs =
      timeRatios[index] * phaseDuration + randomBetween(-180, 180);

    return {
      xRatio,
      offsetMs,
      durationMs: phaseDuration,
      sizePx: randomBetween(preset.sizeRange[0], preset.sizeRange[1]),
      swayPx: randomBetween(preset.swayRangePx[0], preset.swayRangePx[1]),
      swayCyclesPerFall: randomBetween(
        preset.swayCyclesPerFallRange[0],
        preset.swayCyclesPerFallRange[1],
      ),
      swayPhase: randomBetween(0, TWO_PI),
      spinStartDeg: randomBetween(0, 360),
      spinDegPerSec: randomBetween(
        preset.spinDegPerSecRange[0],
        preset.spinDegPerSecRange[1],
      ),
      opacity: randomBetween(preset.opacityRange[0], preset.opacityRange[1]),
      color,
      imageSrc,
    };
  });
}

function mapParticlesToViewport(
  seeds: ParticleSeed[],
  elapsedMs: number,
  viewportWidth: number,
  viewportHeight: number,
): RenderedParticle[] {
  if (viewportWidth <= 0 || viewportHeight <= 0 || seeds.length === 0) {
    return [];
  }

  return seeds.map((seed) => {
    const progress = ((elapsedMs + seed.offsetMs) % seed.durationMs) / seed.durationMs;
    const sway =
      Math.sin(progress * seed.swayCyclesPerFall * TWO_PI + seed.swayPhase) *
      seed.swayPx;
    // Snow-like fall: slow near top, faster near bottom.
    const easedProgress = Math.pow(progress, 1.85);
    const fadeStart = 0.8;
    const fadeProgress = clamp((progress - fadeStart) / (1 - fadeStart), 0, 1);
    const opacity = seed.opacity * Math.pow(1 - fadeProgress, 1.85);
    const x = seed.xRatio * viewportWidth + sway;
    const y = -seed.sizePx + easedProgress * (viewportHeight + seed.sizePx * 2);
    const rotationDeg = seed.spinStartDeg + (elapsedMs / 1000) * seed.spinDegPerSec;

    return {
      x,
      y,
      sizePx: seed.sizePx,
      rotationDeg,
      opacity,
      color: seed.color,
      imageSrc: seed.imageSrc,
    };
  });
}

function drawTintedParticle(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  particle: RenderedParticle,
) {
  const size = Math.max(1, particle.sizePx);
  const sourceWidth = Math.max(1, image.naturalWidth || image.width || 1);
  const sourceHeight = Math.max(1, image.naturalHeight || image.height || 1);
  const tintCanvas = document.createElement("canvas");
  tintCanvas.width = sourceWidth;
  tintCanvas.height = sourceHeight;
  const tintCtx = tintCanvas.getContext("2d");
  if (!tintCtx) {
    return;
  }

  tintCtx.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  tintCtx.globalCompositeOperation = "source-in";
  tintCtx.fillStyle = particle.color;
  tintCtx.fillRect(0, 0, sourceWidth, sourceHeight);
  tintCtx.globalCompositeOperation = "source-over";

  ctx.save();
  ctx.globalAlpha = particle.opacity;
  ctx.translate(particle.x, particle.y);
  ctx.rotate((particle.rotationDeg * Math.PI) / 180);
  ctx.drawImage(tintCanvas, -size / 2, -size / 2, size, size);
  ctx.restore();
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
  const [selectedFilterId, setSelectedFilterId] = useState("bunny");
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [capturePhase, setCapturePhase] = useState<"idle" | "freeze" | "slide">(
    "idle",
  );
  const [showShutterFlash, setShowShutterFlash] = useState(false);
  const [overlayRects, setOverlayRects] = useState<OverlayRect[]>([]);
  const [mappedOverlays, setMappedOverlays] = useState<OverlayRect[]>([]);
  const [selectedParticleId, setSelectedParticleId] = useState<
    ParticlePreset["id"]
  >("none");
  const [particleElapsedMs, setParticleElapsedMs] = useState(0);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const frameImageRef = useRef<HTMLImageElement | null>(null);
  const particleAnimationStartRef = useRef(0);
  const overlayImageRefs = useRef<Array<HTMLImageElement | null>>([]);
  const particleNodeRefs = useRef<Array<HTMLDivElement | null>>([]);
  const particleImageMapRef = useRef<Record<string, HTMLImageElement>>({});

  const selectedFilter =
    CAMERA_FILTERS.find((filter) => filter.id === selectedFilterId) ??
    CAMERA_FILTERS[0];
  const selectedParticlePreset =
    PARTICLE_PRESETS.find((particle) => particle.id === selectedParticleId) ??
    PARTICLE_PRESETS[0];
  const pagedFilters = useMemo(() => chunkByTen(CAMERA_FILTERS), []);
  const isBunnyFilter = selectedFilter.id === "bunny";
  const showPermissionModal = permissionState !== "granted";
  const isDenied = permissionState === "denied";
  const isCapturingTransition = capturedFrame !== null;
  const particleSeeds = useMemo(
    () => createParticleSeeds(selectedParticlePreset),
    [selectedParticlePreset],
  );
  const renderedParticles = useMemo(
    () =>
      mapParticlesToViewport(
        particleSeeds,
        particleElapsedMs,
        viewportSize.width,
        viewportSize.height,
      ),
    [particleElapsedMs, particleSeeds, viewportSize.height, viewportSize.width],
  );

  useEffect(() => {
    overlayImageRefs.current = overlayImageRefs.current.slice(
      0,
      mappedOverlays.length,
    );
  }, [mappedOverlays.length]);

  useEffect(() => {
    particleNodeRefs.current = particleNodeRefs.current.slice(
      0,
      renderedParticles.length,
    );
  }, [renderedParticles.length]);

  useEffect(() => {
    const image = new Image();
    image.src = BUNNY_FRAME_URL;
    frameImageRef.current = image;

    PARTICLE_PRESETS.forEach((preset) => {
      if (!preset.imageSrc) {
        return;
      }

      const particleImage = new Image();
      particleImage.src = preset.imageSrc;
      particleImageMapRef.current[preset.imageSrc] = particleImage;
    });
  }, []);

  useEffect(() => {
    const updateViewportSize = () => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      setViewportSize({
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);

    return () => {
      window.removeEventListener("resize", updateViewportSize);
    };
  }, []);

  useEffect(() => {
    if (selectedParticlePreset.id === "none") {
      setParticleElapsedMs(0);
      particleAnimationStartRef.current = 0;
      return;
    }

    let animationFrameId = 0;
    let lastFrameTime = 0;
    particleAnimationStartRef.current = performance.now();

    const animate = (now: number) => {
      if (now - lastFrameTime >= 30) {
        setParticleElapsedMs(now - particleAnimationStartRef.current);
        lastFrameTime = now;
      }

      animationFrameId = window.requestAnimationFrame(animate);
    };

    animationFrameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [selectedParticlePreset.id]);

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

  useEffect(() => {
    if (!cameraActive || !isBunnyFilter) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    let isRunning = true;
    const intervalId = window.setInterval(() => {
      void detectFacesInVideo(video).then((detectedFace) => {
        if (!isRunning) {
          return;
        }

        if (!detectedFace || detectedFace.length === 0) {
          setOverlayRects([]);
          return;
        }

        const sorted = [...detectedFace]
          .sort((a, b) => b.width * b.height - a.width * a.height)
          .slice(0, 6);

        setOverlayRects(sorted.map((face) => getFrameBox(face)));
      });
    }, 220);

    return () => {
      isRunning = false;
      window.clearInterval(intervalId);
    };
  }, [cameraActive, isBunnyFilter]);

  useEffect(() => {
    const updateMapped = () => {
      const video = videoRef.current;
      const viewport = viewportRef.current;

      if (
        overlayRects.length === 0 ||
        !video ||
        !viewport ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        setMappedOverlays([]);
        return;
      }

      setMappedOverlays(
        overlayRects.map((rect) =>
          mapVideoRectToViewport(
            rect,
            video.videoWidth,
            video.videoHeight,
            viewport.clientWidth,
            viewport.clientHeight,
          ),
        ),
      );
    };

    updateMapped();
    window.addEventListener("resize", updateMapped);
    return () => {
      window.removeEventListener("resize", updateMapped);
    };
  }, [overlayRects]);

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

    const viewport = viewportRef.current;
    const outWidth = viewport?.clientWidth ?? width;
    const outHeight = viewport?.clientHeight ?? height;
    if (!outWidth || !outHeight) {
      setMessage("사진 캡처에 실패했습니다.");
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    if (!viewportRect || !viewport) {
      setMessage("사진 캡처에 실패했습니다.");
      return;
    }

    const overlaySnapshot = overlayImageRefs.current
      .map((overlayImage) => {
        if (!overlayImage) {
          return null;
        }

        const rect = overlayImage.getBoundingClientRect();
        return {
          x: rect.left - viewportRect.left,
          y: rect.top - viewportRect.top,
          width: rect.width,
          height: rect.height,
        } satisfies OverlayRect;
      })
      .filter((item): item is OverlayRect => item !== null);

    const particleSnapshot = particleNodeRefs.current
      .map((particleNode) => {
        if (!particleNode) {
          return null;
        }

        const rect = particleNode.getBoundingClientRect();
        const rotationDeg = Number(particleNode.dataset.rotationDeg ?? "0");
        const opacity = Number(particleNode.dataset.opacityValue ?? "1");
        const color = particleNode.dataset.colorValue;
        const imageSrc = particleNode.dataset.imageSrc;
        if (!color || !imageSrc) {
          return null;
        }

        return {
          x: rect.left - viewportRect.left + rect.width / 2,
          y: rect.top - viewportRect.top + rect.height / 2,
          sizePx: Math.max(rect.width, rect.height),
          rotationDeg,
          opacity,
          color,
          imageSrc,
        } satisfies RenderedParticle;
      })
      .filter((item): item is RenderedParticle => item !== null);
    const dpr = Math.max(1, Math.round((window.devicePixelRatio ?? 1) * 100) / 100);
    // 미리보기 대비 캡처가 오른쪽으로 밀리는 경우를 위한 보정값 (음수면 왼쪽으로 이동)
    const CAPTURE_X_NUDGE_PX = 0;


    // 미리보기(첫 화면)는 object-cover로 렌더링된다.
    // 캡처도 동일한 cover 크롭 + 미러링 + 프레임 위치(뷰포트 픽셀)를 그대로 적용한다.
    const scale = Math.max(outWidth / width, outHeight / height);
    const renderWidth = width * scale;
    const renderHeight = height * scale;
    const offsetX = (outWidth - renderWidth) / 2;
    const offsetY = (outHeight - renderHeight) / 2;

    const rawCanvas = document.createElement("canvas");
    rawCanvas.width = Math.round(outWidth * dpr);
    rawCanvas.height = Math.round(outHeight * dpr);
    const rawCtx = rawCanvas.getContext("2d");
    if (!rawCtx) {
      setMessage("사진 캡처에 실패했습니다.");
      return;
    }

    rawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rawCtx.filter = selectedFilter.cssFilter;
    rawCtx.translate(outWidth, 0);
    rawCtx.scale(-1, 1);
    rawCtx.translate(CAPTURE_X_NUDGE_PX, 0);
    rawCtx.drawImage(video, offsetX, offsetY, renderWidth, renderHeight);
    const rawDataUrl = rawCanvas.toDataURL("image/jpeg", 0.92);

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = Math.round(outWidth * dpr);
    finalCanvas.height = Math.round(outHeight * dpr);
    const finalCtx = finalCanvas.getContext("2d");
    if (!finalCtx) {
      setMessage("사진 캡처에 실패했습니다.");
      return;
    }

    finalCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    finalCtx.filter = selectedFilter.cssFilter;
    finalCtx.translate(outWidth, 0);
    finalCtx.scale(-1, 1);
    finalCtx.translate(CAPTURE_X_NUDGE_PX, 0);
    finalCtx.drawImage(video, offsetX, offsetY, renderWidth, renderHeight);
    finalCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    finalCtx.filter = "none";

    if (
      isBunnyFilter &&
      overlaySnapshot.length > 0 &&
      frameImageRef.current?.complete
    ) {
      const frameImage = frameImageRef.current;
      overlaySnapshot.forEach((frameRect) => {
        finalCtx.drawImage(
          frameImage,
          frameRect.x,
          frameRect.y,
          frameRect.width,
          frameRect.height,
        );
      });
    }

    if (particleSnapshot.length > 0) {
      particleSnapshot.forEach((particle) => {
        const particleImage = particleImageMapRef.current[particle.imageSrc];
        if (!particleImage?.complete) {
          return;
        }
        drawTintedParticle(finalCtx, particleImage, particle);
      });
    }

    const dataUrl = finalCanvas.toDataURL("image/jpeg", 0.92);

    const stored = addPhoto(dataUrl);
    void upsertRawPhoto(stored.id, rawDataUrl);
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
    isBunnyFilter,
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
    <main
      ref={viewportRef}
      className="relative min-h-svh w-full overflow-hidden bg-black text-white"
    >
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

      {cameraActive && selectedParticlePreset.id !== "none" && (
        <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden">
          {renderedParticles.map((particle, index) => (
            <div
              key={`particle-${index}`}
              ref={(node) => {
                particleNodeRefs.current[index] = node;
              }}
              className="particle-item absolute select-none"
              data-rotation-deg={particle.rotationDeg}
              data-opacity-value={particle.opacity}
              data-color-value={particle.color}
              data-image-src={particle.imageSrc}
              style={{
                left: `${particle.x}px`,
                top: `${particle.y}px`,
                transform: `translate(-50%, -50%) rotate(${particle.rotationDeg}deg)`,
                width: `${particle.sizePx}px`,
                height: `${particle.sizePx}px`,
                backgroundColor: particle.color,
                WebkitMaskImage: `url(${particle.imageSrc})`,
                maskImage: `url(${particle.imageSrc})`,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                opacity: particle.opacity,
              }}
              aria-hidden
            />
          ))}
        </div>
      )}

      {isBunnyFilter &&
        cameraActive &&
        mappedOverlays.map((mappedOverlay, index) => (
          <img
            key={`bunny-overlay-${index}`}
            ref={(node) => {
              overlayImageRefs.current[index] = node;
            }}
            src={BUNNY_FRAME_URL}
            alt="토끼 프레임"
            className="pointer-events-none absolute z-20 select-none"
            style={{
              left: `${mappedOverlay.x}px`,
              top: `${mappedOverlay.y}px`,
              width: `${mappedOverlay.width}px`,
              height: `${mappedOverlay.height}px`,
            }}
          />
        ))}

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

          <div className="rounded-xl border border-white/25 bg-black/45 p-2">
            <div className="mb-2 text-[11px] text-white/80 md:text-xs">파티클</div>
            <div className="flex flex-wrap gap-2">
              {PARTICLE_PRESETS.map((particlePreset) => {
                const selected = particlePreset.id === selectedParticlePreset.id;
                return (
                  <button
                    key={particlePreset.id}
                    type="button"
                    onClick={() => setSelectedParticleId(particlePreset.id)}
                    className={`rounded-lg border px-3 py-2 text-[11px] leading-tight transition md:text-xs ${
                      selected
                        ? "border-white bg-white text-black"
                        : "border-white/35 bg-black/35 text-white hover:bg-white/15"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {particlePreset.imageSrc ? (
                        <span
                          className="inline-block h-4 w-4"
                          style={{
                            backgroundColor: PARTICLE_COLOR_PALETTE[0],
                            WebkitMaskImage: `url(${particlePreset.imageSrc})`,
                            maskImage: `url(${particlePreset.imageSrc})`,
                            WebkitMaskRepeat: "no-repeat",
                            maskRepeat: "no-repeat",
                            WebkitMaskPosition: "center",
                            maskPosition: "center",
                            WebkitMaskSize: "contain",
                            maskSize: "contain",
                          }}
                          aria-hidden
                        />
                      ) : null}
                      {particlePreset.name}
                    </span>
                  </button>
                );
              })}
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
