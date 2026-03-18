// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import axe from 'axe-core'
import React from 'react'
import { setLocale } from '../../src/renderer/src/i18n'
import EmailInbox from '../../src/renderer/src/components/email/EmailInbox'
import CalendarView from '../../src/renderer/src/components/calendar/CalendarView'
import DuplicateList from '../../src/renderer/src/components/file-org/DuplicateList'
import OrganizationPreview from '../../src/renderer/src/components/file-org/OrganizationPreview'
import McpServerList from '../../src/renderer/src/components/mcp/McpServerList'

const forcedFlags = {
  active: new Set<string>(),
}

vi.mock('../../src/renderer/src/lib/e2e-flags', () => ({
  hasE2EQueryFlag: (flag: string) => forcedFlags.active.has(flag),
}))

describe('forced notice surfaces accessibility', () => {
  beforeEach(() => {
    ;(window as any).usan = {
      email: {},
      calendar: {},
      mcp: {},
      fileOrg: {},
    }
    setLocale('en')
    document.documentElement.lang = 'en'
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    forcedFlags.active.clear()
  })

  it('keeps dashboard notice surfaces free of serious or critical axe violations', async () => {
    forcedFlags.active = new Set([
      'usan_e2e_force_email_notice',
      'usan_e2e_force_calendar_notice',
      'usan_e2e_force_file_org_notice',
    ])

    const { container } = render(
      <div>
        <EmailInbox />
        <CalendarView />
        <DuplicateList />
        <OrganizationPreview />
      </div>,
    )

    await screen.findByText('Email setup needed')
    await screen.findByText('Free time checked')
    await screen.findByText('Duplicate check finished')
    await screen.findByText('Preview ready')

    const result = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      rules: {
        'color-contrast': { enabled: false },
      },
    })

    const importantViolations = result.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    )

    expect(importantViolations).toHaveLength(0)
  })

  it('keeps MCP notice surface free of serious or critical axe violations', async () => {
    forcedFlags.active = new Set(['usan_e2e_force_mcp_notice'])

    const { container } = render(<McpServerList />)

    await screen.findByText('Tool connection added')

    const result = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      rules: {
        'color-contrast': { enabled: false },
      },
    })

    const importantViolations = result.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    )

    expect(importantViolations).toHaveLength(0)
  })
})
