"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createDefaultWindowLayouts,
  DEFAULT_WINDOW_Z_ORDER,
  DesktopWindow,
  type DesktopWindowId,
  type WindowLayout,
} from "@/components/desktop-window";
import { WindowLayoutPanel } from "@/components/window-layout-panel";
import {
  loadDesktopWindowLayout,
  saveDesktopWindowLayoutDebounced,
} from "@/lib/desktop-window-layout-store";
import { useRouter } from "next/navigation";
import { addPhoto } from "@/lib/photo-store";
import { upsertRawPhoto } from "@/lib/photo-raw-store";
import { detectFacesInVideo, type FaceBox } from "@/lib/face-detection";
import { PARTICLE_COLOR_PALETTE } from "@/lib/particle-colors";
import { upsertPhotoOverlaySnapshot } from "@/lib/photo-overlay-store";
import {
  FRAME_PROFILES,
  type FrameVariantId,
} from "@/lib/frame-profiles";

type CameraFilter = {
  id: FrameVariantId;
  name: string;
  frameImageSrc: string | null;
  cssFilter: string;
  overlay: string;
  frameScale: number;
  frameWidthScale: number;
  bottomOffsetFaceRatio: number;
  frameOffsetXFaceRatio: number;
  frameOffsetYFaceRatio: number;
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

const CAMERA_FILTERS: CameraFilter[] = FRAME_PROFILES.map((profile) => ({
  id: profile.id,
  name: profile.name,
  frameImageSrc: profile.frameImageSrc,
  cssFilter: profile.cssFilter,
  overlay: profile.overlay,
  frameScale: profile.frameScale,
  frameWidthScale: profile.frameWidthScale,
  bottomOffsetFaceRatio: profile.bottomOffsetFaceRatio,
  frameOffsetXFaceRatio: profile.frameOffsetXFaceRatio,
  frameOffsetYFaceRatio: profile.frameOffsetYFaceRatio,
}));

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
    count: 56,
    sizeRange: [20, 38],
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
    count: 56,
    sizeRange: [20, 38],
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
    count: 56,
    sizeRange: [20, 38],
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
    count: 56,
    sizeRange: [20, 38],
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
    count: 56,
    sizeRange: [20, 38],
    durationRangeMs: [6500, 9800],
    swayRangePx: [6, 22],
    swayCyclesPerFallRange: [0.8, 1.8],
    spinDegPerSecRange: [-42, 42],
    opacityRange: [0.65, 0.96],
  },
];

const DESKTOP_BG_URL = "/img/background/Desktop.png";
const DESKTOP_LOGO_IMG = "/img/logo/로고 이미지.png";
const CAMERA_TITLE_IMG = "/img/icon/1_카메라 창 이름.png";
const CAMERA_CAPTURE_BTN_IMG = "/img/icon/1_카메라 버튼.png";

/**
 * 첫 화면 레이아웃 — 위치(top/left/right/bottom)와 zIndex는 여기서 수정하세요.
 */
const HOME_LAYOUT = {
  zIndex: {
    background: 0,
    desktopLogo: 10,
    windowBase: 20,
  },
  desktopLogo: {
    top: "2rem",
    left: "2.5rem",
    width: "clamp(120px, 14vw, 220px)",
  },
} as const;

const PARTICLE_UI_PRESETS = PARTICLE_PRESETS.filter(
  (preset) => preset.id !== "none",
);

const PARTICLE_ICON_BY_ID: Record<string, string> = {
  star: "/img/particle_icon/2_파티클_별.png",
  apple: "/img/particle_icon/2_파티클_사과.png",
  bunny: "/img/particle_icon/2_파티클_토끼.png",
  note: "/img/particle_icon/2_파티클_음표.png",
  rose: "/img/particle_icon/2_파티클_장미.png",
};

const PARTICLE_LABEL_BY_ID: Record<string, string> = {
  star: "Star",
  apple: "Apple",
  bunny: "Bunny",
  note: "Note",
  rose: "Rose",
};

const FRAME_GRID_SLOTS: Array<{
  filterId: FrameVariantId | null;
  thumbSrc: string | null;
}> = [
  { filterId: "lop_bunny", thumbSrc: "/img/frame/lop_bunny.png" },
  { filterId: "bunny", thumbSrc: "/img/frame/bunny.png" },
  { filterId: "cloud", thumbSrc: "/img/frame/3_구름.png" },
  { filterId: null, thumbSrc: null },
  { filterId: null, thumbSrc: null },
  { filterId: null, thumbSrc: null },
  { filterId: null, thumbSrc: null },
  { filterId: null, thumbSrc: null },
];

type OverlayRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function getFrameBox(face: FaceBox, filter: CameraFilter) {
  const height = Math.max(face.width, face.height) * filter.frameScale;
  const width = height * filter.frameWidthScale;
  const x =
    face.x +
    face.width / 2 -
    width / 2 +
    face.width * filter.frameOffsetXFaceRatio;
  const y =
    face.y +
    face.height -
    height +
    face.height * filter.bottomOffsetFaceRatio +
    face.height * filter.frameOffsetYFaceRatio;
  return { x, y, width, height };
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
  const [selectedFilterId, setSelectedFilterId] = useState<FrameVariantId>(
    "bunny",
  );
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
  const [isLayoutMounted, setIsLayoutMounted] = useState(false);
  const [customWindowLayouts, setCustomWindowLayouts] = useState<Record<
    DesktopWindowId,
    WindowLayout
  > | null>(null);
  const [windowZOrder, setWindowZOrder] = useState<DesktopWindowId[]>(
    DEFAULT_WINDOW_Z_ORDER,
  );
  const [layoutUpdatedAt, setLayoutUpdatedAt] = useState<string | null>(null);

  const windowLayouts = isLayoutMounted
    ? (customWindowLayouts ??
      createDefaultWindowLayouts(window.innerWidth, window.innerHeight))
    : null;

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(
    null,
  );
  const frameImageMapRef = useRef<Record<string, HTMLImageElement>>({});
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
  const hasFrameFilter = selectedFilter.frameImageSrc !== null;
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
      hasFrameFilter ? mappedOverlays.length : 0,
    );
  }, [hasFrameFilter, mappedOverlays.length]);

  useEffect(() => {
    particleNodeRefs.current = particleNodeRefs.current.slice(
      0,
      renderedParticles.length,
    );
  }, [renderedParticles.length]);

  useEffect(() => {
    CAMERA_FILTERS.forEach((filter) => {
      if (!filter.frameImageSrc) {
        return;
      }
      const image = new Image();
      image.src = filter.frameImageSrc;
      frameImageMapRef.current[filter.frameImageSrc] = image;
    });

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
    setIsLayoutMounted(true);

    const savedLayout = loadDesktopWindowLayout();
    if (savedLayout) {
      setCustomWindowLayouts(savedLayout.layouts);
      setWindowZOrder(savedLayout.zOrder);
      setLayoutUpdatedAt(savedLayout.updatedAt);
    }
  }, []);

  useEffect(() => {
    if (!isLayoutMounted || !customWindowLayouts) {
      return;
    }

    saveDesktopWindowLayoutDebounced({
      layouts: customWindowLayouts,
      zOrder: windowZOrder,
    });
    setLayoutUpdatedAt(new Date().toISOString());
  }, [customWindowLayouts, isLayoutMounted, windowZOrder]);

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

  const bringWindowToFront = useCallback((windowId: DesktopWindowId) => {
    setWindowZOrder((prev) => [...prev.filter((id) => id !== windowId), windowId]);
  }, []);

  const updateWindowLayout = useCallback(
    (windowId: DesktopWindowId, layout: WindowLayout) => {
      setCustomWindowLayouts((prev) => {
        const base =
          prev ??
          createDefaultWindowLayouts(window.innerWidth, window.innerHeight);
        return { ...base, [windowId]: layout };
      });
    },
    [],
  );

  const getWindowZIndex = useCallback(
    (windowId: DesktopWindowId) =>
      HOME_LAYOUT.zIndex.windowBase + windowZOrder.indexOf(windowId),
    [windowZOrder],
  );

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
    if (!cameraActive || !hasFrameFilter) {
      setOverlayRects([]);
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

        setOverlayRects(sorted.map((face) => getFrameBox(face, selectedFilter)));
      });
    }, 220);

    return () => {
      isRunning = false;
      window.clearInterval(intervalId);
    };
  }, [cameraActive, hasFrameFilter, selectedFilter]);

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
    if (!viewport) {
      setMessage("사진 캡처에 실패했습니다.");
      return;
    }

    const outWidth = viewport.clientWidth ?? width;
    const outHeight = viewport.clientHeight ?? height;
    if (!outWidth || !outHeight) {
      setMessage("사진 캡처에 실패했습니다.");
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    if (!viewportRect) {
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
    rawCtx.filter = "none";
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

    const selectedFrameImage = selectedFilter.frameImageSrc
      ? frameImageMapRef.current[selectedFilter.frameImageSrc] ?? null
      : null;
    if (overlaySnapshot.length > 0 && selectedFrameImage?.complete) {
      overlaySnapshot.forEach((frameRect) => {
        finalCtx.drawImage(
          selectedFrameImage,
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
    const sizeBase = Math.max(1, Math.min(outWidth, outHeight));
    upsertPhotoOverlaySnapshot(
      stored.id,
      selectedFilter.id,
      particleSnapshot.map((particle) => ({
        xRatio: particle.x / outWidth,
        yRatio: particle.y / outHeight,
        sizeRatio: particle.sizePx / sizeBase,
        rotationDeg: particle.rotationDeg,
        opacity: particle.opacity,
        color: particle.color,
        imageSrc: particle.imageSrc,
      })),
      overlaySnapshot.map((frame) => ({
        xRatio: frame.x / outWidth,
        yRatio: frame.y / outHeight,
        widthRatio: frame.width / outWidth,
        heightRatio: frame.height / outHeight,
      })),
    );
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
    selectedFilter.frameImageSrc,
    selectedFilter.id,
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

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const DOUBLE_TAP_MS = 300;
    const DOUBLE_TAP_MAX_DIST_PX = 48;

    const isInteractiveTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      return Boolean(target.closest("button, a, input, textarea, select"));
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (showPermissionModal || isCapturingTransition || !cameraActive) {
        return;
      }
      if (isInteractiveTarget(event.target)) {
        return;
      }

      const touch = event.changedTouches[0];
      if (!touch) {
        return;
      }

      const now = Date.now();
      const lastTap = lastTapRef.current;
      if (
        lastTap &&
        now - lastTap.time <= DOUBLE_TAP_MS &&
        Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) <=
          DOUBLE_TAP_MAX_DIST_PX
      ) {
        event.preventDefault();
        lastTapRef.current = null;
        capturePhoto();
        return;
      }

      lastTapRef.current = {
        time: now,
        x: touch.clientX,
        y: touch.clientY,
      };
    };

    viewport.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      viewport.removeEventListener("touchend", onTouchEnd);
    };
  }, [
    cameraActive,
    capturePhoto,
    isCapturingTransition,
    showPermissionModal,
  ]);

  const handleViewportDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (showPermissionModal || isCapturingTransition || !cameraActive) {
        return;
      }
      if (event.target instanceof HTMLElement) {
        if (event.target.closest("button, a, input, textarea, select")) {
          return;
        }
      }
      capturePhoto();
    },
    [
      cameraActive,
      capturePhoto,
      isCapturingTransition,
      showPermissionModal,
    ],
  );

  return (
    <main className="fixed inset-0 h-[100dvh] w-full overflow-hidden text-neutral-900">
      <div
        className="pointer-events-none absolute inset-0 select-none"
        style={{
          zIndex: HOME_LAYOUT.zIndex.background,
          backgroundImage: `url(${DESKTOP_BG_URL})`,
          backgroundSize: "100% 100%",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
        aria-hidden
      />

      <img
        src={DESKTOP_LOGO_IMG}
        alt="Bunnecho"
        className="pointer-events-none absolute hidden h-auto md:block"
        style={{
          zIndex: HOME_LAYOUT.zIndex.desktopLogo,
          top: HOME_LAYOUT.desktopLogo.top,
          left: HOME_LAYOUT.desktopLogo.left,
          width: HOME_LAYOUT.desktopLogo.width,
        }}
      />

      {windowLayouts ? (
        <DesktopWindow
          windowId="camera"
          layout={windowLayouts.camera}
          zIndex={getWindowZIndex("camera")}
          onFocus={() => bringWindowToFront("camera")}
          onLayoutChange={(layout) => updateWindowLayout("camera", layout)}
          titleBar={
            <img
              src={CAMERA_TITLE_IMG}
              alt="Bunnecho"
              className="h-5 w-auto"
            />
          }
          footer={
            <p className="pointer-events-none mt-2 text-center text-xs text-white/90 drop-shadow-sm">
              {message}
            </p>
          }
        >
            <div
              ref={viewportRef}
              onDoubleClick={handleViewportDoubleClick}
              className="relative min-h-0 w-full flex-1 overflow-hidden bg-[#d9d9d9]"
            >
              <video
                ref={videoRef}
                className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ${
                  isDenied ? "opacity-0" : "opacity-100"
                }`}
                style={{
                  filter: "none",
                  transform: "scaleX(-1)",
                }}
                muted
                playsInline
              />

              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: isDenied ? "rgba(0,0,0,1)" : "transparent",
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

              {cameraActive &&
                hasFrameFilter &&
                mappedOverlays.map((mappedOverlay, index) => (
                  <img
                    key={`frame-overlay-${index}`}
                    ref={(node) => {
                      overlayImageRefs.current[index] = node;
                    }}
                    src={selectedFilter.frameImageSrc ?? undefined}
                    alt={`${selectedFilter.name} 프레임`}
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

              {showPermissionModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                  <div className="w-full max-w-[280px] rounded-xl border border-black/10 bg-white p-4 text-neutral-900 shadow-lg">
                    <h2 className="text-base font-semibold">카메라 권한 필요</h2>
                    <p className="mt-2 text-xs leading-relaxed text-neutral-600">
                      {isDenied
                        ? "권한이 거절되었습니다. 아래 버튼으로 다시 시도해주세요."
                        : "촬영을 위해 카메라 권한을 허용해주세요."}
                    </p>
                    <button
                      onClick={startCamera}
                      type="button"
                      className="mt-4 w-full rounded-lg bg-neutral-900 py-2 text-sm text-white transition hover:bg-neutral-800"
                      disabled={permissionState === "requesting"}
                    >
                      {permissionState === "requesting"
                        ? "권한 요청 중..."
                        : isDenied
                          ? "카메라 권한 재시도"
                          : "카메라 권한 허용"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-center border-t border-black/8 bg-white py-4">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={
                  !cameraActive ||
                  isCapturingTransition ||
                  showPermissionModal
                }
                className="rounded-full transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="사진 촬영"
              >
                <img
                  src={CAMERA_CAPTURE_BTN_IMG}
                  alt=""
                  className="h-14 w-14 object-contain md:h-16 md:w-16"
                />
              </button>
            </div>
        </DesktopWindow>
      ) : null}

      {windowLayouts ? (
        <DesktopWindow
          windowId="particle"
          layout={windowLayouts.particle}
          zIndex={getWindowZIndex("particle")}
          onFocus={() => bringWindowToFront("particle")}
          onLayoutChange={(layout) => updateWindowLayout("particle", layout)}
        >
            <div className="flex h-full min-h-0 items-start justify-between gap-1 overflow-auto bg-white px-3 py-4">
              {PARTICLE_UI_PRESETS.map((particlePreset) => {
                const selected =
                  particlePreset.id === selectedParticlePreset.id;
                const iconSrc = PARTICLE_ICON_BY_ID[particlePreset.id];
                return (
                  <button
                    key={particlePreset.id}
                    type="button"
                    onClick={() => setSelectedParticleId(particlePreset.id)}
                    className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1 transition ${
                      selected
                        ? "bg-violet-50 ring-2 ring-violet-400"
                        : "hover:bg-neutral-50"
                    }`}
                  >
                    {iconSrc ? (
                      <img
                        src={iconSrc}
                        alt=""
                        className="h-11 w-11 object-contain md:h-12 md:w-12"
                      />
                    ) : null}
                    <span className="font-serif text-[11px] italic text-neutral-700 md:text-xs">
                      {PARTICLE_LABEL_BY_ID[particlePreset.id] ??
                        particlePreset.name}
                    </span>
                  </button>
                );
              })}
            </div>
        </DesktopWindow>
      ) : null}

      {windowLayouts ? (
        <DesktopWindow
          windowId="frame"
          layout={windowLayouts.frame}
          zIndex={getWindowZIndex("frame")}
          onFocus={() => bringWindowToFront("frame")}
          onLayoutChange={(layout) => updateWindowLayout("frame", layout)}
        >
            <div className="grid h-full min-h-0 grid-cols-4 grid-rows-2 gap-2 overflow-auto bg-white p-3">
              {FRAME_GRID_SLOTS.map((slot, index) => {
                const selected =
                  slot.filterId !== null &&
                  slot.filterId === selectedFilterId;
                const isSelectable = slot.filterId !== null;

                if (!slot.thumbSrc) {
                  return (
                    <div
                      key={`frame-slot-${index}`}
                      className="aspect-square rounded-md bg-[#b5b5b5]"
                      aria-hidden
                    />
                  );
                }

                return (
                  <button
                    key={`frame-slot-${index}`}
                    type="button"
                    disabled={!isSelectable}
                    onClick={() => {
                      if (slot.filterId) {
                        setSelectedFilterId(slot.filterId);
                      }
                    }}
                    className={`flex aspect-square items-center justify-center overflow-hidden rounded-md bg-[#b5b5b5] p-1 transition ${
                      selected ? "ring-2 ring-violet-400" : ""
                    } ${isSelectable ? "hover:brightness-105" : "cursor-default opacity-90"}`}
                  >
                    <img
                      src={slot.thumbSrc}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  </button>
                );
              })}
            </div>
        </DesktopWindow>
      ) : null}

      {windowLayouts ? (
        <WindowLayoutPanel
          layouts={windowLayouts}
          updatedAt={layoutUpdatedAt}
        />
      ) : null}

    </main>
  );
}
