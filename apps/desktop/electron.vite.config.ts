import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

function isMarkdownDependency(id: string): boolean {
  return /\/(react-markdown|remark(?:-|\/)|rehype(?:-|\/)|micromark(?:-|\/)|mdast(?:-|\/)|hast(?:-|\/)|unist(?:-|\/)|vfile(?:-|\/)|unified(?:\/|$)|bail(?:\/|$)|trough(?:\/|$)|zwitch(?:\/|$)|ccount(?:\/|$)|mdurl(?:\/|$)|hastscript(?:\/|$)|property-information(?:\/|$)|space-separated-tokens(?:\/|$)|comma-separated-tokens(?:\/|$)|decode-named-character-reference(?:\/|$)|character-entities(?:-|\/|$)|parse-entities(?:\/|$)|trim-lines(?:\/|$))/.test(
    id
  )
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('lucide-react')) return 'icons-vendor'
            if (id.includes('recharts') || id.includes('/d3-')) return 'charts-vendor'
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react-core'
            if (id.includes('/zustand/') || id.includes('/cmdk/')) return 'state-ui-vendor'
            if (isMarkdownDependency(id)) return 'markdown-vendor'
            if (id.includes('/@supabase/')) return 'supabase-vendor'
            return 'vendor'
          }
        }
      }
    }
  }
})
