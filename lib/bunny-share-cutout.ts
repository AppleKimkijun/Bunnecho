import { detectFacesInImage, type FaceBox } from "@/lib/face-detection";

const FRAME_SCALE = 2.55;
const OUTPUT_SIZE = 320;
const BUNNY_FRAME_URL =
  "/img/%ED%94%84%EB%A0%88%EC%9E%84%201_%ED%86%A0%EB%81%BC.png";
const BUNNY_HOLE_CENTER_Y_RATIO = 0.61;
const BUNNY_BOTTOM_OFFSET_FACE_RATIO = 0.08;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
    image.src = src;
  });
}

function resolveFrameCrop(faceBox: FaceBox, image: HTMLImageElement) {
  const frameSize = Math.max(faceBox.width, faceBox.height) * FRAME_SCALE;
  let cropX = faceBox.x + faceBox.width / 2 - frameSize / 2;
  let cropY =
    faceBox.y +
    faceBox.height -
    frameSize +
    faceBox.height * BUNNY_BOTTOM_OFFSET_FACE_RATIO;

  cropX = Math.max(0, Math.min(image.width - frameSize, cropX));
  cropY = Math.max(0, Math.min(image.height - frameSize, cropY));

  return { cropX, cropY, frameSize };
}

function drawBunnyFrameCutout(
  photoImage: HTMLImageElement,
  cropX: number,
  cropY: number,
  frameSize: number,
  frameImage: HTMLImageElement | null,
) {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("결과 캔버스 초기화 실패");
  }

  ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  // 토끼 프레임 '안쪽'만 사진이 보이도록 클립
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    OUTPUT_SIZE / 2,
    OUTPUT_SIZE * BUNNY_HOLE_CENTER_Y_RATIO,
    OUTPUT_SIZE * 0.265,
    OUTPUT_SIZE * 0.335,
    0,
    0,
    Math.PI * 2,
  );
  ctx.closePath();
  ctx.clip();

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
  ctx.restore();

  // 프레임은 항상 위에 덮기
  if (frameImage) {
    ctx.drawImage(frameImage, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  }

  return canvas.toDataURL("image/png");
}

export async function createBunnyShareCutoutDataUrls(photoDataUrl: string) {
  const photoImage = await loadImage(photoDataUrl);
  const frameImage = await loadImage(BUNNY_FRAME_URL).catch(() => null);

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
    const { cropX, cropY, frameSize } = resolveFrameCrop(faceBox, photoImage);
    return drawBunnyFrameCutout(photoImage, cropX, cropY, frameSize, frameImage);
  });
}

