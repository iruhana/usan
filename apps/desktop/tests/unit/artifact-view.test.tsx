// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { ArtifactShelf, ArtifactView } from '../../src/renderer/src/components/artifact'
import { setLocale } from '../../src/renderer/src/i18n'

const artifacts = [
  {
    id: 'code-1',
    title: 'Code example',
    kind: 'code' as const,
    source: 'assistant' as const,
    createdAt: 1000,
    content: 'console.log("hello")',
    copyText: 'console.log("hello")',
    language: 'ts',
    sourceLabel: 'Assistant',
  },
  {
    id: 'table-1',
    title: 'Table example',
    kind: 'table' as const,
    source: 'tool' as const,
    createdAt: 900,
    content: '| Name | Value |\n| --- | --- |\n| A | 1 |',
    copyText: '| Name | Value |\n| --- | --- |\n| A | 1 |',
    table: {
      headers: ['Name', 'Value'],
      rows: [['A', '1']],
    },
    sourceLabel: 'Tool result',
  },
]

describe('Artifact components', () => {
  beforeEach(() => {
    setLocale('en')
  })

  it('renders shelf items and code artifact view', () => {
    render(
      <>
        <ArtifactShelf
          artifacts={artifacts}
          selectedArtifactId="code-1"
          onSelectArtifact={() => {}}
        />
        <ArtifactView artifact={artifacts[0]} />
      </>,
    )

    expect(screen.getByTestId('artifact-shelf')).toBeInTheDocument()
    expect(screen.getByTestId('artifact-shelf-item-code-1')).toBeInTheDocument()
    expect(screen.getByTestId('artifact-view')).toBeInTheDocument()
    expect(screen.getByTestId('artifact-code-block')).toBeInTheDocument()
    expect(screen.getAllByText('Code example')).toHaveLength(2)
  })

  it('renders a table artifact', () => {
    render(<ArtifactView artifact={artifacts[1]} />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })
})
