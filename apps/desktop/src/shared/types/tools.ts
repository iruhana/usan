/**
 * Tool types for the agent loop
 */

export interface ToolResult {
  id: string
  name: string
  result: unknown
  error?: string
  /** Duration in ms */
  duration: number
}
