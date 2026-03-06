import { useState } from 'react'
import type { OcrResult, UiElement } from '@shared/types/infrastructure'
import { ScanEye, Search } from 'lucide-react'
import { Button, Card, InlineNotice, Input, SectionHeader } from '../ui'
import { t } from '../../i18n'
import { toVisionErrorMessage } from '../../lib/user-facing-errors'
import ScreenAnnotation from './ScreenAnnotation'
import OCRResult from './OCRResult'

interface VisionAnalysisState {
  screenshot: string
  elements: UiElement[]
}

export default function VisionPanel() {
  const [analysis, setAnalysis] = useState<VisionAnalysisState | null>(null)
  const [ocr, setOcr] = useState<OcrResult | null>(null)
  const [query, setQuery] = useState('')
  const [foundElement, setFoundElement] = useState<UiElement | null>(null)
  const [loadingAnalyze, setLoadingAnalyze] = useState(false)
  const [loadingFind, setLoadingFind] = useState(false)
  const [loadingOcr, setLoadingOcr] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runAnalyze = async () => {
    setLoadingAnalyze(true)
    setError(null)
    try {
      const [ui, nextOcr] = await Promise.all([
        window.usan?.vision.analyzeUI(),
        window.usan?.vision.ocr(),
      ])
      setAnalysis({
        screenshot: ui?.screenshot ?? '',
        elements: ui?.elements ?? [],
      })
      setOcr(nextOcr ?? null)
      setFoundElement(null)
    } catch (err) {
      setError(toVisionErrorMessage(err, 'analyze'))
    } finally {
      setLoadingAnalyze(false)
    }
  }

  const runOcrOnly = async () => {
    setLoadingOcr(true)
    setError(null)
    try {
      const result = await window.usan?.vision.ocr()
      setOcr(result ?? null)
    } catch (err) {
      setError(toVisionErrorMessage(err, 'ocr'))
    } finally {
      setLoadingOcr(false)
    }
  }

  const runFind = async () => {
    const normalized = query.trim()
    if (!normalized) return

    setLoadingFind(true)
    setError(null)
    try {
      const result = await window.usan?.vision.findElement(normalized)
      setFoundElement(result ?? null)
      if (!analysis?.screenshot) {
        const ui = await window.usan?.vision.analyzeUI()
        setAnalysis({
          screenshot: ui?.screenshot ?? '',
          elements: ui?.elements ?? [],
        })
      }
    } catch (err) {
      setError(toVisionErrorMessage(err, 'find'))
    } finally {
      setLoadingFind(false)
    }
  }

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader title={t('vision.title')} icon={ScanEye} indicator="var(--color-primary)" />

      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={loadingAnalyze} onClick={() => runAnalyze().catch(() => {})}>
          {loadingAnalyze ? t('vision.analyzing') : t('vision.analyzeUI')}
        </Button>
        <Button size="sm" variant="secondary" loading={loadingOcr} onClick={() => runOcrOnly().catch(() => {})}>
          {t('vision.ocr')}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('vision.findElement')}
            leftIcon={<Search size={14} />}
          />
        </div>
        <Button size="sm" loading={loadingFind} disabled={!query.trim()} onClick={() => runFind().catch(() => {})}>
          {t('vision.findElement')}
        </Button>
      </div>

      {error ? (
        <InlineNotice tone="error" title={t('vision.helpTitle')}>
          {error}
        </InlineNotice>
      ) : null}

      {foundElement && (
        <div className="rounded-[var(--radius-md)] ring-1 ring-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-text)]">
          <strong>{t('vision.findElement')}:</strong> {foundElement.label}
        </div>
      )}

      {analysis?.screenshot && (
        <ScreenAnnotation
          screenshot={analysis.screenshot}
          annotations={analysis.elements}
          focusLabel={foundElement?.label}
        />
      )}

      <OCRResult result={ocr} />
    </Card>
  )
}
