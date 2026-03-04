/**
 * File organization tools: organize_folder, find_duplicates, categorize_file
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { planOrganization, findDuplicates, analyzeFolder } from '../../file-org/file-categorizer'
import { rename, mkdir } from 'fs/promises'
import { dirname } from 'path'

export const definitions: ProviderTool[] = [
  {
    name: 'organize_folder',
    description: '폴더 내 파일을 카테고리별로 정리합니다 (문서/이미지/영상/음악/코드 등). dryRun=true로 미리보기 가능.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '정리할 폴더 경로' },
        dryRun: { type: 'boolean', description: '미리보기만 (실제 이동 없음, 기본: true)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'find_duplicates',
    description: '폴더에서 중복 파일을 찾습니다 (SHA-256 해시 비교).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '검색할 폴더 경로' },
      },
      required: ['path'],
    },
  },
  {
    name: 'analyze_folder',
    description: '폴더의 파일 구성을 분석합니다 (카테고리별 파일 수와 크기).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '분석할 폴더 경로' },
      },
      required: ['path'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async organize_folder(args) {
    const plan = await planOrganization(args.path as string)
    const dryRun = args.dryRun !== false // default true

    if (dryRun) {
      return {
        dryRun: true,
        plan: plan.moves.map((m) => ({ file: m.from, destination: m.to, category: m.category })),
        totalFiles: plan.totalFiles,
        instruction: 'dryRun=false로 실행하면 실제로 파일을 이동합니다.',
      }
    }

    let moved = 0
    const errors: string[] = []
    for (const move of plan.moves) {
      try {
        await mkdir(dirname(move.to), { recursive: true })
        await rename(move.from, move.to)
        moved++
      } catch (err) {
        errors.push(`${move.from}: ${(err as Error).message}`)
      }
    }
    return { moved, errors: errors.length ? errors : undefined, totalPlanned: plan.totalFiles }
  },

  async find_duplicates(args) {
    const groups = await findDuplicates(args.path as string)
    return {
      duplicateGroups: groups.map((g) => ({
        hash: g.hash.slice(0, 12),
        size: g.size,
        files: g.files,
        count: g.files.length,
      })),
      totalDuplicates: groups.reduce((sum, g) => sum + g.files.length - 1, 0),
    }
  },

  async analyze_folder(args) {
    const categories = await analyzeFolder(args.path as string)
    return {
      categories: categories.map((c) => ({
        name: c.name,
        fileCount: c.files.length,
        totalSize: c.files.reduce((sum, f) => sum + f.size, 0),
      })),
    }
  },
}
