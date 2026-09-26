/** 空状态轻插画：细线条 + 主题色点缀（empty=空星球 / search=搜索） */
export function EmptyArt({ kind }: { kind: 'empty' | 'search' }) {
  if (kind === 'search') {
    return (
      <svg width="88" height="88" viewBox="0 0 96 96" fill="none" aria-hidden className="text-ink2/45">
        <circle cx="44" cy="44" r="19" stroke="currentColor" strokeWidth="2" />
        <circle cx="44" cy="44" r="12" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
        <path d="m58.5 58.5 13 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path
          d="M75 20v8M71 24h8"
          stroke="var(--c-accent)"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.7"
        />
        <circle cx="20" cy="30" r="2" fill="var(--c-accent)" opacity="0.5" />
        <circle cx="82" cy="70" r="1.6" fill="currentColor" opacity="0.4" />
      </svg>
    )
  }
  return (
    <svg width="88" height="88" viewBox="0 0 96 96" fill="none" aria-hidden className="text-ink2/45">
      {/* 星球 + 轨道 */}
      <circle cx="48" cy="50" r="20" stroke="currentColor" strokeWidth="2" />
      <path d="M48 42v16M40 50h16" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
      <ellipse
        cx="48"
        cy="50"
        rx="34"
        ry="9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.45"
        transform="rotate(-16 48 50)"
      />
      <path d="M76 18l1.8 4.2L82 24l-4.2 1.8L76 30l-1.8-4.2L70 24l4.2-1.8z" fill="var(--c-accent)" opacity="0.55" />
      <circle cx="22" cy="24" r="1.8" fill="currentColor" opacity="0.35" />
      <circle cx="80" cy="72" r="2" fill="currentColor" opacity="0.3" />
    </svg>
  )
}
