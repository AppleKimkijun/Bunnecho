import { detectFacesInImage, type FaceBox } from "@/lib/face-detection";
import type {
  StoredFrameOverlay,
  StoredPhotoOverlaySnapshot,
  StoredParticleOverlay,
} from "@/lib/photo-overlay-store";

const OUTPUT_SIZE = 320;

type FrameCropProfile = {
  frameImageSrc: string;
  frameScale: number;
  bottomOffsetFaceRatio: number;
  holeSeedXRatio: number;
  holeSeedYRatio: number;
};

const BUNNY_CROP_PROFILE: FrameCropProfile = {
  frameImageSrc: "/img/frame/bunny.png",
  frameScale: 2.2,
  bottomOffsetFaceRatio: 0.15,
  holeSeedXRatio: 0.5,
  holeSeedYRatio: 0.62,
};

const ALPHA_THRESHOLD = 16;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
    image.src = src;
  });
}

function findNearestTransparentSeed(
  alphaMap: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
) {
  const maxRadius = Math.max(width, height);
  const startIndex = startY * width + startX;
  if (alphaMap[startIndex] <= ALPHA_THRESHOLD) {
    return { x: startX, y: startY };
  }

  for (let radius = 1; radius <= maxRadius; radius += 1) {
    const left = Math.max(0, startX - radius);
    const right = Math.min(width - 1, startX + radius);
    const top = Math.max(0, startY - radius);
    const bottom = Math.min(height - 1, startY + radius);

    for (let x = left; x <= right; x += 1) {
      const topIndex = top * width + x;
      const bottomIndex = bottom * width + x;
      if (alphaMap[topIndex] <= ALPHA_THRESHOLD) {
        return { x, y: top };
      }
      if (alphaMap[bottomIndex] <= ALPHA_THRESHOLD) {
        return { x, y: bottom };
      }
    }

    for (let y = top + 1; y < bottom; y += 1) {
      const leftIndex = y * width + left;
      const rightIndex = y * width + right;
      if (alphaMap[leftIndex] <= ALPHA_THRESHOLD) {
        return { x: left, y };
      }
      if (alphaMap[rightIndex] <= ALPHA_THRESHOLD) {
        return { x: right, y };
      }
    }
  }

  return null;
}

function createFrameMaskCanvas(
  frameImage: HTMLImageElement,
  profile: FrameCropProfile,
) {
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = OUTPUT_SIZE;
  sourceCanvas.height = OUTPUT_SIZE;
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) {
    return null;
  }

  sourceCtx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  sourceCtx.drawImage(frameImage, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  const sourceData = sourceCtx.getImageData(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  const pixelCount = OUTPUT_SIZE * OUTPUT_SIZE;
  const alphaMap = new Uint8ClampedArray(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    alphaMap[index] = sourceData.data[index * 4 + 3];
  }

  const seedX = Math.max(
    0,
    Math.min(OUTPUT_SIZE - 1, Math.floor(profile.holeSeedXRatio * OUTPUT_SIZE)),
  );
  const seedY = Math.max(
    0,
    Math.min(OUTPUT_SIZE - 1, Math.floor(profile.holeSeedYRatio * OUTPUT_SIZE)),
  );
  const seed = findNearestTransparentSeed(alphaMap, OUTPUT_SIZE, OUTPUT_SIZE, seedX, seedY);
  const holeMap = new Uint8Array(pixelCount);

  if (seed) {
    const queueX = new Int16Array(pixelCount);
    const queueY = new Int16Array(pixelCount);
    let head = 0;
    let tail = 0;

    queueX[tail] = seed.x;
    queueY[tail] = seed.y;
    tail += 1;
    holeMap[seed.y * OUTPUT_SIZE + seed.x] = 1;

    while (head < tail) {
      const x = queueX[head];
      const y = queueY[head];
      head += 1;

      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= OUTPUT_SIZE || ny >= OUTPUT_SIZE) {
          continue;
        }
        const neighborIndex = ny * OUTPUT_SIZE + nx;
        if (holeMap[neighborIndex] === 1) {
          continue;
        }
        if (alphaMap[neighborIndex] > ALPHA_THRESHOLD) {
          continue;
        }

        holeMap[neighborIndex] = 1;
        queueX[tail] = nx;
        queueY[tail] = ny;
        tail += 1;
      }
    }
  }

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = OUTPUT_SIZE;
  maskCanvas.height = OUTPUT_SIZE;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) {
    return null;
  }

  const maskData = maskCtx.createImageData(OUTPUT_SIZE, OUTPUT_SIZE);
  for (let index = 0; index < pixelCount; index += 1) {
    const base = index * 4;
    const frameVisible = alphaMap[index] > ALPHA_THRESHOLD;
    const holeVisible = holeMap[index] === 1;
    const alpha = frameVisible || holeVisible ? 255 : 0;

    maskData.data[base] = 255;
    maskData.data[base + 1] = 255;
    maskData.data[base + 2] = 255;
    maskData.data[base + 3] = alpha;
  }

  maskCtx.putImageData(maskData, 0, 0);
  return maskCanvas;
}

function drawTintedParticle(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  particle: {
    x: number;
    y: number;
    sizePx: number;
    rotationDeg: number;
    opacity: number;
    color: string;
  },
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

function drawSavedParticlesOverFrame(
  ctx: CanvasRenderingContext2D,
  photoImage: HTMLImageElement,
  cropX: number,
  cropY: number,
  frameSize: number,
  particles: StoredParticleOverlay[],
  particleImageMap: Map<string, HTMLImageElement>,
) {
  if (particles.length === 0) {
    return;
  }

  const sourceMinSize = Math.max(1, Math.min(photoImage.width, photoImage.height));

  particles.forEach((particle) => {
    const image = particleImageMap.get(particle.imageSrc);
    if (!image?.complete) {
      return;
    }

    const sourceX = particle.xRatio * photoImage.width;
    const sourceY = particle.yRatio * photoImage.height;
    const sourceSize = particle.sizeRatio * sourceMinSize;

    const x = ((sourceX - cropX) / frameSize) * OUTPUT_SIZE;
    const y = ((sourceY - cropY) / frameSize) * OUTPUT_SIZE;
    const sizePx = (sourceSize / frameSize) * OUTPUT_SIZE;

    if (
      x < -sizePx ||
      y < -sizePx ||
      x > OUTPUT_SIZE + sizePx ||
      y > OUTPUT_SIZE + sizePx
    ) {
      return;
    }

    drawTintedParticle(ctx, image, {
      x,
      y,
      sizePx,
      rotationDeg: particle.rotationDeg,
      opacity: particle.opacity,
      color: particle.color,
    });
  });
}

function resolveFrameCrop(
  faceBox: FaceBox,
  image: HTMLImageElement,
  profile: FrameCropProfile,
) {
  const frameSize = Math.max(faceBox.width, faceBox.height) * profile.frameScale;
  let cropX = faceBox.x + faceBox.width / 2 - frameSize / 2;
  let cropY =
    faceBox.y +
    faceBox.height -
    frameSize +
    faceBox.height * profile.bottomOffsetFaceRatio;

  cropX = Math.max(0, Math.min(image.width - frameSize, cropX));
  cropY = Math.max(0, Math.min(image.height - frameSize, cropY));

  return { cropX, cropY, frameSize };
}

function drawShareCrop(
  photoImage: HTMLImageElement,
  cropX: number,
  cropY: number,
  frameSize: number,
  frameImage: HTMLImageElement | null,
  profile: FrameCropProfile,
  overlaySnapshot: StoredPhotoOverlaySnapshot | null,
  particleImageMap: Map<string, HTMLImageElement>,
) {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("결과 캔버스 초기화 실패");
  }

  ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  ctx.drawImage(
    photoImage,
    cropX,
    cropY,
    frameSize,
    frameSize,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  let maskCanvas: HTMLCanvasElement | null = null;
  if (frameImage) {
    maskCanvas = createFrameMaskCanvas(frameImage, profile);
    if (maskCanvas) {
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(maskCanvas, 0, 0);
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.drawImage(frameImage, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    if (overlaySnapshot) {
      drawSavedParticlesOverFrame(
        ctx,
        photoImage,
        cropX,
        cropY,
        frameSize,
        overlaySnapshot.particles,
        particleImageMap,
      );
    }

    if (maskCanvas) {
      // 최종 단계에서 한 번 더 마스킹해 프레임 바깥 파티클을 제거한다.
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(maskCanvas, 0, 0);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  return canvas.toDataURL("image/png");
}

function resolveSavedFrameCrop(
  frame: StoredFrameOverlay,
  image: HTMLImageElement,
) {
  const cropX = frame.xRatio * image.width;
  const cropY = frame.yRatio * image.height;
  const cropWidth = frame.widthRatio * image.width;
  const cropHeight = frame.heightRatio * image.height;

  const frameSize = Math.max(1, Math.max(cropWidth, cropHeight));
  const x = Math.max(0, Math.min(image.width - frameSize, cropX));
  const y = Math.max(0, Math.min(image.height - frameSize, cropY));

  return { cropX: x, cropY: y, frameSize };
}

export async function createBunnyShareCutoutDataUrls(
  photoDataUrl: string,
  overlaySnapshot: StoredPhotoOverlaySnapshot | null = null,
) {
  const photoImage = await loadImage(photoDataUrl);
  const frameImage = await loadImage(BUNNY_CROP_PROFILE.frameImageSrc).catch(
    () => null,
  );

  const particleImageMap = new Map<string, HTMLImageElement>();
  if (overlaySnapshot?.particles?.length) {
    const uniqueSources = [...new Set(overlaySnapshot.particles.map((p) => p.imageSrc))];
    await Promise.all(
      uniqueSources.map(async (src) => {
        const image = await loadImage(src).catch(() => null);
        if (image) {
          particleImageMap.set(src, image);
        }
      }),
    );
  }

  const savedFrames = overlaySnapshot?.frames ?? [];
  if (savedFrames.length > 0) {
    return savedFrames.map((frame) => {
      const { cropX, cropY, frameSize } = resolveSavedFrameCrop(frame, photoImage);
      return drawShareCrop(
        photoImage,
        cropX,
        cropY,
        frameSize,
        frameImage,
        BUNNY_CROP_PROFILE,
        overlaySnapshot,
        particleImageMap,
      );
    });
  }

  const detectedFaces = await detectFacesInImage(photoImage);

  const fallbackSize = Math.floor(
    Math.min(photoImage.width, photoImage.height) * 0.42,
  );
  const fallback = {
    x: Math.floor((photoImage.width - fallbackSize) / 2),
    y: Math.floor((photoImage.height - fallbackSize) / 2),
    width: fallbackSize,
    height: fallbackSize,
  };

  const faceBoxes =
    detectedFaces.length > 0
      ? [...detectedFaces]
          .sort((a, b) => b.width * b.height - a.width * a.height)
          .slice(0, 8)
      : [fallback];

  return faceBoxes.map((faceBox) => {
    const { cropX, cropY, frameSize } = resolveFrameCrop(
      faceBox,
      photoImage,
      BUNNY_CROP_PROFILE,
    );
    return drawShareCrop(
      photoImage,
      cropX,
      cropY,
      frameSize,
      frameImage,
      BUNNY_CROP_PROFILE,
      overlaySnapshot,
      particleImageMap,
    );
  });
}

