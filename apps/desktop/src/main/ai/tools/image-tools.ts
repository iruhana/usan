/**
 * Image tools: image_resize, image_crop, image_convert, image_compress, image_info
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { resizeImage, cropImage, convertImage, compressImage, getImageInfo } from '../../image/image-processor'
import { join, dirname, basename, extname } from 'path'

export const definitions: ProviderTool[] = [
  {
    name: 'image_resize',
    description: '이미지를 리사이즈합니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '이미지 경로' },
        width: { type: 'number', description: '너비 (px)' },
        height: { type: 'number', description: '높이 (px)' },
        outputPath: { type: 'string', description: '출력 경로 (생략 시 자동 생성)' },
      },
      required: ['path', 'width', 'height'],
    },
  },
  {
    name: 'image_crop',
    description: '이미지를 크롭합니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        left: { type: 'number' }, top: { type: 'number' },
        width: { type: 'number' }, height: { type: 'number' },
        outputPath: { type: 'string' },
      },
      required: ['path', 'left', 'top', 'width', 'height'],
    },
  },
  {
    name: 'image_convert',
    description: '이미지 포맷을 변환합니다 (PNG/JPEG/WEBP).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        format: { type: 'string', enum: ['png', 'jpeg', 'webp'] },
        quality: { type: 'number', description: '품질 (1-100, 기본: 80)' },
        outputPath: { type: 'string' },
      },
      required: ['path', 'format'],
    },
  },
  {
    name: 'image_compress',
    description: '이미지를 압축합니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        quality: { type: 'number', description: '품질 (1-100, 기본: 70)' },
        outputPath: { type: 'string' },
      },
      required: ['path'],
    },
  },
  {
    name: 'image_info',
    description: '이미지 정보를 조회합니다 (크기, 포맷, 해상도 등).',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
]

function autoOutput(path: string, suffix: string, newExt?: string): string {
  const dir = dirname(path)
  const name = basename(path, extname(path))
  const ext = newExt || extname(path)
  return join(dir, `${name}_${suffix}${ext}`)
}

export const handlers: Record<string, ToolHandler> = {
  async image_resize(args) {
    const out = (args.outputPath as string) || autoOutput(args.path as string, 'resized')
    const result = await resizeImage(args.path as string, args.width as number, args.height as number, out)
    return { ...result, outputPath: out }
  },

  async image_crop(args) {
    const out = (args.outputPath as string) || autoOutput(args.path as string, 'cropped')
    const result = await cropImage(args.path as string, args.left as number, args.top as number, args.width as number, args.height as number, out)
    return { ...result, outputPath: out }
  },

  async image_convert(args) {
    const format = args.format as 'png' | 'jpeg' | 'webp'
    const out = (args.outputPath as string) || autoOutput(args.path as string, 'converted', `.${format}`)
    const result = await convertImage(args.path as string, format, (args.quality as number) ?? 80, out)
    return { ...result, outputPath: out }
  },

  async image_compress(args) {
    const out = (args.outputPath as string) || autoOutput(args.path as string, 'compressed')
    const result = await compressImage(args.path as string, (args.quality as number) ?? 70, out)
    return { ...result, outputPath: out }
  },

  async image_info(args) {
    return getImageInfo(args.path as string)
  },
}
