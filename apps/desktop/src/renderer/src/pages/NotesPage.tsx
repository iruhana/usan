import { useCallback, useEffect, useState } from 'react'
import { FileText, Plus, Trash2, Loader2, Sparkles } from 'lucide-react'
import { useNotesStore } from '../stores/notes.store'
import { useUndoStore } from '../stores/undo.store'
import { t } from '../i18n'
import { Button, IconButton } from '../components/ui'

function formatDate(ts: number): string {
  const date = new Date(ts)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function NotesPage() {
  const notes = useNotesStore((state) => state.notes)
  const selectedId = useNotesStore((state) => state.selectedId)
  const loading = useNotesStore((state) => state.loading)
  const load = useNotesStore((state) => state.load)
  const create = useNotesStore((state) => state.create)
  const remove = useNotesStore((state) => state.remove)
  const select = useNotesStore((state) => state.select)
  const updateTitle = useNotesStore((state) => state.updateTitle)
  const updateContent = useNotesStore((state) => state.updateContent)

  const showUndo = useUndoStore((state) => state.show)
  const selectedNote = notes.find((note) => note.id === selectedId) ?? null
  const [focusIndex, setFocusIndex] = useState(-1)

  const handleDelete = useCallback((noteId: string) => {
    const note = notes.find((item) => item.id === noteId)
    remove(noteId)
    if (note) {
      showUndo(t('undo.noteDeleted'), () => {
        useNotesStore.setState((state) => ({
          notes: [...state.notes, note],
        }))
      })
    }
  }, [notes, remove, showUndo])

  useEffect(() => {
    load()
  }, [load])

  const handleListKeyDown = (event: React.KeyboardEvent) => {
    if (notes.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setFocusIndex((previous) => {
        const next = Math.min(previous + 1, notes.length - 1)
        document.getElementById(`note-${notes[next].id}`)?.scrollIntoView({ block: 'nearest' })
        return next
      })
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusIndex((previous) => {
        const next = Math.max(previous - 1, 0)
        document.getElementById(`note-${notes[next].id}`)?.scrollIntoView({ block: 'nearest' })
        return next
      })
      return
    }

    if (event.key === 'Enter' && focusIndex >= 0 && focusIndex < notes.length) {
      event.preventDefault()
      select(notes[focusIndex].id)
      return
    }

    if (event.key === 'Delete' && focusIndex >= 0 && focusIndex < notes.length) {
      event.preventDefault()
      handleDelete(notes[focusIndex].id)
    }
  }

  const activeDescendant = focusIndex >= 0 && focusIndex < notes.length
    ? `note-${notes[focusIndex].id}`
    : undefined

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">
        <Loader2 size={20} className="mr-2 animate-spin" />
        <span className="text-[length:var(--text-md)]">{t('notes.loading')}</span>
      </div>
    )
  }

  return (
    <div
      className="grid h-full min-w-0 grid-cols-[320px_minmax(0,1fr)] overflow-hidden"
      data-view="notes-page"
    >
      <aside className="flex min-h-0 flex-col overflow-hidden px-6 py-5">
        <div className="pb-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-light)] px-3 py-1.5 text-[length:var(--text-xs)] font-semibold text-[var(--color-primary)]">
            <Sparkles size={14} />
            {t('notes.title')}
          </div>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[20px] font-semibold tracking-tight text-[var(--color-text)]">
                {t('notes.title')}
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                {t('notes.subtitle')}
              </p>
            </div>
            <IconButton
              icon={Plus}
              size="sm"
              variant="subtle"
              label={t('notes.newNote')}
              onClick={create}
            />
          </div>
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-2 focus:outline-none"
          {...(notes.length > 0
            ? {
                role: 'listbox' as const,
                'aria-label': t('notes.listLabel'),
                tabIndex: 0,
                onKeyDown: handleListKeyDown,
                'aria-activedescendant': activeDescendant,
              }
            : {})}
        >
          {notes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-5 py-12 text-[var(--color-text-muted)]">
              <FileText size={30} className="mb-3 opacity-25" />
              <p className="text-center text-[length:var(--text-sm)] font-medium">{t('notes.noNotes')}</p>
              <p className="mt-1 text-center text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                {t('notes.emptyHint')}
              </p>
              <Button size="sm" className="mt-4" onClick={create}>
                {t('notes.createFirst')}
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {notes.map((note, index) => {
                const isSelected = selectedId === note.id
                const isFocused = index === focusIndex
                return (
                  <div
                    key={note.id}
                    id={`note-${note.id}`}
                    role="option"
                    aria-selected={isSelected}
                    data-note-item={note.id}
                    className={`group rounded-[16px] px-4 py-3 transition-colors ${
                      isSelected
                        ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                        : isFocused
                          ? 'bg-[var(--color-surface-soft)]'
                          : 'hover:bg-[var(--color-surface-soft)]'
                    }`}
                    onClick={() => select(note.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 cursor-pointer">
                        <p
                          className={`truncate text-[14px] font-semibold tracking-tight ${
                            isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'
                          }`}
                        >
                          {note.title || t('notes.untitled')}
                        </p>
                        <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                          {formatDate(note.updatedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDelete(note.id)
                        }}
                        className="rounded-[10px] p-1.5 text-[var(--color-danger)] opacity-0 transition-all hover:bg-[var(--color-danger-bg)] group-hover:opacity-100"
                        title={t('notes.delete')}
                        aria-label={t('notes.delete')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-col overflow-hidden px-7 py-5">
        {selectedNote ? (
          <>
            <div className="max-w-3xl">
              <label
                htmlFor="note-title"
                className="mb-2 block text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
              >
                {t('notes.titleFieldLabel')}
              </label>
              <input
                id="note-title"
                type="text"
                value={selectedNote.title}
                onChange={(event) => updateTitle(selectedNote.id, event.target.value)}
                placeholder={t('notes.titlePlaceholder')}
                className="w-full border-none bg-transparent text-[24px] font-semibold tracking-tight text-[var(--color-text)] outline-none"
                style={{ minHeight: 'var(--min-target)' }}
              />
              <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
                {t('notes.lastModified')}: {formatDate(selectedNote.updatedAt)}
              </p>
            </div>

            <div className="flex-1 overflow-auto pt-4">
              <div className="max-w-3xl">
                <label
                  htmlFor="note-content"
                  className="mb-2 block text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
                >
                  {t('notes.contentFieldLabel')}
                </label>
                <textarea
                  id="note-content"
                  value={selectedNote.content}
                  onChange={(event) => updateContent(selectedNote.id, event.target.value)}
                  placeholder={t('notes.contentPlaceholder')}
                  className="h-full min-h-[420px] w-full resize-none border-none bg-transparent px-0 py-3 text-[15px] leading-7 text-[var(--color-text)] outline-none"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-[var(--color-text-muted)]">
            <FileText size={44} className="mb-3 opacity-20" />
            <p className="text-[length:var(--text-md)] font-medium">{t('notes.selectOrCreate')}</p>
            <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {t('notes.emptyHint')}
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
