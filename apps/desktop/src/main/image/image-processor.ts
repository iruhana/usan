/**
 * Image Processor: resize, crop, convert, and compress using sharp.
 */
import { stat } from 'fs/promises'
import sharp from 'sharp'
import { validatePath } from '../security'

function assertSafePath(filePath: string, operation: 'read' | 'write'): void {
  const error = validatePath(filePath, operation)
  if (error) throw new Error(error)
}

export async function resizeImage(
  inputPath: string,
  width: number,
  height: number,
  outputPath: string,
): Promise<{ outputPath: string; width: number; height: number; size: number }> {
  assertSafePath(inputPath, 'read')
  assertSafePath(outputPath, 'write')
  const result = await sharp(inputPath).resize(width, height, { fit: 'inside' }).toFile(outputPath)
  return {
    outputPath,
    width: result.width,
    height: result.height,
    size: result.size,
  }
}

export async function cropImage(
  inputPath: string,
  left: number,
  top: number,
  width: number,
  height: number,
  outputPath: string,
): Promise<{ outputPath: string; width: number; height: number; size: number }> {
  assertSafePath(inputPath, 'read')
  assertSafePath(outputPath, 'write')
  const result = await sharp(inputPath).extract({ left, top, width, height }).toFile(outputPath)
  return {
    outputPath,
    width: result.width,
    height: result.height,
    size: result.size,
  }
}

export async function convertImage(
  inputPath: string,
  format: 'png' | 'jpeg' | 'webp',
  quality: number,
  outputPath: string,
): Promise<{ outputPath: string; format: string; size: number }> {
  assertSafePath(inputPath, 'read')
  assertSafePath(outputPath, 'write')
  let pipeline = sharp(inputPath)
  if (format === 'jpeg') pipeline = pipeline.jpeg({ quality })
  else if (format === 'webp') pipeline = pipeline.webp({ quality })
  else pipeline = pipeline.png({ compressionLevel: Math.round((100 - quality) / 10) })

  const result = await pipeline.toFile(outputPath)
  return {
    outputPath,
    format: result.format,
    size: result.size,
  }
}

export async function compressImage(
  inputPath: string,
  quality: number,
  outputPath: string,
): Promise<{ outputPath: string; size: number; savedPercent: number }> {
  assertSafePath(inputPath, 'read')
  assertSafePath(outputPath, 'write')
  const meta = await sharp(inputPath).metadata()
  const format = meta.format || 'png'
  let pipeline = sharp(inputPath)

  if (format === 'jpeg' || format === 'jpg') pipeline = pipeline.jpeg({ quality })
  else if (format === 'webp') pipeline = pipeline.webp({ quality })
  else pipeline = pipeline.png({ compressionLevel: Math.round((100 - quality) / 10) })

  const result = await pipeline.toFile(outputPath)

  let originalSize = meta.size
  if (!originalSize || originalSize <= 0) {
    const fsMeta = await stat(inputPath).catch(() => null)
    originalSize = fsMeta?.size ?? result.size
  }

  const savedPercent = originalSize > 0
    ? Math.round((1 - result.size / originalSize) * 100)
    : 0

  return {
    outputPath,
    size: result.size,
    savedPercent,
  }
}

export async function getImageInfo(inputPath: string): Promise<Record<string, unknown>> {
  assertSafePath(inputPath, 'read')
  const meta = await sharp(inputPath).metadata()
  return {
    width: meta.width,
    height: meta.height,
    format: meta.format,
    size: meta.size,
    space: meta.space,
    channels: meta.channels,
    hasAlpha: meta.hasAlpha,
    path: inputPath,
  }
}
