export type AlphaShape = {
  width: number;
  height: number;
  alpha: Uint8Array;
  bounds: { left: number; top: number; right: number; bottom: number };
};

export type PlacedImage = { x: number; y: number; size: number };

export function makeAlphaShape(width: number, height: number, rgba: Uint8ClampedArray): AlphaShape {
  const alpha = new Uint8Array(width * height);
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      alpha[index] = rgba[index * 4 + 3];
      if (alpha[index] <= 16) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  return { width, height, alpha, bounds: { left, top, right, bottom } };
}

function getPlacement(image: PlacedImage, shape: AlphaShape) {
  const scale = Math.min(image.size / shape.width, image.size / shape.height);
  return {
    left: image.x + (image.size - shape.width * scale) / 2,
    top: image.y + (image.size - shape.height * scale) / 2,
    scale,
  };
}

export function getVisibleBounds(image: PlacedImage, shape: AlphaShape) {
  const placement = getPlacement(image, shape);
  return {
    left: placement.left + shape.bounds.left * placement.scale,
    top: placement.top + shape.bounds.top * placement.scale,
    right: placement.left + shape.bounds.right * placement.scale,
    bottom: placement.top + shape.bounds.bottom * placement.scale,
  };
}

function isOpaque(shape: AlphaShape, placement: ReturnType<typeof getPlacement>, x: number, y: number) {
  const pixelX = Math.floor((x - placement.left) / placement.scale);
  const pixelY = Math.floor((y - placement.top) / placement.scale);
  return pixelX >= 0 && pixelX < shape.width && pixelY >= 0 && pixelY < shape.height &&
    shape.alpha[pixelY * shape.width + pixelX] > 16;
}

export function visiblePixelsOverlap(a: PlacedImage, aShape: AlphaShape, b: PlacedImage, bShape: AlphaShape) {
  const aBounds = getVisibleBounds(a, aShape);
  const bBounds = getVisibleBounds(b, bShape);
  const left = Math.max(aBounds.left, bBounds.left);
  const top = Math.max(aBounds.top, bBounds.top);
  const right = Math.min(aBounds.right, bBounds.right);
  const bottom = Math.min(aBounds.bottom, bBounds.bottom);
  if (left >= right || top >= bottom) return false;

  const aPlacement = getPlacement(a, aShape);
  const bPlacement = getPlacement(b, bShape);
  for (let y = Math.floor(top); y < Math.ceil(bottom); y += 1) {
    for (let x = Math.floor(left); x < Math.ceil(right); x += 1) {
      const sampleX = x + 0.5;
      const sampleY = y + 0.5;
      if (isOpaque(aShape, aPlacement, sampleX, sampleY) &&
          isOpaque(bShape, bPlacement, sampleX, sampleY)) return true;
    }
  }
  return false;
}
