import { useState } from 'react'
import { Modal } from './Modal'
import { IconSparkles } from './icons'

const KEY = 'shiguang.onboarding.v1'

interface OnboardingState {
  steps?: [boolean, boolean, boolean]
}

function read(): OnboardingState {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as OnboardingState
  } catch {
    return {}
  }
}

/** 快速上手：三步清单（导入书签 / 装扩展 / 配 AI），从账户菜单打开 */
export function OnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, setState] = useState<OnboardingState>(read)
  const steps = state.steps ?? [false, false, false]

  const persist = (patch: OnboardingState) => {
    const next = { ...state, ...patch }
    setState(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }
  const toggle = (i: number) => {
    const arr = [...steps] as [boolean, boolean, boolean]
    arr[i] = !arr[i]
    persist({ steps: arr })
  }
  const done = steps.filter(Boolean).length

  const rows = [
    {
      title: '导入浏览器书签',
      desc: '一键把书签变成分类与卡片',
      btn: '去导入',
      action: () => {
        window.dispatchEvent(new CustomEvent('shiguang:open-data'))
        onClose()
      },
    },
    {
      title: '安装一键收藏扩展',
      desc: '浏览网页时随手收藏，支持划词存便签',
      btn: '查看指南',
      action: () => window.open('https://github.com/diaoyudao100/shiguang-nav#readme', '_blank', 'noopener'),
    },
    {
      title: '配置 AI 助手',
      desc: '自动生成网站简介与分类推荐',
      btn: '去配置',
      action: () => {
        window.dispatchEvent(new CustomEvent('shiguang:open-settings', { detail: 'ai' }))
        onClose()
      },
    },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-xl"
      title="快速上手"
      icon={
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <IconSparkles width={17} height={17} />
        </span>
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-ink2">三步完成基础设置，当前进度</span>
        <span className="rounded-full bg-hover px-2 py-0.5 text-[11px] tabular-nums text-ink2">{done}/3</span>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={r.title} className="flex items-center gap-2.5 rounded-xl border border-line bg-base/40 px-3.5 py-3">
            <button
              type="button"
              onClick={() => toggle(i)}
              title={steps[i] ? '标记为未完成' : '标记为已完成'}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors ${
                steps[i]
                  ? 'border-accent bg-accent text-white'
                  : 'border-line-strong text-transparent hover:border-accent/60'
              }`}
            >
              ✓
            </button>
            <div className="min-w-0 flex-1">
              <div className={`truncate text-[13px] font-medium ${steps[i] ? 'text-ink2/60 line-through' : 'text-ink'}`}>
                {r.title}
              </div>
              <div className="truncate text-[11px] text-ink2/70">{r.desc}</div>
            </div>
            <button
              type="button"
              onClick={r.action}
              className="shrink-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-[11px] text-ink2 transition-colors hover:border-accent/40 hover:text-accent"
            >
              {r.btn}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-4 text-ink2/55">
        三步全部完成后勾选状态会保留，可随时回来对照进度。
      </p>
    </Modal>
  )
}
