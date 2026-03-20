import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '@renderer/App'
import { useShellStore } from '@renderer/stores/shell.store'
import { installMockUsan } from '@renderer/test/mockUsan'
import { resetStores } from '@renderer/test/resetStores'
import type { ChatPayload } from '@shared/types'

describe('Composer chat integration', () => {
  beforeEach(() => {
    resetStores()
  })

  it('sends session context and persists main-owned shell updates from streamed chunks', async () => {
    const api = installMockUsan()

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Build a landing page for our cafe.')).toBeInTheDocument()
    })

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Summarize the integration plan.' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(api.ai.chat).toHaveBeenCalledTimes(1)
    })

    const payload = api.ai.chat.mock.calls[0][0] as ChatPayload
    expect(payload).toMatchObject({
      sessionId: 'sess-001',
      model: 'claude-sonnet-4-6',
      useTools: true,
      userMessage: {
        content: 'Summarize the integration plan.',
      },
    })
    expect(payload.messages).toEqual([
      { role: 'user', content: 'Build a landing page for our cafe.' },
      { role: 'user', content: 'Summarize the integration plan.' },
    ])

    await waitFor(() => {
      const shellState = useShellStore.getState()
      expect(shellState.messages.some((message) => message.id === payload.userMessage.id)).toBe(true)
      expect(shellState.runSteps.some((step) => step.id === `step-${payload.requestId}` && step.status === 'running')).toBe(true)
    })

    expect(screen.getByText('Summarize the integration plan.')).toBeInTheDocument()

    await act(async () => {
      api.emitChunk({
        requestId: payload.requestId,
        toolCall: {
          name: 'read_file',
          input: { path: 'src/App.tsx' },
        },
        done: false,
      })
      api.emitChunk({
        requestId: payload.requestId,
        toolResult: {
          id: 'tool-1',
          result: '42 lines read',
        },
        done: false,
      })
      api.emitChunk({
        requestId: payload.requestId,
        text: 'First I will wire the IPC boundary and session persistence.',
        done: false,
      })
    })

    expect(screen.getByText('First I will wire the IPC boundary and session persistence.')).toBeInTheDocument()

    await act(async () => {
      api.emitChunk({
        requestId: payload.requestId,
        done: true,
      })
    })

    await waitFor(() => {
      expect(screen.getByText('First I will wire the IPC boundary and session persistence.')).toBeInTheDocument()
    })

    await waitFor(() => {
      const shellState = useShellStore.getState()
      expect(shellState.runSteps.some((step) => step.id === `step-${payload.requestId}` && step.status === 'success')).toBe(true)
      expect(shellState.runSteps.some((step) => step.label === 'Run tool: read_file' && step.status === 'success')).toBe(true)
      expect(shellState.logs.some((log) => log.message.includes('Tool call: read_file'))).toBe(true)
      expect(shellState.logs.some((log) => log.message.includes('Response completed'))).toBe(true)
      expect(shellState.artifacts.some((artifact) => artifact.id === `artifact-${payload.requestId}` && artifact.kind === 'markdown')).toBe(true)
      expect(shellState.sessions.find((session) => session.id === 'sess-001')?.status).toBe('active')
    })
  })
})
