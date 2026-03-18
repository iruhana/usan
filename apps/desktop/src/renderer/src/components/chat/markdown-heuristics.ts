const MARKDOWN_PATTERNS = [
  /```/,
  /(^|\n)\s{0,3}#{1,6}\s+\S/,
  /(^|\n)\s*[-*+]\s+\S/,
  /(^|\n)\s*\d+\.\s+\S/,
  /(^|\n)>\s+\S/,
  /\[[^\]]+\]\([^)]+\)/,
  /(^|\n)\|.+\|/,
  /(^|\n)\s*(?:---|\*\*\*|___)\s*($|\n)/,
  /`[^`\n]+`/,
  /\*\*[^*\n]+\*\*/,
  /__[^_\n]+__/,
]

export function shouldRenderMarkdown(content: string): boolean {
  const normalized = content.trim()
  if (!normalized) {
    return false
  }

  return MARKDOWN_PATTERNS.some((pattern) => pattern.test(normalized))
}
