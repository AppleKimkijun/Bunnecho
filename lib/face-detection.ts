export type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FastFaceDetector = {
  detect: (
    input: HTMLImageElement | HTMLVideoElement,
  ) => Promise<DetectedFastFace[]>;
};

type DetectedFastFace = {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

type MediaPipeResult = {
  detections?: Array<{
    boundingBox?: {
      originX?: number;
      originY?: number;
      width?: number;
      height?: number;
    };
  }>;
};

type MediaPipeDetector = {
  detect: (
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  ) => MediaPipeResult;
};

let detector: FastFaceDetector | null = null;
let mediaPipeDetectorPromise: Promise<MediaPipeDetector | null> | null = null;
const TFLITE_XNNPACK_LOG = "Created TensorFlow Lite XNNPACK delegate for CPU.";
let tfliteLogFilterInstalled = false;

function shouldSuppressTfliteLog(args: unknown[]) {
  const text = args
    .map((arg) => {
      if (typeof arg === "string") {
        return arg;
      }
      if (arg instanceof Error) {
        return arg.message;
      }
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");

  return text.includes(TFLITE_XNNPACK_LOG);
}

function installTfliteLogFilterOnce() {
  if (tfliteLogFilterInstalled || typeof window === "undefined") {
    return;
  }

  const wrap = (method: (...args: unknown[]) => void) => {
    return (...args: unknown[]) => {
      if (shouldSuppressTfliteLog(args)) {
        return;
      }
      method(...args);
    };
  };

  console.info = wrap(console.info.bind(console));
  console.log = wrap(console.log.bind(console));
  console.warn = wrap(console.warn.bind(console));
  console.error = wrap(console.error.bind(console));
  tfliteLogFilterInstalled = true;
}

async function getFaceDetector() {
  if (typeof window === "undefined" || !("FaceDetector" in window)) {
    return null;
  }

  if (!detector) {
    const FastDetector = window.FaceDetector as unknown as {
      new (options?: {
        maxDetectedFaces?: number;
        fastMode?: boolean;
      }): FastFaceDetector;
    };
    detector = new FastDetector({ maxDetectedFaces: 8, fastMode: true });
  }

  return detector;
}

async function getMediaPipeDetector() {
  if (typeof window === "undefined") {
    return null;
  }

  installTfliteLogFilterOnce();

  if (!mediaPipeDetectorPromise) {
    mediaPipeDetectorPromise = (async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );

        const detectorInstance = await vision.FaceDetector.createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            },
            runningMode: "IMAGE",
            minDetectionConfidence: 0.4,
          },
        );

        return {
          detect(
            input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
          ) {
            return detectorInstance.detect(input) as MediaPipeResult;
          },
        } satisfies MediaPipeDetector;
      } catch {
        return null;
      }
    })();
  }

  return mediaPipeDetectorPromise;
}

function extractMediaPipeFaces(result: MediaPipeResult | null | undefined) {
  return (result?.detections ?? [])
    .map((detection) => {
      const box = detection.boundingBox;
      if (!box) {
        return null;
      }

      const width = box.width ?? 0;
      const height = box.height ?? 0;
      if (width <= 0 || height <= 0) {
        return null;
      }

      return {
        x: box.originX ?? 0,
        y: box.originY ?? 0,
        width,
        height,
      } satisfies FaceBox;
    })
    .filter((face): face is FaceBox => face !== null);
}

function detectFaceLikeBounds(
  imageData: ImageData,
  width: number,
  height: number,
) {
  const data = imageData.data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let count = 0;

  const sampleStep = Math.max(2, Math.floor(width / 180));

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];

      if (r > 95 && g > 45 && b > 20 && r > g && r > b && r - b > 20) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        count += 1;
      }
    }
  }

  if (count < 200 || minX >= maxX || minY >= maxY) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  } satisfies FaceBox;
}

function clampFaceBox(face: FaceBox, frameWidth: number, frameHeight: number) {
  const x = Math.max(0, Math.min(frameWidth, face.x));
  const y = Math.max(0, Math.min(frameHeight, face.y));
  const maxWidth = Math.max(0, frameWidth - x);
  const maxHeight = Math.max(0, frameHeight - y);
  const width = Math.max(0, Math.min(maxWidth, face.width));
  const height = Math.max(0, Math.min(maxHeight, face.height));
  return { x, y, width, height } satisfies FaceBox;
}

function isLikelyFaceBox(
  face: FaceBox,
  frameWidth: number,
  frameHeight: number,
) {
  if (
    face.width <= 0 ||
    face.height <= 0 ||
    frameWidth <= 0 ||
    frameHeight <= 0
  ) {
    return false;
  }

  const aspect = face.width / face.height;
  const areaRatio = (face.width * face.height) / (frameWidth * frameHeight);
  const centerYRatio = (face.y + face.height / 2) / frameHeight;

  if (aspect < 0.62 || aspect > 1.55) {
    return false;
  }

  if (areaRatio < 0.012 || areaRatio > 0.58) {
    return false;
  }

  if (centerYRatio > 0.9) {
    return false;
  }

  return true;
}

function sanitizeFaces(
  faces: FaceBox[],
  frameWidth: number,
  frameHeight: number,
) {
  return faces
    .map((face) => clampFaceBox(face, frameWidth, frameHeight))
    .filter((face) => isLikelyFaceBox(face, frameWidth, frameHeight));
}

export async function detectFacesInVideo(video: HTMLVideoElement) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) {
    return [];
  }

  const sdkDetector = await getMediaPipeDetector();
  if (sdkDetector) {
    try {
      const sdkFaces = sanitizeFaces(
        extractMediaPipeFaces(sdkDetector.detect(video)),
        sourceWidth,
        sourceHeight,
      );
      if (sdkFaces.length > 0) {
        return sdkFaces;
      }
    } catch {
      // Fall through to other detectors.
    }
  }

  const fastDetector = await getFaceDetector();
  if (fastDetector) {
    try {
      const faces = await fastDetector.detect(video);
      const mapped = sanitizeFaces(
        faces
          .map((face) => {
            if (!face?.boundingBox) {
              return null;
            }
            return {
              x: face.boundingBox.x,
              y: face.boundingBox.y,
              width: face.boundingBox.width,
              height: face.boundingBox.height,
            } satisfies FaceBox;
          })
          .filter((face): face is FaceBox => face !== null),
        sourceWidth,
        sourceHeight,
      );

      if (mapped.length > 0) {
        return mapped;
      }
    } catch {
      // Fall through to heuristic detection.
    }
  }

  if (sdkDetector || fastDetector) {
    return [];
  }

  const sampleWidth = 240;
  const sampleHeight = Math.round((sourceHeight / sourceWidth) * sampleWidth);

  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return [];
  }

  context.drawImage(video, 0, 0, sampleWidth, sampleHeight);
  const imageData = context.getImageData(0, 0, sampleWidth, sampleHeight);
  const bounds = detectFaceLikeBounds(imageData, sampleWidth, sampleHeight);

  if (!bounds) {
    return [];
  }

  const backScale = sourceWidth / sampleWidth;
  return sanitizeFaces(
    [
      {
        x: bounds.x * backScale,
        y: bounds.y * backScale,
        width: bounds.width * backScale,
        height: bounds.height * backScale,
      } satisfies FaceBox,
    ],
    sourceWidth,
    sourceHeight,
  );
}

export async function detectFaceInVideo(video: HTMLVideoElement) {
  const faces = await detectFacesInVideo(video);
  return faces[0] ?? null;
}

export async function detectFacesInImage(image: HTMLImageElement) {
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  if (!sourceWidth || !sourceHeight) {
    return [];
  }

  const sdkDetector = await getMediaPipeDetector();
  if (sdkDetector) {
    try {
      const sdkFaces = sanitizeFaces(
        extractMediaPipeFaces(sdkDetector.detect(image)),
        sourceWidth,
        sourceHeight,
      );
      if (sdkFaces.length > 0) {
        return sdkFaces;
      }
    } catch {
      // Fall through to other detectors.
    }
  }

  const fastDetector = await getFaceDetector();
  if (fastDetector) {
    try {
      const faces = await fastDetector.detect(image);
      const mapped = sanitizeFaces(
        faces
          .map((face) => {
            if (!face?.boundingBox) {
              return null;
            }
            return {
              x: face.boundingBox.x,
              y: face.boundingBox.y,
              width: face.boundingBox.width,
              height: face.boundingBox.height,
            } satisfies FaceBox;
          })
          .filter((face): face is FaceBox => face !== null),
        sourceWidth,
        sourceHeight,
      );

      if (mapped.length > 0) {
        return mapped;
      }
    } catch {
      // Fall through to heuristic detection.
    }
  }

  if (sdkDetector || fastDetector) {
    return [];
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return [];
  }

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, image.width, image.height);
  const face = detectFaceLikeBounds(imageData, image.width, image.height);
  if (!face) {
    return [];
  }

  return sanitizeFaces([face], sourceWidth, sourceHeight);
}

export async function detectFaceInImage(image: HTMLImageElement) {
  const faces = await detectFacesInImage(image);
  return faces[0] ?? null;
}
