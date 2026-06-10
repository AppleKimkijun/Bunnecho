export type FrameVariantId = "plain" | "bunny" | "lop_bunny" | "cloud";

export type FrameProfile = {
  id: FrameVariantId;
  name: string;
  frameImageSrc: string | null;
  cssFilter: string;
  overlay: string;
  frameScale: number;
  // 1보다 크면 프레임 가로로 늘림 (정사각형 박스 대비)
  frameWidthScale: number;
  bottomOffsetFaceRatio: number;
  // 좌우 미세 이동 (양수: 오른쪽, 음수: 왼쪽), 얼굴 너비 비율 단위
  frameOffsetXFaceRatio: number;
  // 상하 미세 이동 (양수: 아래, 음수: 위), 얼굴 높이 비율 단위
  frameOffsetYFaceRatio: number;
  holeSeedXRatio: number;
  holeSeedYRatio: number;
};

export const FRAME_PROFILES: FrameProfile[] = [
  {
    id: "plain",
    name: "기본 필터",
    frameImageSrc: null,
    cssFilter: "none",
    overlay: "transparent",
    frameScale: 2.2,
    frameWidthScale: 1,
    bottomOffsetFaceRatio: 0.15,
    frameOffsetXFaceRatio: 0,
    frameOffsetYFaceRatio: 0,
    holeSeedXRatio: 0.5,
    holeSeedYRatio: 0.62,
  },
  {
    id: "bunny",
    name: "기본 버니 필터",
    frameImageSrc: "/img/frame/bunny.png",
    cssFilter: "none",
    overlay: "transparent",
    frameScale: 2.2,
    frameWidthScale: 1,
    bottomOffsetFaceRatio: 0.15,
    frameOffsetXFaceRatio: 0,
    frameOffsetYFaceRatio: 0,
    holeSeedXRatio: 0.5,
    holeSeedYRatio: 0.62,
  },
  {
    id: "lop_bunny",
    name: "롭 버니 필터",
    frameImageSrc: "/img/frame/lop_bunny.png",
    cssFilter: "none",
    overlay: "transparent",
    frameScale: 2,
    frameWidthScale: 1,
    bottomOffsetFaceRatio: 0.48,
    frameOffsetXFaceRatio: 0,
    frameOffsetYFaceRatio: 0,
    holeSeedXRatio: 0.5,
    holeSeedYRatio: 0.64,
  },
  {
    id: "cloud",
    name: "구름 필터",
    frameImageSrc: "/img/frame/3_구름.png",
    cssFilter: "none",
    overlay: "transparent",
    frameScale: 2.2,
    frameWidthScale: 1.5,
    bottomOffsetFaceRatio: 0.15,
    frameOffsetXFaceRatio: 0,
    frameOffsetYFaceRatio: 0,
    // 구름 프레임 문(투명 구역) 쪽 시드
    holeSeedXRatio: 0.72,
    holeSeedYRatio: 0.66,
  },
];

export function getFrameProfileById(id: string | undefined | null) {
  return FRAME_PROFILES.find((profile) => profile.id === id) ?? FRAME_PROFILES[0];
}
