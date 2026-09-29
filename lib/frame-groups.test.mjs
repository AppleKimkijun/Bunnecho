import assert from "node:assert/strict";
import test from "node:test";
import { groupTouchingFrames } from "./frame-groups.ts";

const rect = (x, y, width = 4, height = 4) => ({
  cropX: x,
  cropY: y,
  cropWidth: width,
  cropHeight: height,
});

function mask(visiblePixels) {
  const data = new Uint8ClampedArray(4 * 4 * 4);
  for (const [x, y] of visiblePixels) data[(y * 4 + x) * 4 + 3] = 255;
  return { width: 4, height: 4, data };
}

const solid = mask(Array.from({ length: 16 }, (_, index) => [index % 4, Math.floor(index / 4)]));

test("닿거나 겹치는 프레임은 한 묶음이고 떨어진 프레임은 별개다", () => {
  assert.deepEqual(groupTouchingFrames([rect(0, 0), rect(3, 0)], [solid, solid]), [[0, 1]]);
  assert.deepEqual(groupTouchingFrames([rect(0, 0), rect(6, 0)], [solid, solid]), [[0], [1]]);
});

test("사각형만 겹치고 실제 이미지가 닿지 않으면 묶지 않는다", () => {
  const left = mask(Array.from({ length: 4 }, (_, y) => [0, y]));
  const right = mask(Array.from({ length: 4 }, (_, y) => [3, y]));
  assert.deepEqual(groupTouchingFrames([rect(0, 0), rect(2, 0)], [left, right]), [[0], [1]]);
});

test("연결된 프레임 셋은 하나의 묶음으로 모인다", () => {
  assert.deepEqual(
    groupTouchingFrames([rect(0, 0), rect(3, 0), rect(6, 0)], [solid, solid, solid]),
    [[0, 1, 2]],
  );
});
