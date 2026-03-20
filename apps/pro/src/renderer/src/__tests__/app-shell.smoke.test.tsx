import { render, screen, waitFor } from '@testing-library/react'
import App from '@renderer/App'
import { installMockUsan } from '@renderer/test/mockUsan'
import { resetStores } from '@renderer/test/resetStores'

describe('App shell', () => {
  beforeEach(() => {
    resetStores()
    installMockUsan()
  })

  it('hydrates the shell snapshot and renders the active workspace', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByText('카페 랜딩 페이지 빌드').length).toBeGreaterThan(0)
    })

    expect(screen.getByText('우리 카페 랜딩 페이지를 만들어줘.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '대화' })).toBeInTheDocument()
    expect(screen.getByLabelText('명령 팔레트 (Ctrl+K)')).toBeInTheDocument()
  })
})
