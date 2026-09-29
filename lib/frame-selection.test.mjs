import assert from "node:assert/strict";
import test from "node:test";
import { selectFrame } from "./frame-selection.ts";

test("선택한 프레임을 다시 눌러도 프레임이 꺼지지 않는다", () => {
  assert.equal(selectFrame("bunny", "bunny"), "bunny");
  assert.equal(selectFrame("bunny", "cloud"), "cloud");
});
