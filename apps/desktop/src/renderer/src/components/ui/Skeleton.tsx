/**
 * Skeleton loading component using Notion-style ultra-subtle shimmer.
 * Uses the usan-shimmer animation from animations.css (0.03 alpha gradient).
 */

interface SkeletonProps {
  /** Width — CSS value or Tailwind class */
  width?: string
  /** Height — CSS value or Tailwind class */
  height?: string
  /** Border radius — defaults to 'md' (8px) */
  radius?: 'sm' | 'md' | 'lg' | 'pill'
  /** Additional CSS classes */
  className?: string
}

const radiusMap = {
  sm: 'rounded-[var(--usan-radius-sm)]',
  md: 'rounded-[var(--usan-radius-md)]',
  lg: 'rounded-[var(--usan-radius-lg)]',
  pill: 'rounded-full',
}

export default function Skeleton({
  width,
  height = '1rem',
  radius = 'md',
  className = '',
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`usan-shimmer bg-[var(--usan-color-bg-surface)] ${radiusMap[radius]} ${className}`}
      style={{ width, height }}
    />
  )
}

/** Skeleton for a full text line */
export function SkeletonLine({ width = '100%' }: { width?: string }) {
  return <Skeleton width={width} height="0.875rem" radius="sm" className="my-1" />
}

/** Skeleton for a circular avatar */
export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return <Skeleton width={`${size}px`} height={`${size}px`} radius="pill" />
}

/** Skeleton placeholder for Timeline steps */
export function SkeletonTimeline() {
  return (
    <div className="flex flex-col gap-4 p-4" aria-busy="true" aria-label="Loading timeline">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton width="32px" height="32px" radius="pill" />
          <div className="flex-1">
            <SkeletonLine width="60%" />
            <SkeletonLine width="40%" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Skeleton placeholder for TasksPage list */
export function SkeletonTaskList() {
  return (
    <div className="flex flex-col gap-2 p-4" aria-busy="true" aria-label="Loading tasks">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-[var(--usan-radius-md)] bg-[var(--usan-color-bg-panel)] p-3">
          <Skeleton width="8px" height="8px" radius="pill" />
          <SkeletonLine width="45%" />
          <div className="ml-auto">
            <Skeleton width="60px" height="20px" radius="pill" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Skeleton placeholder for FilesPage list */
export function SkeletonFileList() {
  return (
    <div className="flex flex-col gap-1 p-4" aria-busy="true" aria-label="Loading files">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton width="20px" height="20px" radius="sm" />
          <SkeletonLine width="35%" />
          <div className="ml-auto flex gap-4">
            <Skeleton width="40px" height="14px" radius="sm" />
            <Skeleton width="60px" height="14px" radius="sm" />
          </div>
        </div>
      ))}
    </div>
  )
}
