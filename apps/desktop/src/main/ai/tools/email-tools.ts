/**
 * Email tools: email_list, email_read, email_draft, email_send
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { listEmails, readEmail, sendEmail, isEmailConfigured } from '../../email/email-manager'

export const definitions: ProviderTool[] = [
  {
    name: 'email_list',
    description: '받은 이메일 목록을 조회합니다.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '표시할 메일 수 (기본: 20)' },
      },
    },
  },
  {
    name: 'email_read',
    description: '이메일 내용을 읽습니다.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: '이메일 ID' } },
      required: ['id'],
    },
  },
  {
    name: 'email_draft',
    description: '이메일 초안을 작성합니다. (보내지 않음)',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'array', items: { type: 'string' }, description: '수신자 이메일' },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'email_send',
    description: '이메일을 전송합니다.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'array', items: { type: 'string' } },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async email_list(args) {
    if (!isEmailConfigured()) return { error: '이메일이 연동되지 않았습니다. 설정에서 연결해주세요.' }
    const emails = await listEmails((args.limit as number) || 20)
    return { emails: emails.map((e) => ({ id: e.id, from: e.from, subject: e.subject, snippet: e.snippet, date: e.date, read: e.read })) }
  },

  async email_read(args) {
    if (!isEmailConfigured()) return { error: '이메일이 연동되지 않았습니다.' }
    const email = await readEmail(args.id as string)
    if (!email) return { error: '이메일을 찾을 수 없습니다.' }
    return email
  },

  async email_draft(args) {
    return {
      draft: {
        to: args.to as string[],
        subject: args.subject as string,
        body: args.body as string,
      },
      instruction: '초안이 작성되었습니다. 수정 후 email_send로 전송하세요.',
    }
  },

  async email_send(args) {
    if (!isEmailConfigured()) return { error: '이메일이 연동되지 않았습니다. 설정에서 연결해주세요.' }
    return sendEmail({
      to: args.to as string[],
      subject: args.subject as string,
      body: args.body as string,
    })
  },
}
