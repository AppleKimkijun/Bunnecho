export type FrameVariantId = "plain" | "bunny" | "lop_bunny";

export type FrameProfile = {
  id: FrameVariantId;
  name: string;
  frameImageSrc: string | null;
  cssFilter: string;
  overlay: string;
  frameScale: number;
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
    // 캡처 결과 톤 보정 (미리보기에는 적용되지 않음)
    // 밝기: brightness(1.03~1.10)
    // 붉은기 완화: hue-rotate(0deg~4deg)
    cssFilter: "brightness(1) saturate(1.02) contrast(1.02) hue-rotate(2deg)",
    overlay: "transparent",
    frameScale: 2.2,
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
    cssFilter: "brightness(1) saturate(1.02) contrast(1.02) hue-rotate(2deg)",
    overlay: "transparent",
    frameScale: 2.2,
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
    cssFilter: "brightness(1) saturate(1.02) contrast(1.02) hue-rotate(2deg)",
    overlay: "transparent",
    frameScale: 2,
    bottomOffsetFaceRatio: 0.48,
    frameOffsetXFaceRatio: 0,
    frameOffsetYFaceRatio: 0,
    holeSeedXRatio: 0.5,
    holeSeedYRatio: 0.64,
  },
];

export function getFrameProfileById(id: string | undefined | null) {
  return FRAME_PROFILES.find((profile) => profile.id === id) ?? FRAME_PROFILES[0];
}
