export function hasE2EQueryFlag(flag: string): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get(flag) === '1'
}
