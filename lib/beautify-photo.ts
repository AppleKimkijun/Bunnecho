export function createSkinBeautyOverlay(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  skinMask: Float32Array,
  maskWidth: number,
  maskHeight: number,
): Uint8ClampedArray {
  if (rgba.length !== width * height * 4 || skinMask.length !== maskWidth * maskHeight) {
    throw new Error("피부 보정 입력 크기가 맞지 않습니다.");
  }

  const overlay = new Uint8ClampedArray(rgba.length);
  const spatialWeight = [1, 2, 3, 2, 1];
  const maskAt = (x: number, y: number) =>
    skinMask[Math.max(0, Math.min(maskHeight - 1, y)) * maskWidth +
      Math.max(0, Math.min(maskWidth - 1, x))];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const maskX = ((x + 0.5) / width) * maskWidth - 0.5;
      const maskY = ((y + 0.5) / height) * maskHeight - 0.5;
      const mx = Math.floor(maskX);
      const my = Math.floor(maskY);
      const fx = maskX - mx;
      const fy = maskY - my;
      const top = maskAt(mx, my) * (1 - fx) + maskAt(mx + 1, my) * fx;
      const bottom = maskAt(mx, my + 1) * (1 - fx) + maskAt(mx + 1, my + 1) * fx;
      const strength = Math.max(0, Math.min(1, (top * (1 - fy) + bottom * fy - 0.35) / 0.4));
      if (strength === 0) continue;

      const index = (y * width + x) * 4;
      const red = rgba[index];
      const green = rgba[index + 1];
      const blue = rgba[index + 2];
      let total = 0;
      let redTotal = 0;
      let greenTotal = 0;
      let blueTotal = 0;
      for (let dy = -2; dy <= 2; dy += 1) {
        const sampleY = Math.max(0, Math.min(height - 1, y + dy));
        for (let dx = -2; dx <= 2; dx += 1) {
          const sampleX = Math.max(0, Math.min(width - 1, x + dx));
          const sample = (sampleY * width + sampleX) * 4;
          const difference = (
            Math.abs(red - rgba[sample]) +
            Math.abs(green - rgba[sample + 1]) +
            Math.abs(blue - rgba[sample + 2])
          ) / 3;
          const weight = spatialWeight[dy + 2] * spatialWeight[dx + 2] *
            Math.max(0, 1 - difference / 45);
          total += weight;
          redTotal += rgba[sample] * weight;
          greenTotal += rgba[sample + 1] * weight;
          blueTotal += rgba[sample + 2] * weight;
        }
      }
      overlay[index] = redTotal / total + 8;
      overlay[index + 1] = greenTotal / total + 8;
      overlay[index + 2] = blueTotal / total + 8;
      overlay[index + 3] = strength * 0.62 * 255;
    }
  }
  return overlay;
}

let segmenterPromise: Promise<import("@mediapipe/tasks-vision").ImageSegmenter> | null = null;

function getSkinSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      return vision.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
        },
        runningMode: "IMAGE",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    })().catch((error) => {
      segmenterPromise = null;
      throw error;
    });
  }
  return segmenterPromise;
}

export async function preloadSkinBeautyModel() {
  await getSkinSegmenter();
}

export async function beautifyCapturedCanvas(canvas: HTMLCanvasElement) {
  const segmenter = await getSkinSegmenter();
  const workCanvas = document.createElement("canvas");
  const scale = Math.min(1, 960 / Math.max(canvas.width, canvas.height));
  workCanvas.width = Math.max(1, Math.round(canvas.width * scale));
  workCanvas.height = Math.max(1, Math.round(canvas.height * scale));
  const workContext = workCanvas.getContext("2d", { willReadFrequently: true });
  const photoContext = canvas.getContext("2d");
  if (!workContext || !photoContext) throw new Error("피부 보정 캔버스를 만들 수 없습니다.");
  workContext.drawImage(canvas, 0, 0, workCanvas.width, workCanvas.height);

  const result = segmenter.segment(workCanvas);
  try {
    const faceSkin = result.confidenceMasks?.[3];
    if (!faceSkin) throw new Error("얼굴 피부 마스크를 얻지 못했습니다.");
    const rgba = workContext.getImageData(0, 0, workCanvas.width, workCanvas.height).data;
    const overlay = createSkinBeautyOverlay(
      rgba,
      workCanvas.width,
      workCanvas.height,
      faceSkin.getAsFloat32Array(),
      faceSkin.width,
      faceSkin.height,
    );
    const effectCanvas = document.createElement("canvas");
    effectCanvas.width = workCanvas.width;
    effectCanvas.height = workCanvas.height;
    const effectContext = effectCanvas.getContext("2d");
    if (!effectContext) throw new Error("피부 보정 레이어를 만들 수 없습니다.");
    const imageData = effectContext.createImageData(effectCanvas.width, effectCanvas.height);
    imageData.data.set(overlay);
    effectContext.putImageData(imageData, 0, 0);
    photoContext.save();
    photoContext.setTransform(1, 0, 0, 1, 0, 0);
    photoContext.drawImage(effectCanvas, 0, 0, canvas.width, canvas.height);
    photoContext.restore();
  } finally {
    result.close();
  }
}
