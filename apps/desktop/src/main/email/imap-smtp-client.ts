import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'
import type { StoredEmailAccountConfig } from './email-account-store'

export interface ImapSmtpEmailMessage {
  id: string
  from: string
  to: string[]
  subject: string
  body: string
  date: number
  read: boolean
  snippet: string
  cc?: string[]
  attachments?: Array<{ name: string; size: number }>
}

function createImapClient(config: StoredEmailAccountConfig): ImapFlow {
  return new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
    logger: false,
  })
}

function createSmtpTransport(config: StoredEmailAccountConfig) {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  })
}

function formatMailboxAddress(entry: { name?: string | null; address?: string | null } | null | undefined): string {
  if (!entry?.address) return ''
  if (entry.name?.trim()) {
    return `${entry.name.trim()} <${entry.address.trim()}>`
  }
  return entry.address.trim()
}

function mapAddressList(
  entries: Array<{ name?: string | null; address?: string | null }> | null | undefined,
): string[] {
  return (entries ?? [])
    .map((entry) => formatMailboxAddress(entry))
    .filter((entry) => entry.length > 0)
}

function buildSnippet(body: string, fallback = ''): string {
  const source = body.trim() || fallback.trim()
  return source.replace(/\s+/g, ' ').trim().slice(0, 160)
}

function extractParsedAddresses(value: unknown): string[] {
  if (!value) return []

  const entries = Array.isArray((value as { value?: unknown[] }).value)
    ? ((value as { value: Array<{ name?: string | null; address?: string | null }> }).value ?? [])
    : Array.isArray(value)
      ? (value as Array<{ name?: string | null; address?: string | null }>)
      : []

  return entries.map((entry) => formatMailboxAddress(entry)).filter(Boolean)
}

function isSeenFlag(flags: unknown): boolean {
  if (flags instanceof Set) {
    return flags.has('\\Seen')
  }
  if (Array.isArray(flags)) {
    return flags.includes('\\Seen')
  }
  return false
}

async function withImapClient<T>(
  config: StoredEmailAccountConfig,
  callback: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = createImapClient(config)
  await client.connect()
  try {
    return await callback(client)
  } finally {
    await client.logout().catch(() => undefined)
  }
}

export async function verifyImapSmtpConnection(config: StoredEmailAccountConfig): Promise<void> {
  const transport = createSmtpTransport(config)
  await transport.verify()

  await withImapClient(config, async (client) => {
    const lock = await client.getMailboxLock('INBOX')
    try {
      return undefined
    } finally {
      lock.release()
    }
  })
}

export async function listImapSmtpMessages(
  config: StoredEmailAccountConfig,
  limit = 20,
): Promise<ImapSmtpEmailMessage[]> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 50))

  return withImapClient(config, async (client) => {
    const lock = await client.getMailboxLock('INBOX')
    try {
      const total = client.mailbox ? client.mailbox.exists : 0
      if (total < 1) {
        return []
      }

      const start = Math.max(1, total - safeLimit + 1)
      const messages: ImapSmtpEmailMessage[] = []

      for await (const message of client.fetch(
        `${start}:*`,
        { envelope: true, flags: true, internalDate: true, uid: true },
      )) {
        const envelope = message.envelope as
          | {
              subject?: string
              from?: Array<{ name?: string | null; address?: string | null }>
              to?: Array<{ name?: string | null; address?: string | null }>
            }
          | undefined

        messages.push({
          id: String(message.uid),
          from: formatMailboxAddress(envelope?.from?.[0]) || config.emailAddress,
          to: mapAddressList(envelope?.to),
          subject: envelope?.subject?.trim() || '',
          body: '',
          date: message.internalDate instanceof Date ? message.internalDate.getTime() : Date.now(),
          read: isSeenFlag(message.flags),
          snippet: buildSnippet('', envelope?.subject ?? ''),
        })
      }

      return messages.reverse()
    } finally {
      lock.release()
    }
  })
}

export async function readImapSmtpMessage(
  config: StoredEmailAccountConfig,
  id: string,
): Promise<ImapSmtpEmailMessage | null> {
  const uid = Number.parseInt(id, 10)
  if (!Number.isFinite(uid) || uid < 1) {
    return null
  }

  return withImapClient(config, async (client) => {
    const lock = await client.getMailboxLock('INBOX')
    try {
      const message = await client.fetchOne(
        String(uid),
        { envelope: true, flags: true, internalDate: true, uid: true, source: true },
        { uid: true },
      )

      if (!message) {
        return null
      }

      const parsed = (await simpleParser(message.source ?? Buffer.alloc(0))) as Awaited<
        ReturnType<typeof simpleParser>
      >
      const envelope = message.envelope as
        | {
            subject?: string
            from?: Array<{ name?: string | null; address?: string | null }>
            to?: Array<{ name?: string | null; address?: string | null }>
            cc?: Array<{ name?: string | null; address?: string | null }>
          }
        | undefined
      const body = parsed.text?.trim() || ''
      const parsedTo = extractParsedAddresses(parsed.to)
      const parsedCc = extractParsedAddresses(parsed.cc)

      return {
        id: String(message.uid ?? uid),
        from: formatMailboxAddress(envelope?.from?.[0]) || config.emailAddress,
        to: parsedTo.length > 0 ? parsedTo : mapAddressList(envelope?.to),
        cc: parsedCc.length > 0 ? parsedCc : mapAddressList(envelope?.cc),
        subject: parsed.subject?.trim() || envelope?.subject?.trim() || '',
        body,
        date: message.internalDate instanceof Date ? message.internalDate.getTime() : Date.now(),
        read: isSeenFlag(message.flags),
        snippet: buildSnippet(body, parsed.subject || envelope?.subject || ''),
        attachments: parsed.attachments.map((attachment: { filename?: string | null; size: number }) => ({
          name: attachment.filename || 'attachment',
          size: attachment.size,
        })),
      }
    } finally {
      lock.release()
    }
  })
}

export async function sendImapSmtpMessage(
  config: StoredEmailAccountConfig,
  draft: { to: string[]; subject: string; body: string },
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const recipients = draft.to.map((entry) => entry.trim()).filter(Boolean)
  if (recipients.length === 0) {
    return { success: false, error: 'Recipient list is empty' }
  }

  const transport = createSmtpTransport(config)
  try {
    const info = await transport.sendMail({
      from: {
        address: config.emailAddress,
        name: config.displayName || config.emailAddress,
      },
      to: recipients,
      subject: draft.subject,
      text: draft.body,
    })

    return {
      success: true,
      messageId: info.messageId,
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    }
  }
}
