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

  it('sends the active session history and commits the streamed response into the shell store', async () => {
    const api = installMockUsan()

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('우리 카페 랜딩 페이지를 만들어줘.')).toBeInTheDocument()
    })

    const input = screen.getByLabelText('메시지 입력')
    fireEvent.change(input, { target: { value: '이어서 작업 계획을 정리해줘.' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(api.ai.chat).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText('이어서 작업 계획을 정리해줘.')).toBeInTheDocument()

    const payload = api.ai.chat.mock.calls[0][0] as ChatPayload
    expect(payload).toMatchObject({
      model: 'claude-sonnet-4-6',
      useTools: true,
    })
    expect(payload.messages).toEqual([
      { role: 'user', content: '우리 카페 랜딩 페이지를 만들어줘.' },
      { role: 'user', content: '이어서 작업 계획을 정리해줘.' },
    ])
    expect(useShellStore.getState().runSteps.some((step) => step.id === `step-${payload.requestId}` && step.status === 'running')).toBe(true)

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
        text: '좋습니다. 먼저 IPC 경계와 세션 영속화를 정리하겠습니다.',
        done: false,
      })
    })

    expect(screen.getByText('좋습니다. 먼저 IPC 경계와 세션 영속화를 정리하겠습니다.')).toBeInTheDocument()

    await act(async () => {
      api.emitChunk({
        requestId: payload.requestId,
        done: true,
      })
    })

    await waitFor(() => {
      expect(screen.getByText('좋습니다. 먼저 IPC 경계와 세션 영속화를 정리하겠습니다.')).toBeInTheDocument()
    })

    const shellState = useShellStore.getState()
    expect(shellState.runSteps.some((step) => step.id === `step-${payload.requestId}` && step.status === 'success')).toBe(true)
    expect(shellState.runSteps.some((step) => step.label === '도구 실행: read_file' && step.status === 'success')).toBe(true)
    expect(shellState.logs.some((log) => log.message.includes('Tool call: read_file'))).toBe(true)
    expect(shellState.logs.some((log) => log.message.includes('응답 생성 완료'))).toBe(true)
    expect(shellState.artifacts.some((artifact) => artifact.id === `artifact-${payload.requestId}` && artifact.kind === 'markdown')).toBe(true)
  })
})
