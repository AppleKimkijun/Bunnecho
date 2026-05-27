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

function drawInsideFrameMask(
  sourceCanvas: HTMLCanvasElement,
  cropX: number,
  cropY: number,
  frameSize: number,
  frameImage: HTMLImageElement | null,
) {
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = OUTPUT_SIZE;
  outputCanvas.height = OUTPUT_SIZE;
  const outputContext = outputCanvas.getContext("2d");

  if (!outputContext) {
    throw new Error("결과 캔버스 초기화 실패");
  }

  outputContext.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  outputContext.drawImage(
    sourceCanvas,
    cropX,
    cropY,
    frameSize,
    frameSize,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = OUTPUT_SIZE;
  maskCanvas.height = OUTPUT_SIZE;
  const maskContext = maskCanvas.getContext("2d");

  if (!maskContext) {
    throw new Error("마스크 캔버스 초기화 실패");
  }

  maskContext.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  maskContext.fillStyle = "#fff";
  maskContext.beginPath();
  maskContext.ellipse(
    OUTPUT_SIZE / 2,
    OUTPUT_SIZE * BUNNY_HOLE_CENTER_Y_RATIO,
    OUTPUT_SIZE * 0.265,
    OUTPUT_SIZE * 0.335,
    0,
    0,
    Math.PI * 2,
  );
  maskContext.closePath();
  maskContext.fill();

  outputContext.globalCompositeOperation = "destination-in";
  outputContext.drawImage(maskCanvas, 0, 0);
  outputContext.globalCompositeOperation = "source-over";

  if (frameImage) {
    outputContext.drawImage(frameImage, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  }

  return outputCanvas.toDataURL("image/png");
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

export async function createFaceCutoutDataUrls(photoDataUrl: string) {
  const image = await loadImage(photoDataUrl);
  const frameImage = await loadImage(BUNNY_FRAME_URL).catch(() => null);

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.width;
  sourceCanvas.height = image.height;
  const sourceContext = sourceCanvas.getContext("2d");

  if (!sourceContext) {
    throw new Error("캔버스 초기화 실패");
  }

  sourceContext.drawImage(image, 0, 0);
  const detectedFaces = await detectFacesInImage(image);

  const fallbackSize = Math.floor(Math.min(image.width, image.height) * 0.42);
  const fallback = {
    x: Math.floor((image.width - fallbackSize) / 2),
    y: Math.floor((image.height - fallbackSize) / 2),
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
    const { cropX, cropY, frameSize } = resolveFrameCrop(faceBox, image);
    return drawInsideFrameMask(
      sourceCanvas,
      cropX,
      cropY,
      frameSize,
      frameImage,
    );
  });
}

export async function createFaceCutoutDataUrl(photoDataUrl: string) {
  const cutouts = await createFaceCutoutDataUrls(photoDataUrl);
  return cutouts[0];
}
