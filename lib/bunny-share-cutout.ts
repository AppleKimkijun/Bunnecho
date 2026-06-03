import { detectFacesInImage, type FaceBox } from "@/lib/face-detection";

const OUTPUT_SIZE = 320;

type FrameCropProfile = {
  frameScale: number;
  bottomOffsetFaceRatio: number;
};

const BUNNY_CROP_PROFILE: FrameCropProfile = {
  frameScale: 2.2,
  bottomOffsetFaceRatio: 0.15,
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
    image.src = src;
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

  return canvas.toDataURL("image/png");
}

export async function createBunnyShareCutoutDataUrls(photoDataUrl: string) {
  const photoImage = await loadImage(photoDataUrl);

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
    return drawShareCrop(photoImage, cropX, cropY, frameSize);
  });
}

