"use client";

type MenuIconProps = {
  size?: number;
  color?: string;
} & React.SVGProps<SVGSVGElement>;

export function MenuIcon({ size = 20, color = "#717680", ...props }: MenuIconProps) {
  return (
    <svg 
      width={size} 
      height={(size / 20) * 14} 
      viewBox="0 0 20 14" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M1 7H19M1 1H19M1 13H19" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
