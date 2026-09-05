import { useState } from 'react'
import { Palette } from 'lucide-react'
import { useStore } from '../hooks/useStore'
import { Field, Modal, btnPrimary, inputCls } from './Modal'
import { IconArrowUp, IconTrash, IconPlus } from './icons'
import { IconPicker } from './IconPicker'
import { categoryIcon } from '../lib/categoryIcons'
import { useToast } from './Toast'
import { useConfirm } from './Confirm'

export function CategoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, addCategory, renameCategory, setCategoryIcon, deleteCategory, moveCategory } = useStore()
  const toast = useToast()
  const confirm = useConfirm()
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  /** 图标选择器作用对象：'new' = 新建分类，其他 = 分类 id */
  const [pickerTarget, setPickerTarget] = useState<string | null>(null)
  const [pickerValue, setPickerValue] = useState('')

  const countOf = (id: string) => data.sites.filter((s) => s.categoryId === id).length

  const commitRename = () => {
    if (editingId && editingName.trim()) {
      renameCategory(editingId, editingName)
      toast('已重命名')
    }
    setEditingId(null)
  }

  const commitPicker = (icon: string) => {
    if (pickerTarget === 'new') setNewIcon(icon)
    else if (pickerTarget) setCategoryIcon(pickerTarget, icon)
  }

  return (
    <Modal open={open} title="管理分类" onClose={onClose} width="max-w-md" closeOnEsc={pickerTarget === null}>
      <div className="flex flex-col gap-1.5">
        {data.categories.map((c, i) => {
          return (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-xl border border-line bg-base px-3 py-2"
            >
              {editingId === c.id ? (
                <input
                  autoFocus
                  className={inputCls + ' py-1'}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
              ) : (
                <button
                  className="min-w-0 flex-1 truncate text-left text-sm hover:text-accent"
                  title="点击重命名"
                  onClick={() => {
                    setEditingId(c.id)
                    setEditingName(c.name)
                  }}
                >
                  {c.name}
                </button>
              )}
              <span className="shrink-0 text-xs text-ink2">{countOf(c.id)} 站点</span>
              <div className="flex shrink-0 gap-0.5 text-ink2">
                <button
                  type="button"
                  title="修改图标"
                  aria-label={`修改「${c.name}」的图标`}
                  onClick={() => {
                    setPickerTarget(c.id)
                    setPickerValue(c.icon || '')
                  }}
                  className="rounded-md p-1 hover:bg-hover hover:text-accent"
                >
                  <CatIcon name={c.icon || ''} size={13} />
                </button>
                <button
                  disabled={i === 0}
                  onClick={() => moveCategory(c.id, -1)}
                  className="rounded-md p-1 hover:bg-hover hover:text-ink disabled:opacity-30"
                  title="上移"
                >
                  <IconArrowUp width={13} height={13} />
                </button>
                <button
                  disabled={i === data.categories.length - 1}
                  onClick={() => moveCategory(c.id, 1)}
                  className="rounded-md p-1 hover:bg-hover hover:text-ink disabled:opacity-30"
                  title="下移"
                >
                  <IconArrowUp width={13} height={13} className="rotate-180" />
                </button>
                <button
                  onClick={async () => {
                    const siteCount = countOf(c.id)
                    const ok = await confirm({
                      danger: true,
                      title: '删除分类',
                      message: (
                        <>
                          确定删除分类「<span className="font-medium text-ink">{c.name}</span>」吗？
                          {siteCount > 0 ? (
                            <>
                              <br />
                              其中的 <span className="font-medium text-ink">{siteCount}</span>{' '}
                              个站点会移入其他分类。
                            </>
                          ) : (
                            '该分类下没有站点。'
                          )}
                        </>
                      ),
                      okText: '删除',
                    })
                    if (ok) {
                      deleteCategory(c.id)
                      toast('分类已删除')
                    }
                  }}
                  className="rounded-md p-1 hover:bg-hover hover:text-danger"
                  title="删除"
                >
                  <IconTrash width={13} height={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (addCategory(newName, newIcon)) {
            toast('分类已创建')
            setNewName('')
            setNewIcon('')
          }
        }}
      >
        <button
          type="button"
          title={newIcon ? '修改图标' : '选择图标'}
          aria-label="选择分类图标"
          onClick={() => {
            setPickerTarget('new')
            setPickerValue(newIcon)
          }}
          className="flex h-[38px] w-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-base/60 text-ink2 transition-colors hover:border-accent/50 hover:text-accent"
        >
          {newIcon ? <CatIcon name={newIcon} size={14} /> : <Palette width={15} height={15} />}
        </button>
        <input className={inputCls + ' min-w-0 flex-1'} placeholder="新分类名称" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" className={btnPrimary}>
          <IconPlus width={14} height={14} /> 新建
        </button>
      </form>
      <p className="mt-3 text-xs text-ink2">点击分类名称可重命名、点击图标可换图标；删除分类时，其中的站点会自动移入其他分类。</p>

      <IconPicker
        open={pickerTarget !== null}
        value={pickerValue}
        onPick={commitPicker}
        onClose={() => setPickerTarget(null)}
      />
    </Modal>
  )
}

function CatIcon({ name, size = 14 }: { name: string; size?: number }) {
  const I = categoryIcon(name)
  return <I width={size} height={size} />
}

export { Field }
