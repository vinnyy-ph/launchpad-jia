type UploadIconProps = {
  size?: number;
  color?: string;
}

export function UploadIcon({ size = 20, color = "#181D27" }: UploadIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16.6667 12.5V15C16.6667 15.442 16.4911 15.8659 16.1785 16.1785C15.866 16.4911 15.442 16.6667 15 16.6667H5C4.55797 16.6667 4.13405 16.4911 3.82149 16.1785C3.50893 15.8659 3.33333 15.442 3.33333 15V12.5M13.3333 6.66667L10 3.33333M10 3.33333L6.66667 6.66667M10 3.33333V12.5"
        stroke={color}
        strokeWidth="1.67"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
