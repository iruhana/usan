import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, FilePlus2, Search, Loader2 } from 'lucide-react'
import { Button, Card, InlineNotice, Input, SectionHeader } from '../components/ui'
import { useKnowledgeStore } from '../stores/knowledge.store'
import { useSettingsStore } from '../stores/settings.store'
import DocumentList from '../components/knowledge/DocumentList'
import SearchResults from '../components/knowledge/SearchResults'
import { t } from '../i18n'

export default function KnowledgePage() {
  const beginnerMode = useSettingsStore((s) => s.settings.beginnerMode)
  const {
    documents,
    searchResults,
    indexingProgress,
    indexSummary,
    loading,
    error,
    initialize,
    load,
    indexFile,
    indexFolder,
    removeDocument,
    search,
    clearSearch,
    clearIndexSummary,
  } = useKnowledgeStore()

  const [query, setQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const queryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    initialize()
    load().catch(() => {})
  }, [initialize, load])

  const hasSearch = query.trim().length > 0
  const totalChunks = useMemo(() => documents.reduce((sum, item) => sum + item.chunks, 0), [documents])
  const hasDocuments = documents.length > 0

  const clearQuery = useCallback(() => {
    setQuery('')
    clearSearch()
  }, [clearSearch])

  const runSearch = useCallback(() => {
    const normalized = query.trim()
    if (!normalized) {
      clearSearch()
      return
    }
    search(normalized)
  }, [clearSearch, query, search])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        queryInputRef.current?.focus()
        queryInputRef.current?.select()
        return
      }

      if (event.key === 'Escape' && (query.trim().length > 0 || searchResults.length > 0)) {
        event.preventDefault()
        clearQuery()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearQuery, query, searchResults.length])

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-[length:var(--text-xl)] font-semibold text-[var(--color-text)]">{t('knowledge.title')}</h1>
          <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            {t(beginnerMode ? 'knowledge.subtitleSimple' : 'knowledge.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" leftIcon={<FilePlus2 size={14} />} onClick={() => fileInputRef.current?.click()}>
            {t('knowledge.addFile')}
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<FolderOpen size={14} />} onClick={() => folderInputRef.current?.click()}>
            {t('knowledge.addFolder')}
          </Button>
        </div>
      </div>

      {!beginnerMode && (
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Card variant="outline" className="py-3">
            <p className="text-[length:var(--text-xs)] uppercase tracking-wide text-[var(--color-text-muted)]">{t('knowledge.totalDocuments')}</p>
            <p className="mt-1 text-[length:var(--text-lg)] font-semibold text-[var(--color-text)]">{documents.length}</p>
          </Card>
          <Card variant="outline" className="py-3">
            <p className="text-[length:var(--text-xs)] uppercase tracking-wide text-[var(--color-text-muted)]">{t('knowledge.totalChunks')}</p>
            <p className="mt-1 text-[length:var(--text-lg)] font-semibold text-[var(--color-text)]">{totalChunks}</p>
          </Card>
          <Card variant="outline" className="py-3">
            <p className="text-[length:var(--text-xs)] uppercase tracking-wide text-[var(--color-text-muted)]">{t('knowledge.searchResults')}</p>
            <p className="mt-1 text-[length:var(--text-lg)] font-semibold text-[var(--color-text)]">{searchResults.length}</p>
          </Card>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0] as (File & { path?: string }) | undefined
          if (file?.path) {
            await indexFile(file.path)
          }
          event.currentTarget.value = ''
        }}
      />

      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        // @ts-expect-error webkitdirectory is supported in Chromium/Electron
        webkitdirectory="true"
        directory="true"
        onChange={async (event) => {
          const file = event.target.files?.[0] as (File & { path?: string }) | undefined
          if (file?.path) {
            const normalized = file.path.replace(/\\[^\\]+$/, '')
            await indexFolder(normalized)
          }
          event.currentTarget.value = ''
        }}
      />

      {error ? (
        <InlineNotice tone="error" title={t('knowledge.helpTitle')} className="mb-3">
          {error}
        </InlineNotice>
      ) : null}

      {beginnerMode && !error ? (
        <InlineNotice tone="info" title={t('knowledge.quickHelpTitle')} className="mb-3">
          <p>{t('knowledge.quickHelpBody')}</p>
        </InlineNotice>
      ) : null}

      {indexSummary && (
        <Card variant="outline" className="mb-3">
          <div className="flex flex-wrap items-center gap-2 text-[length:var(--text-sm)]">
            <span className="font-medium text-[var(--color-text)]">
              {indexSummary.scope === 'file'
                ? indexSummary.skippedCount > 0
                  ? t('knowledge.indexSummary.fileSkipped')
                  : t('knowledge.indexSummary.fileIndexed')
                : t('knowledge.indexSummary.folder')}
            </span>
            <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[length:var(--text-xs)] text-[var(--color-primary)]">
              {t('knowledge.indexSummary.indexed')}: {indexSummary.indexedCount}
            </span>
            <span className="rounded-full bg-[var(--color-warning)]/10 px-2 py-0.5 text-[length:var(--text-xs)] text-[var(--color-warning)]">
              {t('knowledge.indexSummary.skipped')}: {indexSummary.skippedCount}
            </span>
            <span className="rounded-full bg-[var(--color-danger)]/10 px-2 py-0.5 text-[length:var(--text-xs)] text-[var(--color-danger)]">
              {t('knowledge.indexSummary.failed')}: {indexSummary.failedCount}
            </span>
            {!beginnerMode && (
              <span className="rounded-full bg-[var(--color-surface-soft)] px-2 py-0.5 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                {t('knowledge.totalChunks')}: {indexSummary.totalChunks}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={clearIndexSummary} className="ml-auto">
              {t('chat.cancel')}
            </Button>
          </div>
        </Card>
      )}

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Input
            ref={queryInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                runSearch()
              }

              if (event.key === 'Escape') {
                event.preventDefault()
                clearQuery()
              }
            }}
            placeholder={t('knowledge.searchPlaceholder')}
            leftIcon={<Search size={16} />}
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="md"
            onClick={runSearch}
            disabled={!query.trim()}
          >
            {t('knowledge.search')}
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={clearQuery}
          >
            {t('chat.cancel')}
          </Button>
        </div>
      </div>
      <p className="mb-3 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
        {t(beginnerMode ? 'knowledge.shortcutsHintSimple' : 'knowledge.shortcutsHint')}
      </p>

      {indexingProgress && (
        <Card variant="outline" className="mb-4">
          <div className="flex items-center gap-2 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            <Loader2 size={14} className="animate-spin" />
            <span>
              {t('knowledge.indexingProgress')}: {indexingProgress.current}/{indexingProgress.total} - {indexingProgress.fileName}
            </span>
          </div>
        </Card>
      )}

      {!hasSearch && !hasDocuments && !loading && !indexingProgress && (
        <Card variant="outline" className="mb-4 !ring-0 border-2 border-dashed border-[var(--color-border)]">
          <div className="text-center py-6">
            <h3 className="text-[length:var(--text-md)] font-semibold text-[var(--color-text)]">{t('knowledge.emptyTitle')}</h3>
            <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {t(beginnerMode ? 'knowledge.emptyHintSimple' : 'knowledge.emptyHint')}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" leftIcon={<FilePlus2 size={14} />} onClick={() => fileInputRef.current?.click()}>
                {t('knowledge.addFile')}
              </Button>
              <Button size="sm" variant="secondary" leftIcon={<FolderOpen size={14} />} onClick={() => folderInputRef.current?.click()}>
                {t('knowledge.addFolder')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className={`grid min-h-0 flex-1 gap-4 ${beginnerMode ? '' : 'lg:grid-cols-[1.2fr_1fr]'}`}>
        <div className="min-h-0 overflow-auto">
          <SectionHeader title={hasSearch ? t('knowledge.searchResults') : t('knowledge.documents')} indicator="var(--color-primary)" className="mb-3" />
          {hasSearch ? (
            <SearchResults results={searchResults} simpleMode={beginnerMode} />
          ) : (
            <DocumentList documents={documents} onRemove={removeDocument} simpleMode={beginnerMode} />
          )}
        </div>

        {!beginnerMode && (
          <div className="min-h-0 overflow-auto">
            <Card variant="elevated" className="space-y-2">
              <h3 className="text-[length:var(--text-md)] font-semibold text-[var(--color-text)]">{t('knowledge.stats')}</h3>
              <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('knowledge.totalDocuments')}: {documents.length}</p>
              <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('knowledge.totalChunks')}: {totalChunks}</p>
              <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{loading ? t('files.loading') : t('skill.done')}</p>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
