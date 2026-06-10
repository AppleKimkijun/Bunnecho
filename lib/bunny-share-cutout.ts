import { detectFacesInImage, type FaceBox } from "@/lib/face-detection";
import { getFrameProfileById } from "@/lib/frame-profiles";
import type {
  StoredFrameOverlay,
  StoredPhotoOverlaySnapshot,
  StoredParticleOverlay,
} from "@/lib/photo-overlay-store";

const OUTPUT_BASE = 320;

type FrameCropProfile = {
  frameImageSrc: string | null;
  frameScale: number;
  frameWidthScale: number;
  bottomOffsetFaceRatio: number;
  frameOffsetXFaceRatio: number;
  frameOffsetYFaceRatio: number;
  holeSeedXRatio: number;
  holeSeedYRatio: number;
  holeBottomMaxRatio: number;
};

type FrameCropRect = {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
};

const ALPHA_THRESHOLD = 16;
/** flood fill은 완전 투명 픽셀만 통과 (도트 프레임 틈으로 번지는 것 방지) */
const HOLE_FILL_ALPHA_MAX = 8;

function trimHoleMapBottom(
  holeMap: Uint8Array,
  width: number,
  height: number,
  maxBottomRatio: number,
) {
  const maxY = Math.min(height - 1, Math.floor(height * maxBottomRatio));
  for (let y = maxY + 1; y < height; y += 1) {
    const rowStart = y * width;
    for (let x = 0; x < width; x += 1) {
      holeMap[rowStart + x] = 0;
    }
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
    image.src = src;
  });
}

function getOutputSize(cropWidth: number, cropHeight: number) {
  const safeWidth = Math.max(1, cropWidth);
  const safeHeight = Math.max(1, cropHeight);
  const aspect = safeWidth / safeHeight;

  if (aspect >= 1) {
    return {
      width: Math.round(OUTPUT_BASE * aspect),
      height: OUTPUT_BASE,
    };
  }

  return {
    width: OUTPUT_BASE,
    height: Math.round(OUTPUT_BASE / aspect),
  };
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
  outputWidth: number,
  outputHeight: number,
) {
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = outputWidth;
  sourceCanvas.height = outputHeight;
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) {
    return null;
  }

  sourceCtx.clearRect(0, 0, outputWidth, outputHeight);
  sourceCtx.drawImage(frameImage, 0, 0, outputWidth, outputHeight);

  const sourceData = sourceCtx.getImageData(0, 0, outputWidth, outputHeight);
  const pixelCount = outputWidth * outputHeight;
  const alphaMap = new Uint8ClampedArray(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    alphaMap[index] = sourceData.data[index * 4 + 3];
  }

  const seedX = Math.max(
    0,
    Math.min(outputWidth - 1, Math.floor(profile.holeSeedXRatio * outputWidth)),
  );
  const seedY = Math.max(
    0,
    Math.min(outputHeight - 1, Math.floor(profile.holeSeedYRatio * outputHeight)),
  );
  const seed = findNearestTransparentSeed(
    alphaMap,
    outputWidth,
    outputHeight,
    seedX,
    seedY,
  );
  const holeMap = new Uint8Array(pixelCount);
  const holeBottomMaxY = Math.min(
    outputHeight - 1,
    Math.floor(outputHeight * profile.holeBottomMaxRatio),
  );

  if (seed) {
    const queueX = new Int16Array(pixelCount);
    const queueY = new Int16Array(pixelCount);
    let head = 0;
    let tail = 0;

    queueX[tail] = seed.x;
    queueY[tail] = seed.y;
    tail += 1;
    holeMap[seed.y * outputWidth + seed.x] = 1;

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
        if (nx < 0 || ny < 0 || nx >= outputWidth || ny >= outputHeight) {
          continue;
        }
        if (ny > holeBottomMaxY) {
          continue;
        }
        const neighborIndex = ny * outputWidth + nx;
        if (holeMap[neighborIndex] === 1) {
          continue;
        }
        if (alphaMap[neighborIndex] > HOLE_FILL_ALPHA_MAX) {
          continue;
        }

        holeMap[neighborIndex] = 1;
        queueX[tail] = nx;
        queueY[tail] = ny;
        tail += 1;
      }
    }

    trimHoleMapBottom(
      holeMap,
      outputWidth,
      outputHeight,
      profile.holeBottomMaxRatio,
    );
  }

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = outputWidth;
  maskCanvas.height = outputHeight;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) {
    return null;
  }

  const maskData = maskCtx.createImageData(outputWidth, outputHeight);
  for (let index = 0; index < pixelCount; index += 1) {
    const base = index * 4;
    const holeVisible = holeMap[index] === 1;
    const alpha = holeVisible ? 255 : 0;

    maskData.data[base] = 255;
    maskData.data[base + 1] = 255;
    maskData.data[base + 2] = 255;
    maskData.data[base + 3] = alpha;
  }

  maskCtx.putImageData(maskData, 0, 0);

  const silhouetteData = maskCtx.createImageData(outputWidth, outputHeight);
  for (let index = 0; index < pixelCount; index += 1) {
    const base = index * 4;
    const frameVisible = alphaMap[index] > ALPHA_THRESHOLD;
    const holeVisible = holeMap[index] === 1;
    const alpha = frameVisible || holeVisible ? 255 : 0;

    silhouetteData.data[base] = 255;
    silhouetteData.data[base + 1] = 255;
    silhouetteData.data[base + 2] = 255;
    silhouetteData.data[base + 3] = alpha;
  }

  const silhouetteCanvas = document.createElement("canvas");
  silhouetteCanvas.width = outputWidth;
  silhouetteCanvas.height = outputHeight;
  const silhouetteCtx = silhouetteCanvas.getContext("2d");
  if (!silhouetteCtx) {
    return { holeMask: maskCanvas, silhouetteMask: maskCanvas };
  }
  silhouetteCtx.putImageData(silhouetteData, 0, 0);

  return { holeMask: maskCanvas, silhouetteMask: silhouetteCanvas };
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
  crop: FrameCropRect,
  outputWidth: number,
  outputHeight: number,
  particles: StoredParticleOverlay[],
  particleImageMap: Map<string, HTMLImageElement>,
) {
  if (particles.length === 0) {
    return;
  }

  const sourceMinSize = Math.max(1, Math.min(photoImage.width, photoImage.height));
  const cropMinSize = Math.max(1, Math.min(crop.cropWidth, crop.cropHeight));

  particles.forEach((particle) => {
    const image = particleImageMap.get(particle.imageSrc);
    if (!image?.complete) {
      return;
    }

    const sourceX = particle.xRatio * photoImage.width;
    const sourceY = particle.yRatio * photoImage.height;
    const sourceSize = particle.sizeRatio * sourceMinSize;

    const x = ((sourceX - crop.cropX) / crop.cropWidth) * outputWidth;
    const y = ((sourceY - crop.cropY) / crop.cropHeight) * outputHeight;
    const sizePx = (sourceSize / cropMinSize) * Math.min(outputWidth, outputHeight);

    if (
      x < -sizePx ||
      y < -sizePx ||
      x > outputWidth + sizePx ||
      y > outputHeight + sizePx
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
): FrameCropRect {
  const cropHeight = Math.max(faceBox.width, faceBox.height) * profile.frameScale;
  const cropWidth = cropHeight * profile.frameWidthScale;
  let cropX =
    faceBox.x +
    faceBox.width / 2 -
    cropWidth / 2 +
    faceBox.width * profile.frameOffsetXFaceRatio;
  let cropY =
    faceBox.y +
    faceBox.height -
    cropHeight +
    faceBox.height * profile.bottomOffsetFaceRatio +
    faceBox.height * profile.frameOffsetYFaceRatio;

  cropX = Math.max(0, Math.min(image.width - cropWidth, cropX));
  cropY = Math.max(0, Math.min(image.height - cropHeight, cropY));

  return { cropX, cropY, cropWidth, cropHeight };
}

function resolveSavedFrameCrop(
  frame: StoredFrameOverlay,
  image: HTMLImageElement,
): FrameCropRect {
  const cropWidth = Math.max(1, frame.widthRatio * image.width);
  const cropHeight = Math.max(1, frame.heightRatio * image.height);
  const cropX = Math.max(0, Math.min(image.width - cropWidth, frame.xRatio * image.width));
  const cropY = Math.max(0, Math.min(image.height - cropHeight, frame.yRatio * image.height));

  return { cropX, cropY, cropWidth, cropHeight };
}

function drawShareCrop(
  photoImage: HTMLImageElement,
  crop: FrameCropRect,
  frameImage: HTMLImageElement | null,
  profile: FrameCropProfile,
  overlaySnapshot: StoredPhotoOverlaySnapshot | null,
  particleImageMap: Map<string, HTMLImageElement>,
) {
  const { width: outputWidth, height: outputHeight } = getOutputSize(
    crop.cropWidth,
    crop.cropHeight,
  );

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("결과 캔버스 초기화 실패");
  }

  ctx.clearRect(0, 0, outputWidth, outputHeight);

  ctx.drawImage(
    photoImage,
    crop.cropX,
    crop.cropY,
    crop.cropWidth,
    crop.cropHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  let holeMaskCanvas: HTMLCanvasElement | null = null;
  let silhouetteMaskCanvas: HTMLCanvasElement | null = null;
  if (frameImage) {
    const masks = createFrameMaskCanvas(
      frameImage,
      profile,
      outputWidth,
      outputHeight,
    );
    if (masks) {
      holeMaskCanvas = masks.holeMask;
      silhouetteMaskCanvas = masks.silhouetteMask;
    }
    if (holeMaskCanvas) {
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(holeMaskCanvas, 0, 0);
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.drawImage(frameImage, 0, 0, outputWidth, outputHeight);

    if (overlaySnapshot) {
      drawSavedParticlesOverFrame(
        ctx,
        photoImage,
        crop,
        outputWidth,
        outputHeight,
        overlaySnapshot.particles,
        particleImageMap,
      );
    }

    if (silhouetteMaskCanvas) {
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(silhouetteMaskCanvas, 0, 0);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  return canvas.toDataURL("image/png");
}

export async function createBunnyShareCutoutDataUrls(
  photoDataUrl: string,
  overlaySnapshot: StoredPhotoOverlaySnapshot | null = null,
) {
  const selectedProfile = getFrameProfileById(overlaySnapshot?.frameFilterId);
  const cropProfile: FrameCropProfile = {
    frameImageSrc: selectedProfile.frameImageSrc,
    frameScale: selectedProfile.frameScale,
    frameWidthScale: selectedProfile.frameWidthScale,
    bottomOffsetFaceRatio: selectedProfile.bottomOffsetFaceRatio,
    frameOffsetXFaceRatio: selectedProfile.frameOffsetXFaceRatio,
    frameOffsetYFaceRatio: selectedProfile.frameOffsetYFaceRatio,
    holeSeedXRatio: selectedProfile.holeSeedXRatio,
    holeSeedYRatio: selectedProfile.holeSeedYRatio,
    holeBottomMaxRatio: selectedProfile.holeBottomMaxRatio,
  };

  const photoImage = await loadImage(photoDataUrl);
  const frameImage = cropProfile.frameImageSrc
    ? await loadImage(cropProfile.frameImageSrc).catch(() => null)
    : null;

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
    return savedFrames.map((frame) =>
      drawShareCrop(
        photoImage,
        resolveSavedFrameCrop(frame, photoImage),
        frameImage,
        cropProfile,
        overlaySnapshot,
        particleImageMap,
      ),
    );
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

  return faceBoxes.map((faceBox) =>
    drawShareCrop(
      photoImage,
      resolveFrameCrop(faceBox, photoImage, cropProfile),
      frameImage,
      cropProfile,
      overlaySnapshot,
      particleImageMap,
    ),
  );
}
