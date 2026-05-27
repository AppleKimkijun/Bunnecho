function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
    image.src = src;
  });
}

function detectFaceLikeBounds(
  imageData: ImageData,
  width: number,
  height: number,
) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;

  const step = 3;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      const r = imageData.data[index];
      const g = imageData.data[index + 1];
      const b = imageData.data[index + 2];

      // Simple skin-range estimation in YCrCb-like space.
      const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

      const isSkin =
        yVal > 45 &&
        cb > 77 &&
        cb < 127 &&
        cr > 133 &&
        cr < 173 &&
        r > g &&
        r > b;

      if (!isSkin) {
        continue;
      }

      count += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (count < 150 || maxX < 0 || maxY < 0) {
    const size = Math.floor(Math.min(width, height) * 0.5);
    return {
      x: Math.floor((width - size) / 2),
      y: Math.floor((height - size) / 2),
      size,
    };
  }

  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  const size = Math.floor(Math.max(boxWidth, boxHeight) * 1.25);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  let x = Math.floor(centerX - size / 2);
  let y = Math.floor(centerY - size / 2);

  x = Math.max(0, Math.min(width - size, x));
  y = Math.max(0, Math.min(height - size, y));

  return {
    x,
    y,
    size: Math.max(80, Math.min(size, Math.min(width, height))),
  };
}

export async function createFaceCutoutDataUrl(photoDataUrl: string) {
  const image = await loadImage(photoDataUrl);

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.width;
  sourceCanvas.height = image.height;
  const sourceContext = sourceCanvas.getContext("2d");

  if (!sourceContext) {
    throw new Error("캔버스 초기화 실패");
  }

  sourceContext.drawImage(image, 0, 0);
  const imageData = sourceContext.getImageData(0, 0, image.width, image.height);
  const bounds = detectFaceLikeBounds(imageData, image.width, image.height);

  const outputSize = 320;
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputSize;
  outputCanvas.height = outputSize;
  const outputContext = outputCanvas.getContext("2d");

  if (!outputContext) {
    throw new Error("결과 캔버스 초기화 실패");
  }

  outputContext.clearRect(0, 0, outputSize, outputSize);
  outputContext.save();
  outputContext.beginPath();
  outputContext.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  outputContext.closePath();
  outputContext.clip();

  outputContext.drawImage(
    sourceCanvas,
    bounds.x,
    bounds.y,
    bounds.size,
    bounds.size,
    0,
    0,
    outputSize,
    outputSize,
  );
  outputContext.restore();

  return outputCanvas.toDataURL("image/png");
}