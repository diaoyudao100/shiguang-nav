import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const base = (props: P) => ({
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})

export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)
export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconPin = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 17v5" />
    <path d="M9 3h6l-1 7 3 3H7l3-3-1-7z" />
  </svg>
)
export const IconEdit = (p: P) => (
  <svg {...base(p)}>
    <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
)
export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />
  </svg>
)
export const IconSun = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
export const IconMoon = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
  </svg>
)
export const IconMonitor = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8m-4-4v4" />
  </svg>
)
export const IconGrid = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
)
export const IconFolder = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
)
export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)
export const IconUpload = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </svg>
)
export const IconDownload = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
)
export const IconX = (p: P) => (
  <svg {...base(p)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)
export const IconExternal = (p: P) => (
  <svg {...base(p)}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
  </svg>
)
export const IconSparkles = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.9 2.4L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.6L19 15z" />
  </svg>
)
export const IconGlobe = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" />
  </svg>
)
export const IconArrowUp = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 19V5m-7 7 7-7 7 7" />
  </svg>
)
export const IconMenu = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)
export const IconGithub = (p: P) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17.3 4.9 18.3 5.2 18.3 5.2c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
  </svg>
)

export const IconWechat = (p: P) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M9.5 3C5.36 3 2 5.9 2 9.48c0 2 1.02 3.78 2.62 4.98l-.66 2.1 2.35-1.24c.6.18 1.23.3 1.9.34a5.6 5.6 0 0 1-.15-1.28c0-3.3 3.06-5.98 6.84-5.98.23 0 .45.01.67.03C14.9 5.24 12.45 3 9.5 3zM7 7.6a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8zm5 0a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8z" />
    <path d="M22 14.38c0-2.99-2.91-5.4-6.5-5.4S9 11.4 9 14.38s2.91 5.4 6.5 5.4c.71 0 1.4-.1 2.03-.29l2.1 1.11-.6-1.9C20.98 17.68 22 16.14 22 14.38zm-8.7-1.18a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6zm4.4 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6z" />
  </svg>
)

export const IconGoogle = (p: P) => (
  <svg width={18} height={18} viewBox="0 0 24 24" {...p}>
    <path
      fill="#4285F4"
      d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3a7.26 7.26 0 0 1-10.8-3.81H1.28v3.09A12 12 0 0 0 12 24z"
    />
    <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.28a12 12 0 0 0 0 10.74l3.99-3.09z" />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.98 11.98 0 0 0 1.28 6.63l3.99 3.09A7.26 7.26 0 0 1 12 4.75z"
    />
  </svg>
)

export const IconLinuxdo = (p: P) => (
  <svg width={18} height={18} viewBox="0 0 24 24" {...p}>
    <rect width="24" height="24" rx="6" fill="#22272E" />
    <path
      d="M7 5.5h3.1v10.2c0 .7.4 1.1 1.2 1.1h4.2c.8 0 1.2-.4 1.2-1.1V5.5H19v10.6c0 2-1.3 3.4-3.5 3.4h-5c-2.2 0-3.5-1.4-3.5-3.4V5.5z"
      fill="#F0F6FC"
    />
    <circle cx="16.6" cy="7.2" r="1.5" fill="#4C8DD8" />
  </svg>
)

export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

export const IconInfo = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5m0-8h.01" />
  </svg>
)
export const IconMail = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
)
export const IconBot = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="8" width="16" height="12" rx="3" />
    <path d="M12 8V4m-6 8h.01M18 12h.01M9 16h6" />
    <circle cx="12" cy="3" r="1" />
  </svg>
)
export const IconPalette = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-1.8a1.7 1.7 0 0 0-1.2 2.9c.4.4.5 1 .2 1.5-.3.4-.9.6-1.2.6z" />
    <circle cx="7.5" cy="11.5" r="0.5" />
    <circle cx="10.5" cy="7.5" r="0.5" />
    <circle cx="15" cy="8.5" r="0.5" />
  </svg>
)
export const IconDatabase = (p: P) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </svg>
)
export const IconKey = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="14" r="4" />
    <path d="m11 11 9-9m-3 3 3 3m-6 0 2 2" />
  </svg>
)
export const IconEye = (p: P) => (
  <svg {...base(p)}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
export const IconEyeOff = (p: P) => (
  <svg {...base(p)}>
    <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a17.9 17.9 0 0 1-2.16 2.92M6.61 6.61A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61M3 3l18 18" />
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
  </svg>
)
export const IconImage = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-4.6-4.6a2 2 0 0 0-2.8 0L5 19" />
  </svg>
)
export const IconSort = (p: P) => (
  <svg {...base(p)}>
    <path d="m3 8 4-4 4 4" />
    <path d="M7 4v16" />
    <path d="m21 16-4 4-4-4" />
    <path d="M17 20V4" />
  </svg>
)
export const IconStickyNote = (p: P) => (
  <svg {...base(p)}>
    <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11l5-5V5a2 2 0 0 0-2-2z" />
    <path d="M14 3v4a2 2 0 0 0 2 2h4" />
  </svg>
)
export const IconChevronLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="m15 18-6-6 6-6" />
  </svg>
)
export const IconChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 18 6-6-6-6" />
  </svg>
)
export const IconChevronUp = (p: P) => (
  <svg {...base(p)}>
    <path d="m18 15-6-6-6 6" />
  </svg>
)
export const IconChevronDown = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
