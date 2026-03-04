/**
 * Calendar tools: calendar_list_events, calendar_create_event, calendar_find_free_time
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { listEvents, createEvent, findFreeTime, isCalendarConfigured } from '../../calendar/calendar-manager'

export const definitions: ProviderTool[] = [
  {
    name: 'calendar_list_events',
    description: '캘린더 일정을 조회합니다.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: '조회할 기간 (일, 기본: 7)' },
      },
    },
  },
  {
    name: 'calendar_create_event',
    description: '캘린더에 새 일정을 추가합니다.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        start: { type: 'string', description: '시작 시간 (ISO 8601)' },
        end: { type: 'string', description: '종료 시간 (ISO 8601)' },
        location: { type: 'string' },
        attendees: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'start', 'end'],
    },
  },
  {
    name: 'calendar_find_free_time',
    description: '특정 날짜에 비어있는 시간을 찾습니다.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: '날짜 (YYYY-MM-DD)' },
        durationMinutes: { type: 'number', description: '필요한 시간 (분, 기본: 60)' },
      },
      required: ['date'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async calendar_list_events(args) {
    if (!isCalendarConfigured()) return { error: '캘린더가 연동되지 않았습니다.' }
    const days = (args.days as number) || 7
    const now = Date.now()
    const events = await listEvents(now, now + days * 86400000)
    return { events }
  },

  async calendar_create_event(args) {
    if (!isCalendarConfigured()) return { error: '캘린더가 연동되지 않았습니다.' }
    return createEvent({
      title: args.title as string,
      description: args.description as string | undefined,
      start: new Date(args.start as string).getTime(),
      end: new Date(args.end as string).getTime(),
      location: args.location as string | undefined,
      attendees: args.attendees as string[] | undefined,
    })
  },

  async calendar_find_free_time(args) {
    if (!isCalendarConfigured()) return { error: '캘린더가 연동되지 않았습니다.' }
    const slots = await findFreeTime(args.date as string, (args.durationMinutes as number) || 60)
    return { freeSlots: slots }
  },
}
