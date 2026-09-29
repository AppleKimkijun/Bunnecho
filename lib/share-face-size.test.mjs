import assert from "node:assert/strict";
import test from "node:test";
import { getShareFaceBubbleSize } from "./share-face-size.ts";

test("화면이 작아지면 사진도 작아지고 큰 묶음도 화면을 지나치게 차지하지 않는다", () => {
  assert.equal(getShareFaceBubbleSize(210, 1, 1440, 900), 210);
  assert.equal(getShareFaceBubbleSize(210, 2, 1440, 900), 290);
  assert.ok(Math.abs(getShareFaceBubbleSize(210, 1, 720, 450) - 115.5) < 0.001);
  assert.equal(getShareFaceBubbleSize(210, 2, 320, 400), 144);
});
