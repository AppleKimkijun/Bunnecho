export type FrameRect = {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
};

export type FrameMask = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

function visibleAt(mask: FrameMask, rect: FrameRect, x: number, y: number) {
  const px = Math.max(0, Math.min(mask.width - 1, Math.floor(((x - rect.cropX) / rect.cropWidth) * mask.width)));
  const py = Math.max(0, Math.min(mask.height - 1, Math.floor(((y - rect.cropY) / rect.cropHeight) * mask.height)));
  return mask.data[(py * mask.width + px) * 4 + 3] > 16;
}

function framesTouch(a: FrameRect, aMask: FrameMask, b: FrameRect, bMask: FrameMask) {
  const left = Math.max(a.cropX, b.cropX);
  const top = Math.max(a.cropY, b.cropY);
  const right = Math.min(a.cropX + a.cropWidth, b.cropX + b.cropWidth);
  const bottom = Math.min(a.cropY + a.cropHeight, b.cropY + b.cropHeight);
  if (right < left || bottom < top) return false;

  const columns = Math.max(1, Math.ceil((right - left) / Math.min(a.cropWidth / aMask.width, b.cropWidth / bMask.width)));
  const rows = Math.max(1, Math.ceil((bottom - top) / Math.min(a.cropHeight / aMask.height, b.cropHeight / bMask.height)));
  for (let row = 0; row < rows; row += 1) {
    const y = top + ((row + 0.5) / rows) * (bottom - top);
    for (let column = 0; column < columns; column += 1) {
      const x = left + ((column + 0.5) / columns) * (right - left);
      if (visibleAt(aMask, a, x, y) && visibleAt(bMask, b, x, y)) return true;
    }
  }
  return false;
}

export function groupTouchingFrames(rects: FrameRect[], masks: FrameMask[]) {
  const groups: number[][] = [];
  const visited = new Set<number>();
  for (let index = 0; index < rects.length; index += 1) {
    if (visited.has(index)) continue;
    const group = [index];
    visited.add(index);
    for (let position = 0; position < group.length; position += 1) {
      const current = group[position];
      for (let other = 0; other < rects.length; other += 1) {
        if (visited.has(other) || !framesTouch(rects[current], masks[current], rects[other], masks[other])) continue;
        visited.add(other);
        group.push(other);
      }
    }
    groups.push(group.sort((a, b) => a - b));
  }
  return groups;
}
