import { useEffect } from 'react'
import type { FileEntry } from '@shared/types/ipc'
import { FileExplorer } from '../components/files'
import { PageIntro, ProgressSummary } from '../components/ui'
import { t } from '../i18n'
import { dispatchNavigate } from '../lib/navigation-events'
import { useChatStore } from '../stores/chat.store'
import { useFilesStore } from '../stores/files.store'

function buildAskPrompt(entry: FileEntry): string {
  const prompt = entry.isDirectory ? t('files.askPromptFolder') : t('files.askPromptFile')
  return `${prompt}\n${entry.path}`
}

export default function FilesPage() {
  const currentPath = useFilesStore((state) => state.currentPath)
  const entries = useFilesStore((state) => state.entries)
  const loading = useFilesStore((state) => state.loading)
  const error = useFilesStore((state) => state.error)
  const loadDirectory = useFilesStore((state) => state.loadDirectory)
  const init = useFilesStore((state) => state.init)

  const newConversation = useChatStore((state) => state.newConversation)
  const sendMessage = useChatStore((state) => state.sendMessage)

  useEffect(() => {
    void init()
  }, [init])

  const directoryCount = entries.filter((entry) => entry.isDirectory).length
  const fileCount = entries.length - directoryCount

  async function handlePickDirectory(): Promise<void> {
    const result = await window.usan?.fs.pick({
      mode: 'directory',
      title: t('files.pickFolderTitle'),
    })
    const nextPath = result?.paths[0]
    if (!result?.canceled && nextPath) {
      await loadDirectory(nextPath)
    }
  }

  async function handleOpenEntry(entry: FileEntry): Promise<void> {
    if (entry.isDirectory) {
      await loadDirectory(entry.path)
      return
    }

    if (!window.usan?.fsExtras.openPath) {
      throw new Error(t('files.actionErrorGeneric'))
    }

    await window.usan.fsExtras.openPath(entry.path)
  }

  async function handleAskEntry(entry: FileEntry): Promise<void> {
    dispatchNavigate({ page: 'home' })
    newConversation()
    await sendMessage(buildAskPrompt(entry))
  }

  async function handleDeleteEntry(entry: FileEntry): Promise<void> {
    await window.usan?.fs.delete(entry.path)
    await loadDirectory(currentPath)
  }

  async function handleSecureDeleteEntry(entry: FileEntry): Promise<void> {
    await window.usan?.fs.secureDelete(entry.path)
    await loadDirectory(currentPath)
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-[var(--color-bg)]" data-testid="files-page">
      <div className="flex-1 overflow-hidden px-4 pb-4 pt-5 md:px-5 md:pb-5">
        <div className="mx-auto flex h-full w-full max-w-[1480px] flex-col gap-4">
          <PageIntro
            title={t('files.title')}
            description={t('files.subtitle')}
          />

          <ProgressSummary
            title={t('files.title')}
            footer={currentPath}
            progressPercent={entries.length > 0 ? Math.min(100, Math.round((directoryCount / entries.length) * 100)) : 0}
            progressLabel={t('files.title')}
            metrics={[
              { label: t('files.itemsCount'), value: String(entries.length) },
              { label: t('files.kind.file'), value: String(fileCount) },
              { label: t('files.kind.folder'), value: String(directoryCount) },
            ]}
          />

          <FileExplorer
            currentPath={currentPath}
            entries={entries}
            loading={loading}
            error={error}
            onLoadDirectory={loadDirectory}
            onPickDirectory={handlePickDirectory}
            onOpenEntry={handleOpenEntry}
            onAskEntry={handleAskEntry}
            onDeleteEntry={handleDeleteEntry}
            onSecureDeleteEntry={handleSecureDeleteEntry}
          />
        </div>
      </div>
    </div>
  )
}
