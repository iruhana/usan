import axe from 'axe-core'
import { render, screen, waitFor } from '@testing-library/react'
import App from '@renderer/App'
import { installMockUsan } from '@renderer/test/mockUsan'
import { resetStores } from '@renderer/test/resetStores'

describe('App shell accessibility', () => {
  beforeEach(() => {
    resetStores()
    installMockUsan()
  })

  it('has no accessibility violations in the hydrated shell', async () => {
    const { container } = render(<App />)

    await waitFor(() => {
      expect(screen.getByText('우리 카페 랜딩 페이지를 만들어줘.')).toBeInTheDocument()
    })

    const results = await axe.run(container)
    expect(results.violations).toEqual([])
  })
})
