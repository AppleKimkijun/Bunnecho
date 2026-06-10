type PencilXMarkProps = {
  size: number;
  className?: string;
};

export function PencilXMark({ size, className = "" }: PencilXMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      className={className}
    >
      <path
        d="M20 24 C28 26, 72 74, 80 78"
        stroke="#ffc8d8"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M80 22 C72 26, 28 74, 20 78"
        stroke="#ffc8d8"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M17 19 Q23 24 83 81"
        stroke="#ef4f73"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        opacity="0.92"
      />
      <path
        d="M83 17 Q77 23 17 81"
        stroke="#ef4f73"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        opacity="0.92"
      />
      <path
        d="M22 22 Q26 26 78 78"
        stroke="#ff8fab"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <path
        d="M78 22 Q74 26 22 78"
        stroke="#ff8fab"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <path
        d="M24 24 L76 76"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.28"
      />
      <path
        d="M76 24 L24 76"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.28"
      />
    </svg>
  );
}
