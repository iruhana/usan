/**
 * Screen Analyzer: capture full screen or region and return PNG buffers.
 * Uses sharp for region extraction when available.
 */
import { desktopCapturer, screen } from 'electron'
import sharp from 'sharp'

export interface ScreenRegion {
  x: number
  y: number
  width: number
  height: number
}

function resolveCaptureSize(displayId?: number): { targetDisplayId?: number; width: number; height: number } {
  const displays = screen.getAllDisplays()
  const display = displayId
    ? displays.find((item) => item.id === displayId)
    : screen.getPrimaryDisplay()

  if (!display) {
    return { width: 1920, height: 1080 }
  }

  // desktopCapturer works with physical pixels.
  const scaleFactor = Number.isFinite(display.scaleFactor) ? display.scaleFactor : 1
  const width = Math.max(1, Math.round(display.bounds.width * scaleFactor))
  const height = Math.max(1, Math.round(display.bounds.height * scaleFactor))
  return { targetDisplayId: display.id, width, height }
}

export async function captureScreen(displayId?: number): Promise<Buffer> {
  const capture = resolveCaptureSize(displayId)
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: capture.width, height: capture.height },
  })

  const source = capture.targetDisplayId
    ? sources.find((item) => item.display_id === String(capture.targetDisplayId))
    : sources[0]

  if (!source) {
    throw new Error('No screen source available')
  }

  return source.thumbnail.toPNG()
}

export async function captureRegion(region: ScreenRegion, displayId?: number): Promise<Buffer> {
  const fullScreen = await captureScreen(displayId)

  const safeRegion = {
    left: Math.max(0, Math.floor(region.x)),
    top: Math.max(0, Math.floor(region.y)),
    width: Math.max(1, Math.floor(region.width)),
    height: Math.max(1, Math.floor(region.height)),
  }

  return sharp(fullScreen)
    .extract(safeRegion)
    .png()
    .toBuffer()
}

export function getScreenSize(displayId?: number): { width: number; height: number } {
  const displays = screen.getAllDisplays()
  const display = displayId
    ? displays.find((item) => item.id === displayId)
    : screen.getPrimaryDisplay()

  if (!display) return { width: 1920, height: 1080 }
  return { width: display.size.width, height: display.size.height }
}

export async function imageToBase64(buffer: Buffer): Promise<string> {
  return buffer.toString('base64')
}
