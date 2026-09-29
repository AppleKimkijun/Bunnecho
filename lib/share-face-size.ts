export function getShareFaceBubbleSize(baseSize: number, frameCount: number, width: number, height: number) {
  const scale = Math.max(0.55, Math.min(width / 1440, height / 900, 1.2));
  return Math.min(
    baseSize * scale * (frameCount > 1 ? Math.sqrt(frameCount) : 1),
    290 * scale,
    width * 0.45,
    height * 0.45,
  );
}
