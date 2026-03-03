import { useEffect, useCallback, useState } from 'react'
import { FileText, Plus, Trash2, Loader2 } from 'lucide-react'
import { useNotesStore } from '../stores/notes.store'
import { useUndoStore } from '../stores/undo.store'
import { t } from '../i18n'
import { IconButton, Button } from '../components/ui'

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

  const showUndo = useUndoStore((s) => s.show)
  const selectedNote = notes.find((n) => n.id === selectedId) ?? null
  const [focusIndex, setFocusIndex] = useState(-1)

  const handleDelete = useCallback((noteId: string) => {
    const note = notes.find((n) => n.id === noteId)
    remove(noteId)
    if (note) {
      showUndo(t('undo.noteDeleted'), () => {
        useNotesStore.setState((s) => ({
          notes: [...s.notes, note],
        }))
      })
    }
  }, [notes, remove, showUndo])

  useEffect(() => {
    load()
  }, [load])

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (notes.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIndex((prev) => {
        const next = Math.min(prev + 1, notes.length - 1)
        document.getElementById(`note-${notes[next].id}`)?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((prev) => {
        const next = Math.max(prev - 1, 0)
        document.getElementById(`note-${notes[next].id}`)?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'Enter' && focusIndex >= 0 && focusIndex < notes.length) {
      e.preventDefault()
      select(notes[focusIndex].id)
    } else if (e.key === 'Delete' && focusIndex >= 0 && focusIndex < notes.length) {
      e.preventDefault()
      handleDelete(notes[focusIndex].id)
    }
  }

  const activeDescendant = focusIndex >= 0 && focusIndex < notes.length
    ? `note-${notes[focusIndex].id}`
    : undefined

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        <Loader2 size={20} className="animate-spin mr-2" />
        <span className="text-[length:var(--text-md)]">{t('notes.loading')}</span>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left: note list */}
      <div className="w-56 shrink-0 border-r border-[var(--color-border)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
          <span className="text-[length:var(--text-md)] font-semibold text-[var(--color-text)]">
            {t('notes.title')}
          </span>
          <IconButton
            icon={Plus}
            size="sm"
            variant="subtle"
            label={t('notes.newNote')}
            onClick={create}
          />
        </div>

        {/* List */}
        <div
          className="flex-1 overflow-y-auto focus:outline-none"
          role="listbox"
          aria-label={t('notes.title')}
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          aria-activedescendant={activeDescendant}
        >
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-[var(--color-text-muted)]">
              <FileText size={28} className="mb-2 opacity-30" />
              <p className="text-[length:var(--text-sm)] text-center">
                {t('notes.noNotes')}
              </p>
              <Button size="sm" className="mt-3" onClick={create}>
                {t('notes.createFirst')}
              </Button>
            </div>
          ) : (
            notes.map((note, idx) => {
              const isSelected = selectedId === note.id
              const isFocused = idx === focusIndex
              return (
                <button
                  key={note.id}
                  id={`note-${note.id}`}
                  onClick={() => select(note.id)}
                  role="option"
                  aria-selected={isSelected}
                  title={note.title || t('notes.untitled')}
                  className={`w-full text-left px-3 py-2 transition-all group ${
                    isSelected
                      ? 'bg-[var(--color-primary-light)] border-l-2 border-l-[var(--color-primary)]'
                      : isFocused
                        ? 'bg-[var(--color-surface-soft)] border-l-2 border-l-[var(--color-text-muted)]'
                        : 'hover:bg-[var(--color-surface-soft)] border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[length:var(--text-md)] font-medium truncate ${isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}
                      >
                        {note.title || t('notes.untitled')}
                      </p>
                      <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)] mt-0.5">
                        {formatDate(note.updatedAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(note.id)
                      }}
                      className="p-1 rounded-[var(--radius-sm)] opacity-0 group-hover:opacity-100 hover:bg-[var(--color-danger-bg)] text-[var(--color-danger)] transition-all shrink-0"
                      title={t('notes.delete')}
                      aria-label={t('notes.delete')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right: editor */}
      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            {/* Title */}
            <div className="px-8 pt-8 pb-2">
              <input
                type="text"
                value={selectedNote.title}
                onChange={(e) => updateTitle(selectedNote.id, e.target.value)}
                placeholder={t('notes.titlePlaceholder')}
                className="w-full bg-transparent border-none outline-none font-semibold text-[length:var(--text-xl)] text-[var(--color-text)]"
                style={{ minHeight: 'var(--min-target)' }}
              />
              <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)] mt-1">
                {t('notes.lastModified')}: {formatDate(selectedNote.updatedAt)}
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 px-8 pb-8">
              <textarea
                value={selectedNote.content}
                onChange={(e) => updateContent(selectedNote.id, e.target.value)}
                placeholder={t('notes.contentPlaceholder')}
                className="w-full h-full resize-none bg-transparent border-none outline-none text-[length:var(--text-md)] text-[var(--color-text)]"
                style={{ lineHeight: 'var(--line-height-base)' }}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
            <FileText size={40} className="mb-3 opacity-20" />
            <p className="text-[length:var(--text-md)]">
              {t('notes.selectOrCreate')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
