import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { Field, Modal, btnPrimary, inputCls } from './Modal'
import { IconArrowUp, IconTrash, IconPlus } from './icons'
import { useToast } from './Toast'

export function CategoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, addCategory, renameCategory, deleteCategory, moveCategory } = useStore()
  const toast = useToast()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const countOf = (id: string) => data.sites.filter((s) => s.categoryId === id).length

  const commitRename = () => {
    if (editingId && editingName.trim()) {
      renameCategory(editingId, editingName)
      toast('已重命名')
    }
    setEditingId(null)
  }

  return (
    <Modal open={open} title="管理分类" onClose={onClose} width="max-w-md">
      <div className="flex flex-col gap-1.5">
        {data.categories.map((c, i) => (
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
                onClick={() => {
                  if (window.confirm(`删除分类「${c.name}」？其中的站点会移入其他分类。`)) {
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
        ))}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (addCategory(newName)) {
            toast('分类已创建')
            setNewName('')
          }
        }}
      >
        <input className={inputCls + ' flex-1'} placeholder="新分类名称" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" className={btnPrimary}>
          <IconPlus width={14} height={14} /> 新建
        </button>
      </form>
      <p className="mt-3 text-xs text-ink2">点击分类名称可重命名；删除分类时，其中的站点会自动移入其他分类。</p>
    </Modal>
  )
}

export { Field }
