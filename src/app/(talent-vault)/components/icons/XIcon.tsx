"use client";

type XIconProps = {
  size?: number;
  color?: string;
} & React.SVGProps<SVGSVGElement>;

export function XIcon({ size = 20, color = "#535862", ...props }: XIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 20 20" 
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M15 5L5 15M5 5L15 15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
