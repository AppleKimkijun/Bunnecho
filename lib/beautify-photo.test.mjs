import assert from "node:assert/strict";
import test from "node:test";
import { createSkinBeautyOverlay } from "./beautify-photo.ts";

function photo(width, height, color) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) rgba.set([...color, 255], i * 4);
  return rgba;
}

test("피부 영역만 부드럽고 밝게 보정하며 눈·배경은 건드리지 않는다", () => {
  const width = 5;
  const height = 5;
  const rgba = photo(width, height, [100, 90, 80]);
  rgba.set([125, 115, 105, 255], (2 * width + 2) * 4);
  const skinMask = new Float32Array(width * height).fill(1);
  skinMask[0] = 0;
  skinMask[1 * width + 1] = 0;

  const overlay = createSkinBeautyOverlay(rgba, width, height, skinMask, width, height);
  const center = (2 * width + 2) * 4;
  assert.ok(overlay[center] < rgba[center], "중앙의 튀는 피부색은 완화된다");
  assert.ok(overlay[center + 3] > 0, "피부에만 보정 레이어가 적용된다");
  assert.equal(overlay[3], 0, "배경은 투명하게 남는다");
  assert.equal(overlay[(1 * width + 1) * 4 + 3], 0, "눈처럼 마스크가 제외한 곳은 선명하게 남는다");
});

test("피부가 감지되지 않으면 보정 레이어는 비어 있다", () => {
  const overlay = createSkinBeautyOverlay(
    photo(2, 2, [100, 90, 80]), 2, 2, new Float32Array(4), 2, 2,
  );
  assert.deepEqual([...overlay], Array(16).fill(0));
});
