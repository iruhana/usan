export function SkeletonLoader() {
  return (
    <div className="flex gap-3 px-4 py-3 max-w-2xl">
      <div className="w-8 h-8 rounded-full skeleton shrink-0" />
      <div className="flex-1 space-y-3">
        <div className="h-4 skeleton w-3/4" />
        <div className="h-4 skeleton w-full" />
        <div className="h-4 skeleton w-1/2" />
      </div>
    </div>
  )
}
