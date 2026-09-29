import assert from "node:assert/strict";
import test from "node:test";
import { makeAlphaShape, getVisibleBounds, visiblePixelsOverlap } from "./share-face-collision.ts";

function shape(rows) {
  const height = rows.length;
  const width = rows[0].length;
  const rgba = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) => [...row].forEach((pixel, x) => {
    rgba[(y * width + x) * 4 + 3] = pixel === "#" ? 255 : 0;
  }));
  return makeAlphaShape(width, height, rgba);
}

test("투명 여백이 아니라 보이는 픽셀의 가장자리에서 벽에 닿는다", () => {
  const pixels = shape([".....", ".###.", ".###.", "....."]);
  assert.deepEqual(getVisibleBounds({ x: -10, y: -10, size: 50 }, pixels), {
    left: 0, top: 5, right: 30, bottom: 25,
  });
});

test("이미지 박스가 겹쳐도 투명 픽셀끼리는 충돌하지 않는다", () => {
  const left = shape(["#...", "#...", "#...", "#..."]);
  const right = shape(["...#", "...#", "...#", "...#"]);
  assert.equal(visiblePixelsOverlap({ x: 0, y: 0, size: 40 }, left, { x: 0, y: 0, size: 40 }, right), false);
  assert.equal(visiblePixelsOverlap({ x: 30, y: 0, size: 40 }, left, { x: 0, y: 0, size: 40 }, right), true);
});

test("가운데가 빈 프레임 안으로 다른 이미지가 들어와도 보이는 픽셀 전에는 충돌하지 않는다", () => {
  const ring = shape(["#####", "#...#", "#...#", "#...#", "#####"]);
  const center = shape([".....", ".....", "..#..", ".....", "....."]);
  assert.equal(visiblePixelsOverlap({ x: 0, y: 0, size: 50 }, ring, { x: 0, y: 0, size: 50 }, center), false);
});
