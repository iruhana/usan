import { useEffect, useMemo, useRef, useState } from 'react'
import type { UiElement } from '@shared/types/infrastructure'

interface ScreenAnnotationProps {
  screenshot: string
  annotations: UiElement[]
  focusLabel?: string
}

function toImageSrc(raw: string): string {
  if (!raw) return ''
  return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`
}

function typeClass(type: UiElement['type']): string {
  if (type === 'button') return 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
  if (type === 'input') return 'border-[var(--color-success)] bg-[var(--color-success)]/10'
  if (type === 'link') return 'border-[var(--color-warning)] bg-[var(--color-warning)]/10'
  if (type === 'image') return 'border-[var(--color-text-muted)] bg-[var(--color-text-muted)]/10'
  return 'border-[var(--color-border)] bg-transparent'
}

export default function ScreenAnnotation({ screenshot, annotations, focusLabel }: ScreenAnnotationProps) {
  const src = toImageSrc(screenshot)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [natural, setNatural] = useState({ width: 1, height: 1 })
  const [rendered, setRendered] = useState({ width: 1, height: 1 })

  useEffect(() => {
    const image = imageRef.current
    if (!image) return

    const updateSize = () => {
      setRendered({ width: Math.max(1, image.clientWidth), height: Math.max(1, image.clientHeight) })
    }

    updateSize()

    const observer = new ResizeObserver(() => updateSize())
    observer.observe(image)

    return () => observer.disconnect()
  }, [src])

  const scale = useMemo(() => ({
    x: rendered.width / Math.max(1, natural.width),
    y: rendered.height / Math.max(1, natural.height),
  }), [natural, rendered])

  if (!src) return null

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)]">
      <img
        ref={imageRef}
        src={src}
        alt="Screen analysis"
        className="h-auto w-full object-contain"
        onLoad={(event) => {
          const image = event.currentTarget
          setNatural({ width: Math.max(1, image.naturalWidth), height: Math.max(1, image.naturalHeight) })
          setRendered({ width: Math.max(1, image.clientWidth), height: Math.max(1, image.clientHeight) })
        }}
      />
      <div className="pointer-events-none absolute inset-0">
        {annotations.map((item, index) => {
          const isFocused = focusLabel && item.label.toLowerCase() === focusLabel.toLowerCase()
          return (
            <div
              key={`${item.label}-${index}`}
              className={`absolute overflow-hidden rounded-[var(--radius-sm)] border ${typeClass(item.type)} ${isFocused ? 'ring-2 ring-[var(--color-warning)]' : ''}`}
              style={{
                left: `${Math.max(0, item.bounds.x * scale.x)}px`,
                top: `${Math.max(0, item.bounds.y * scale.y)}px`,
                width: `${Math.max(1, item.bounds.width * scale.x)}px`,
                height: `${Math.max(1, item.bounds.height * scale.y)}px`,
              }}
            >
              <span className="inline-flex max-w-full truncate bg-[var(--color-bg-card)]/90 px-1 py-0.5 text-[10px] text-[var(--color-text)]">
                {item.label || item.type}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
