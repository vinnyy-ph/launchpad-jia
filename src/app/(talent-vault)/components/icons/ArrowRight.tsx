"use client";

type ArrowRightProps = {
  size?: number;
  color?: string;
}

export function ArrowRight({ size = 14, color = "white" }: ArrowRightProps) {
  return (
    <svg width={size} height={size / 2} viewBox="0 0 14 7" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.0083 2.5H0V4.16667H10.0083V6.66667L13.3333 3.33333L10.0083 0V2.5Z" fill={color} />
    </svg>
  )
}