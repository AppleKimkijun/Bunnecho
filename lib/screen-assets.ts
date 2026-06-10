import { FRAME_PROFILES } from "@/lib/frame-profiles";

const HOME_PARTICLE_ICON_URLS = [
  "/img/particle_icon/파티클 별.png",
  "/img/particle_icon/파티클 사과.png",
  "/img/particle_icon/파티클 토끼.png",
  "/img/particle_icon/파티클 음표.png",
  "/img/particle_icon/파티클 장미.png",
] as const;

const HOME_FRAME_THUMB_URLS = [
  "/img/frame/lop_bunny.png",
  "/img/frame/bunny.png",
  "/img/frame/3_구름.png",
] as const;

const HOME_PARTICLE_EFFECT_URLS = [
  "/img/particle/star.png",
  "/img/particle/apple.png",
  "/img/particle/bunny.png.png",
  "/img/particle/rose.png",
  "/img/particle/note.png",
] as const;

export const HOME_SCREEN_IMAGE_URLS = [
  "/img/background/Desktop.png",
  "/img/logo/로고 이미지.png",
  "/img/icon/1_카메라 창 이름.png",
  "/img/icon/1_카메라 버튼.png",
  ...HOME_PARTICLE_ICON_URLS,
  ...HOME_FRAME_THUMB_URLS,
  ...HOME_PARTICLE_EFFECT_URLS,
  ...FRAME_PROFILES.flatMap((profile) =>
    profile.frameImageSrc ? [profile.frameImageSrc] : [],
  ),
] as const;

export const VIEW_PHOTO_SCREEN_IMAGE_URLS = [
  "/img/background/background2.png",
  "/img/board/board.png",
  "/img/board/board_logo.png",
  "/img/board/polaroid.png",
  "/img/button/카메라 이동.png",
  "/img/button/공유 버튼.png",
] as const;

export const SHARE_FACE_SCREEN_IMAGE_URLS = [
  "/img/background/main-bg.png",
] as const;

/** 앱 진입 시 한 번에 preload — 화면 마운트 전 디코딩 완료 */
export const ALL_APP_IMAGE_URLS = [
  ...HOME_SCREEN_IMAGE_URLS,
  ...VIEW_PHOTO_SCREEN_IMAGE_URLS,
  ...SHARE_FACE_SCREEN_IMAGE_URLS,
] as const;
