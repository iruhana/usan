export type ArtifactKind = 'markdown' | 'code' | 'table' | 'image' | 'json' | 'text'
export type ArtifactSource = 'assistant' | 'tool' | 'draft'

export interface ArtifactTableData {
  headers: string[]
  rows: string[][]
}

export interface ArtifactItem {
  id: string
  title: string
  kind: ArtifactKind
  source: ArtifactSource
  createdAt: number
  copyText?: string
  content?: string
  language?: string
  image?: string
  table?: ArtifactTableData
  sourceLabel?: string
}
