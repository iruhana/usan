/**
 * RAG tools: knowledge_search, knowledge_index_file, knowledge_index_folder, knowledge_list, knowledge_remove
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { vectorStore } from '../../rag/vector-store'
import { indexFile, indexFolder } from '../../rag/document-indexer'
import { generateEmbedding } from '../../rag/embeddings'

export const definitions: ProviderTool[] = [
  {
    name: 'knowledge_search',
    description: '로컬 지식 베이스에서 관련 문서를 검색합니다. 인덱싱된 파일에서 질문과 관련된 내용을 찾습니다.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '검색 질문' },
        topK: { type: 'number', description: '반환할 결과 수 (기본: 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'knowledge_index_file',
    description: '파일을 지식 베이스에 인덱싱합니다. PDF, TXT, MD, JSON 등 텍스트 기반 파일을 지원합니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '인덱싱할 파일 경로' },
      },
      required: ['path'],
    },
  },
  {
    name: 'knowledge_index_folder',
    description: '폴더 내 모든 파일을 지식 베이스에 인덱싱합니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '인덱싱할 폴더 경로' },
      },
      required: ['path'],
    },
  },
  {
    name: 'knowledge_list',
    description: '인덱싱된 문서 목록을 조회합니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'knowledge_remove',
    description: '지식 베이스에서 문서를 제거합니다.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '제거할 문서 ID' },
      },
      required: ['id'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async knowledge_search(args) {
    const query = args.query as string
    const topK = (args.topK as number) ?? 5
    const queryEmbedding = await generateEmbedding(query)
    const results = vectorStore.search(queryEmbedding, topK, query)
    return { results, totalDocuments: vectorStore.listDocuments().length }
  },

  async knowledge_index_file(args) {
    const result = await indexFile(args.path as string)
    return { success: true, ...result }
  },

  async knowledge_index_folder(args) {
    const result = await indexFolder(args.path as string)
    return { success: true, ...result }
  },

  async knowledge_list() {
    const documents = vectorStore.listDocuments()
    return {
      documents: documents.map((d) => ({
        id: d.id,
        name: d.name,
        path: d.path,
        chunks: d.chunks,
        indexedAt: d.indexedAt,
      })),
      totalEntries: vectorStore.totalEntries,
    }
  },

  async knowledge_remove(args) {
    vectorStore.removeDocument(args.id as string)
    await vectorStore.saveToDisk()
    return { success: true }
  },
}
