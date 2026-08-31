import { useStore } from '../hooks/useStore'

interface BrandLogoProps {
  /** 容器尺寸/圆角类，如 'h-10 w-10 rounded-[13px]' */
  boxCls: string
  /** 兜底字母的字号类（仅未设置图标时生效），如 'text-[18px]' */
  letterCls?: string
  /** 站点标题，未设置图标时取首字 */
  title: string
  /** 图标地址；不传则读取设置里的网站图标 */
  src?: string
}

/** 站点品牌图标：设置了网站图标时显示图片，否则显示标题首字的渐变方块 */
export function BrandLogo({ boxCls, letterCls = '', title, src }: BrandLogoProps) {
  const { data } = useStore()
  const icon = (src ?? data.settings.favicon ?? '').trim()
  const baseCls = `relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-[var(--c-accent)] to-[var(--c-accent2)] shadow-[var(--shadow-glow)] ${boxCls}`
  if (icon) {
    return (
      <div className={baseCls}>
        <img src={icon} alt="" className="h-full w-full object-cover" draggable={false} />
        <span
          className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/25"
          style={{ borderRadius: 'inherit' }}
        />
      </div>
    )
  }
  const letter = title.trim().charAt(0) || '拾'
  return (
    <div className={`${baseCls} font-semibold text-white ${letterCls}`}>
      <span className="drop-shadow-sm">{letter}</span>
      <span
        className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/25"
        style={{ borderRadius: 'inherit' }}
      />
    </div>
  )
}
