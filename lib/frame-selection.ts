import type { FrameVariantId } from "./frame-profiles";

export function selectFrame(_current: FrameVariantId | null, selected: FrameVariantId): FrameVariantId {
  return selected;
}
