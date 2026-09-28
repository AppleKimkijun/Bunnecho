import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldResetStorage } from "./storage-reset.ts";

test("share-face 창은 기존 공유 데이터를 초기화하지 않는다", () => {
  assert.equal(shouldResetStorage("/share-face"), false);
});
