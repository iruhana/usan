import { Badge, InlineNotice } from '../ui'
import { t } from '../../i18n'
import type { ArtifactItem } from './types'

interface ArtifactShelfProps {
  artifacts: ArtifactItem[]
  selectedArtifactId: string | null
  onSelectArtifact: (artifactId: string) => void
  className?: string
}

function previewValue(artifact: ArtifactItem): string {
  if (artifact.kind === 'image') {
    return t('artifact.preview.image')
  }

  const base = artifact.content?.replace(/\s+/g, ' ').trim() || ''
  if (!base) return t('artifact.preview.empty')
  if (base.length <= 72) return base
  return `${base.slice(0, 72).trimEnd()}...`
}

export default function ArtifactShelf({
  artifacts,
  selectedArtifactId,
  onSelectArtifact,
  className = '',
}: ArtifactShelfProps) {
  if (artifacts.length === 0) {
    return (
      <InlineNotice
        tone="info"
        title={t('artifact.emptyTitle')}
        className={className}
      >
        {t('artifact.emptyBody')}
      </InlineNotice>
    )
  }

  return (
    <section
      className={className}
      aria-label={t('artifact.shelfTitle')}
      data-testid="artifact-shelf"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-[16px] font-semibold text-[var(--color-text)]">{t('artifact.shelfTitle')}</h3>
        <Badge variant="default">{artifacts.length}</Badge>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {artifacts.map((artifact) => {
          const isSelected = artifact.id === selectedArtifactId

          return (
            <button
              key={artifact.id}
              type="button"
              onClick={() => onSelectArtifact(artifact.id)}
              aria-pressed={isSelected}
              className={[
                'min-w-[220px] max-w-[260px] shrink-0 rounded-[20px] px-4 py-3 text-left transition-all',
                isSelected
                  ? 'bg-[var(--color-primary-light)] shadow-[var(--shadow-xs)] ring-1 ring-[rgba(49,130,246,0.16)]'
                  : 'bg-[var(--color-panel-muted)] hover:bg-[var(--color-surface-soft)]',
              ].join(' ')}
              data-testid={`artifact-shelf-item-${artifact.id}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={artifact.source === 'tool' ? 'warning' : artifact.source === 'draft' ? 'info' : 'success'}>
                  {artifact.sourceLabel || t(`artifact.source.${artifact.source}`)}
                </Badge>
                <Badge variant="default">{t(`artifact.kind.${artifact.kind}`)}</Badge>
              </div>
              <p className="mt-3 truncate text-[14px] font-semibold text-[var(--color-text)]">
                {artifact.title}
              </p>
              <p className="mt-2 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                {previewValue(artifact)}
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
