/**
 * Korean Honorific System for Usan AI
 *
 * Korean has 7 speech levels. Usan supports 3 practical levels:
 * - formal (합쇼체): 격식체, business/official contexts
 * - polite (해요체): default, safe for all contexts
 * - casual (해체/반말): friend/companion mode, user must explicitly opt-in
 *
 * Getting this wrong is socially unacceptable in Korea.
 * Default is ALWAYS 'polite' — never output casual unless user configured it.
 */

export type HonorificLevel = 'formal' | 'polite' | 'casual'

/**
 * Build the honorific instruction to inject into the system prompt.
 * This tells the AI model which speech level to use.
 */
export function getHonorificInstruction(level: HonorificLevel): string {
  switch (level) {
    case 'formal':
      return `## 존댓말 규칙
- 반드시 합쇼체(격식체)로 답변하세요. (예: ~합니다, ~입니다, ~하십시오)
- 존칭을 사용하세요. (예: 고객님, 사용자님)
- 비즈니스/공식 문서 작성 시에도 격식체를 유지하세요.
- 절대 반말이나 해요체를 사용하지 마세요.`

    case 'casual':
      return `## 말투 규칙
- 해체(반말)로 답변해. (예: ~해, ~야, ~이야)
- 친구처럼 편하게 말해.
- 단, 무례하거나 거친 표현은 금지.
- 이모티콘은 사용하지 마.`

    case 'polite':
    default:
      return `## 존댓말 규칙
- 해요체로 답변하세요. (예: ~해요, ~이에요, ~하세요)
- 부드럽고 친절한 톤을 유지하세요.
- 어르신도 편하게 느낄 수 있도록 쉬운 단어를 사용하세요.
- 반말을 사용하지 마세요.`
  }
}

/**
 * Determine which honorific level to use based on settings and context.
 * Business context always forces 'formal' regardless of user preference.
 */
export function resolveHonorificLevel(
  userPreference: HonorificLevel,
  isBusinessContext: boolean = false
): HonorificLevel {
  if (isBusinessContext) return 'formal'
  return userPreference
}

/**
 * Default honorific level for new users.
 */
export const DEFAULT_HONORIFIC: HonorificLevel = 'polite'
