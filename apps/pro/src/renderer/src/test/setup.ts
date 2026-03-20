import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

if (typeof Element !== 'undefined') {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
}
