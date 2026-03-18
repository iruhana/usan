// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { Timeline, type TimelineApprovalRequest, type TimelineStep } from '../../src/renderer/src/components/agent'
import { setLocale } from '../../src/renderer/src/i18n'

const approvalRequest: TimelineApprovalRequest = {
  id: 'approval-1',
  title: 'Share the drafted summary?',
  description: 'This action will send the drafted summary to the selected teammate.',
  confirmLabel: 'Send it',
  rejectLabel: 'Not now',
  tone: 'danger',
}

const steps: TimelineStep[] = [
  {
    id: 'step-completed',
    kind: 'tool',
    status: 'completed',
    title: 'Read file list',
    description: 'The selected folder was scanned.',
    durationMs: 820,
    timestamp: new Date('2026-03-18T10:00:00Z').getTime(),
  },
  {
    id: 'step-running',
    kind: 'thinking',
    status: 'running',
    title: 'Planning next step',
    description: 'Usan is deciding what to do next.',
  },
  {
    id: 'step-awaiting',
    kind: 'approval',
    status: 'awaiting',
    title: 'Approval needed',
    description: 'Please confirm before continuing.',
    approval: approvalRequest,
  },
  {
    id: 'step-failed',
    kind: 'error',
    status: 'failed',
    title: 'Search failed',
    description: 'The online lookup could not finish.',
    error: 'Network timeout',
  },
  {
    id: 'step-pending',
    kind: 'tool',
    status: 'pending',
    title: 'Create report',
    description: 'Waiting in the queue.',
  },
]

describe('Timeline', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders all five timeline statuses and summary badges', () => {
    setLocale('en')
    render(<Timeline steps={steps} />)

    expect(screen.getByTestId('agent-timeline')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-completed-step-completed')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-running-step-running')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-awaiting-step-awaiting')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-failed-step-failed')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-pending-step-pending')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-summary')).toHaveTextContent('Completed')
    expect(screen.getByTestId('timeline-summary')).toHaveTextContent('Running')
    expect(screen.getByTestId('timeline-summary')).toHaveTextContent('Awaiting approval')
    expect(screen.getByTestId('timeline-summary')).toHaveTextContent('Failed')
    expect(screen.getByTestId('timeline-summary')).toHaveTextContent('Pending')
  })

  it('calls retry and approval callbacks', () => {
    setLocale('en')
    const onRetry = vi.fn()
    const onApprove = vi.fn()
    const onReject = vi.fn()

    render(
      <Timeline
        steps={steps}
        onRetry={onRetry}
        onApprove={onApprove}
        onReject={onReject}
      />,
    )

    fireEvent.click(screen.getByTestId('timeline-retry-button'))
    fireEvent.click(screen.getByRole('button', { name: 'Send it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onApprove).toHaveBeenCalledWith(approvalRequest)
    expect(onReject).toHaveBeenCalledWith(approvalRequest)
  })

  it('shows the empty state when there are no steps', () => {
    setLocale('en')
    render(<Timeline steps={[]} />)

    expect(screen.getByText('No steps yet')).toBeInTheDocument()
    expect(
      screen.getByText('Agent execution details will appear here after you send a task.'),
    ).toBeInTheDocument()
  })
})
