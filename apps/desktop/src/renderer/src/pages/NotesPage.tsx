import { useEffect } from 'react'
import { FileText, Plus, Trash2, Loader2 } from 'lucide-react'
import { useNotesStore } from '../stores/notes.store'
import { t } from '../i18n'

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function NotesPage() {
  const notes = useNotesStore((s) => s.notes)
  const selectedId = useNotesStore((s) => s.selectedId)
  const loading = useNotesStore((s) => s.loading)
  const load = useNotesStore((s) => s.load)
  const create = useNotesStore((s) => s.create)
  const remove = useNotesStore((s) => s.remove)
  const select = useNotesStore((s) => s.select)
  const updateTitle = useNotesStore((s) => s.updateTitle)
  const updateContent = useNotesStore((s) => s.updateContent)

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        <Loader2 size={24} className="animate-spin mr-3" />
        <span style={{ fontSize: 'var(--font-size-sm)' }}>{t('notes.loading')}</span>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left: note list */}
      <div className="w-64 shrink-0 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-bg-sidebar)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-[var(--color-primary)]" />
            <span className="font-semibold" style={{ fontSize: 'var(--font-size-base)' }}>
              {t('notes.title')}
            </span>
          </div>
          <button
            onClick={create}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-card)] transition-all text-[var(--color-primary)]"
            title={t('notes.newNote')}
          >
            <Plus size={20} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-[var(--color-text-muted)]">
              <FileText size={32} className="mb-2 opacity-40" />
              <p className="text-center" style={{ fontSize: 'var(--font-size-sm)' }}>
                {t('notes.noNotes')}
              </p>
              <button
                onClick={create}
                className="mt-3 px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white font-medium hover:opacity-90 transition-all"
                style={{ fontSize: 'var(--font-size-sm)' }}
              >
                {t('notes.createFirst')}
              </button>
            </div>
          ) : (
            notes.map((note) => (
              <button
                key={note.id}
                onClick={() => select(note.id)}
                className={`w-full text-left px-4 py-3 border-b border-[var(--color-border)] transition-all group ${
                  selectedId === note.id
                    ? 'bg-[var(--color-primary-light)]'
                    : 'hover:bg-[var(--color-bg-card)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p
                      className="font-medium truncate text-[var(--color-text)]"
                      style={{ fontSize: 'var(--font-size-sm)' }}
                    >
                      {note.title || t('notes.untitled')}
                    </p>
                    <p
                      className="text-[var(--color-text-muted)] mt-0.5"
                      style={{ fontSize: 'calc(11px * var(--font-scale))' }}
                    >
                      {formatDate(note.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      remove(note.id)
                    }}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-all shrink-0"
                    title={t('notes.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: editor */}
      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            {/* Title */}
            <div className="px-6 pt-6 pb-2">
              <input
                type="text"
                value={selectedNote.title}
                onChange={(e) => updateTitle(selectedNote.id, e.target.value)}
                placeholder={t('notes.titlePlaceholder')}
                className="w-full bg-transparent border-none outline-none font-bold text-[var(--color-text)]"
                style={{ fontSize: 'var(--font-size-xl)', minHeight: 'var(--min-target)' }}
              />
              <p
                className="text-[var(--color-text-muted)] mt-1"
                style={{ fontSize: 'calc(11px * var(--font-scale))' }}
              >
                {t('notes.lastModified')}: {formatDate(selectedNote.updatedAt)}
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 px-6 pb-6">
              <textarea
                value={selectedNote.content}
                onChange={(e) => updateContent(selectedNote.id, e.target.value)}
                placeholder={t('notes.contentPlaceholder')}
                className="w-full h-full resize-none bg-transparent border-none outline-none text-[var(--color-text)] leading-relaxed"
                style={{ fontSize: 'var(--font-size-base)' }}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
            <FileText size={48} className="mb-3 opacity-30" />
            <p style={{ fontSize: 'var(--font-size-sm)' }}>
              {t('notes.selectOrCreate')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
