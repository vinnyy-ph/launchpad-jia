type ChevronProps = {
  direction?: "up" | "down";
  size?: number;
  color?: string;
}

export function Chevron({ direction = "up", size = 16, color = "#A4A7AE" }: ChevronProps) {
  const path = direction === "up"
    ? "M12 10L8 6L4 10"
    : "M5 7.5L10 12.5L15 7.5";

  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d={path} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}