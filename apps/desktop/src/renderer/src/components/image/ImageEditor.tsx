import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { Button, Card, InlineNotice, Input, SectionHeader } from '../ui'
import ImagePreview from './ImagePreview'
import { t } from '../../i18n'
import { toImageErrorMessage } from '../../lib/user-facing-errors'

type ImageFormat = 'png' | 'jpeg' | 'webp'

interface EditorImageInfo {
  width?: number
  height?: number
  format?: string
  size?: number
}

export default function ImageEditor() {
  const [prompt, setPrompt] = useState('')
  const [path, setPath] = useState('')
  const [width, setWidth] = useState(1024)
  const [height, setHeight] = useState(1024)
  const [quality, setQuality] = useState(80)
  const [format, setFormat] = useState<ImageFormat>('png')
  const [preview, setPreview] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [previewInfo, setPreviewInfo] = useState<EditorImageInfo | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const runWithLoading = async (action: string, runner: () => Promise<void>) => {
    setLoadingAction(action)
    setError(null)
    try {
      await runner()
    } catch (err) {
      setError(toImageErrorMessage(err))
    } finally {
      setLoadingAction(null)
    }
  }

  const loadInfo = async (targetPath: string) => {
    if (!targetPath) return
    const info = await window.usan?.image.info(targetPath)
    setPreview(targetPath)
    setOutputPath(targetPath)
    setPreviewInfo({
      width: Number(info?.width) || undefined,
      height: Number(info?.height) || undefined,
      format: String(info?.format ?? ''),
      size: Number(info?.size) || undefined,
    })
  }

  const currentPath = path.trim()

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader title={t('image.title')} icon={Wand2} indicator="var(--color-primary)" />

      {error ? (
        <InlineNotice tone="error" title={t('image.helpTitle')}>
          {error}
        </InlineNotice>
      ) : null}

      <Input
        label={t('image.prompt')}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={t('image.promptPlaceholder')}
      />

      <div className="flex gap-2">
        <Button
          size="sm"
          loading={loadingAction === 'generate'}
          disabled={prompt.trim().length === 0}
          onClick={() => runWithLoading('generate', async () => {
            const result = await window.usan?.image.generate(prompt.trim())
            const base64 = result?.base64 ?? ''
            setPreview(base64)
            setOutputPath(result?.outputPath ?? '')
            setPreviewInfo(undefined)
          })}
        >
          {t('image.generate')}
        </Button>
      </div>

      <Input
        label={t('image.filePath')}
        value={path}
        onChange={(event) => setPath(event.target.value)}
        placeholder={t('image.filePathPlaceholder')}
      />

      <div className="grid gap-2 md:grid-cols-2">
        <Input
          label={t('image.width')}
          type="number"
          min={16}
          value={width}
          onChange={(event) => setWidth(Math.max(16, Number(event.target.value) || 16))}
        />
        <Input
          label={t('image.height')}
          type="number"
          min={16}
          value={height}
          onChange={(event) => setHeight(Math.max(16, Number(event.target.value) || 16))}
        />
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          {t('image.format')}
          <select
            className="mt-1 h-9 w-full rounded-[var(--radius-md)] ring-1 ring-transparent bg-[var(--color-surface-soft)] px-2 text-[length:var(--text-sm)] outline-none transition-all focus:ring-[var(--color-primary)] focus:shadow-[var(--shadow-primary)] focus:bg-[var(--color-bg-card)]"
            value={format}
            onChange={(event) => setFormat(event.target.value as ImageFormat)}
          >
            <option value="png">png</option>
            <option value="jpeg">jpeg</option>
            <option value="webp">webp</option>
          </select>
        </label>
        <Input
          label={t('image.quality')}
          type="number"
          min={1}
          max={100}
          value={quality}
          onChange={(event) => setQuality(Math.max(1, Math.min(100, Number(event.target.value) || 80)))}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={loadingAction === 'resize'}
          disabled={!currentPath}
          onClick={() => runWithLoading('resize', async () => {
            const result = await window.usan?.image.resize(currentPath, width, height)
            if (result?.outputPath) {
              setPath(result.outputPath)
              await loadInfo(result.outputPath)
            }
          })}
        >
          {t('image.resize')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={loadingAction === 'convert'}
          disabled={!currentPath}
          onClick={() => runWithLoading('convert', async () => {
            const result = await window.usan?.image.convert(currentPath, format, quality)
            if (result?.outputPath) {
              setPath(result.outputPath)
              await loadInfo(result.outputPath)
            }
          })}
        >
          {t('image.convert')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={loadingAction === 'compress'}
          disabled={!currentPath}
          onClick={() => runWithLoading('compress', async () => {
            const result = await window.usan?.image.compress(currentPath, quality)
            if (result?.outputPath) {
              setPath(result.outputPath)
              await loadInfo(result.outputPath)
            }
          })}
        >
          {t('image.compress')}
        </Button>
      </div>

      <ImagePreview src={preview} outputPath={outputPath} info={previewInfo} />
    </Card>
  )
}
