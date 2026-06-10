type PolaroidPhotoProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  /** 보드 위 자연스러운 기울기 */
  rotationDeg?: number;
  emptyLabel?: string;
};

export function PolaroidPhoto({
  src,
  alt = "촬영한 사진",
  className = "",
  rotationDeg = -2.5,
  emptyLabel = "아직 촬영된 사진이 없습니다",
}: PolaroidPhotoProps) {
  return (
    <div
      className={`pointer-events-none h-full w-full select-none ${className}`}
      style={{ transform: `rotate(${rotationDeg}deg)` }}
    >
      <div className="flex h-full w-full flex-col bg-[#fafaf8] p-[5.5%] pb-[16%] shadow-[0_10px_28px_rgba(0,0,0,0.24),0_3px_8px_rgba(0,0,0,0.14)]">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[#ececec]">
          {src ? (
            <img
              src={src}
              alt={alt}
              className="block h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-3 text-center text-[0.72rem] leading-snug font-medium text-neutral-500">
              {emptyLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
