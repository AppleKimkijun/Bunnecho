import assert from "node:assert/strict";
import test from "node:test";

const values = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  },
  dispatchEvent: () => {},
};

const {
  clearSharedFaces,
  listSharedFaces,
  removeSharedFace,
  upsertSharedFaces,
  wasPhotoShared,
} = await import("./shared-face-store.ts");

const cutout = (dataUrl, index) => ({ dataUrl, frameIndices: [index] });

test("X로 삭제한 컷아웃도 같은 view-photo 사진에서 다시 공유할 수 있다", () => {
  const photoId = "permanently-removed-photo";
  upsertSharedFaces(photoId, [cutout("first", 0), cutout("second", 1)]);
  removeSharedFace(`${photoId}:0`);
  upsertSharedFaces(photoId, [cutout("first-again", 0), cutout("second-again", 1)]);

  assert.deepEqual(
    listSharedFaces().filter((item) => item.photoId === photoId).map((item) => item.id),
    [`${photoId}:0`, `${photoId}:1`],
  );

  clearSharedFaces();
  upsertSharedFaces(photoId, [cutout("first-after-clear", 0), cutout("second-after-clear", 1)]);
  assert.deepEqual(
    listSharedFaces().filter((item) => item.photoId === photoId).map((item) => item.id),
    [`${photoId}:0`, `${photoId}:1`],
  );
});

test("다른 창에서 지운 사진은 새 사진을 공유해도 복원되지 않는다", () => {
  const oldPhotoId = "removed-in-another-window";
  upsertSharedFaces(oldPhotoId, [cutout("old-face", 0)]);
  const oldId = `${oldPhotoId}:0`;

  // 다른 창에서 localStorage를 갱신했지만 이 창의 메모리 캐시는 아직 옛 목록이다.
  const removedIds = JSON.parse(values.get("bunnecho-removed-shared-faces") ?? "[]");
  values.set("bunnecho-removed-shared-faces", JSON.stringify([...removedIds, oldId]));
  values.set(
    "bunnecho-shared-faces",
    JSON.stringify(listSharedFaces().filter((item) => item.id !== oldId)),
  );

  upsertSharedFaces("newly-taken-photo", [cutout("new-face", 0)]);
  const saved = JSON.parse(values.get("bunnecho-shared-faces"));
  assert.equal(saved.some((item) => item.id === oldId), false);
});

test("붙은 프레임 묶음을 X로 지운 뒤에도 다시 공유할 수 있다", () => {
  const photoId = "joined-photo";
  upsertSharedFaces(photoId, [{ dataUrl: "joined", frameIndices: [0, 1] }]);
  assert.equal(wasPhotoShared(photoId), true);
  removeSharedFace(`${photoId}:0+1`);
  assert.equal(wasPhotoShared(photoId), true);
  assert.equal(upsertSharedFaces(photoId, [cutout("left", 0), cutout("right", 1)]), 2);
  assert.deepEqual(
    listSharedFaces().filter((item) => item.photoId === photoId).map((item) => item.id),
    [`${photoId}:0`, `${photoId}:1`],
  );
});
