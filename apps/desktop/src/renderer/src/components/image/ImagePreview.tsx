import { Copy, Download } from 'lucide-react'
import { Button, Card } from '../ui'
import { t } from '../../i18n'

interface ImagePreviewProps {
  src: string
  alt?: string
  outputPath?: string
  info?: {
    width?: number
    height?: number
    format?: string
    size?: number
  }
}

function toImageSrc(raw: string): string {
  if (!raw) return ''
  if (raw.startsWith('data:')) return raw
  if (/^https?:\/\//i.test(raw) || /^file:\/\//i.test(raw)) return raw
  if (/^[a-zA-Z]:\\/.test(raw)) return `file:///${raw.replace(/\\/g, '/')}`
  if (raw.startsWith('/')) return `file://${raw}`
  return `data:image/png;base64,${raw}`
}

function formatBytes(size: number | undefined): string {
  if (!size || size <= 0) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

export default function ImagePreview({ src, alt = 'Generated image', outputPath, info }: ImagePreviewProps) {
  const imageSrc = toImageSrc(src)
  if (!imageSrc) return null

  return (
    <Card variant="outline" className="space-y-3">
      <img src={imageSrc} alt={alt} className="max-h-80 w-full rounded-[var(--radius-md)] object-contain" />

      {(info || outputPath) && (
        <div className="grid gap-1 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
          {outputPath && <p>{t('image.outputPath')}: {outputPath}</p>}
          {info?.width && info?.height && <p>{t('image.dimensions')}: {info.width} x {info.height}</p>}
          {info?.format && <p>{t('image.format')}: {info.format}</p>}
          <p>{t('image.size')}: {formatBytes(info?.size)}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Copy size={14} />}
          onClick={async () => {
            try {
              const response = await fetch(imageSrc)
              const blob = await response.blob()
              if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
              } else {
                await navigator.clipboard.writeText(imageSrc)
              }
            } catch {
              await navigator.clipboard.writeText(imageSrc).catch(() => {})
            }
          }}
        >
          {t('image.copy')}
        </Button>
        <a href={imageSrc} download="usan-image.png">
          <Button size="sm" variant="secondary" leftIcon={<Download size={14} />}>
            {t('image.download')}
          </Button>
        </a>
      </div>
    </Card>
  )
}
