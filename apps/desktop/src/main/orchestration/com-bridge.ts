import { comInvoke } from './app-launcher'

const MAX_ARG_LENGTH = 2048

function sanitizeArg(value: unknown): string {
  const normalized = String(value ?? '')
  return normalized.slice(0, MAX_ARG_LENGTH)
}

export async function invokeComMethod(
  comClass: string,
  method: string,
  args: unknown[] = [],
): Promise<string> {
  const safeArgs = args.map((arg) => sanitizeArg(arg))
  return comInvoke(comClass, method, safeArgs)
}

export async function invokeComWithNamedArgs(
  comClass: string,
  method: string,
  args: Record<string, unknown>,
): Promise<string> {
  const ordered = Object.entries(args).map(([key, value]) => `${key}=${sanitizeArg(value)}`)
  return invokeComMethod(comClass, method, ordered)
}
