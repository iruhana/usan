import { useState } from 'react'
import type { OcrResult } from '@shared/types/infrastructure'
import { Copy, ScanText } from 'lucide-react'
import { Button, Card, SectionHeader } from '../ui'
import { t } from '../../i18n'

interface OCRResultProps {
  result: OcrResult | null
}

export default function OCRResult({ result }: OCRResultProps) {
  const text = result?.text?.trim() ?? ''
  const confidence = Math.max(0, Math.min(result?.confidence ?? 0, 1))
  const [copied, setCopied] = useState(false)

  const copyText = async (value: string) => {
    if (!value.trim()) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader title={t('vision.ocr')} icon={ScanText} indicator="var(--color-primary)" />

      <div className="flex items-center justify-between gap-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
        <span>{t('vision.confidence')}: {(confidence * 100).toFixed(1)}%</span>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Copy size={13} />}
          disabled={text.length === 0}
          onClick={() => copyText(text).catch(() => {})}
        >
          {copied ? t('vision.copied') : t('vision.copyText')}
        </Button>
      </div>

      {text ? (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] p-3 text-[length:var(--text-sm)] text-[var(--color-text)]">
          {text}
        </pre>
      ) : (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('vision.noText')}</p>
      )}

      {(result?.regions?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <p className="text-[length:var(--text-xs)] uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('vision.regionSelect')}
          </p>
          <div className="grid max-h-28 gap-1 overflow-auto">
            {result?.regions.slice(0, 12).map((region, index) => (
              <button
                key={`${region.text}-${index}`}
                type="button"
                className="rounded-[var(--radius-sm)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-surface-soft)] px-2 py-1 text-left text-[length:var(--text-xs)] text-[var(--color-text)] transition-all hover:ring-[var(--color-primary)]"
                onClick={() => copyText(region.text).catch(() => {})}
              >
                {region.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
