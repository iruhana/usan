export function getAttachmentTextPreview(textContent?: string, maxChars = 140): string | null {
  const normalized = textContent?.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return null
  }

  if (normalized.length <= maxChars) {
    return normalized
  }

  return `${normalized.slice(0, maxChars).trimEnd()}…`
}
