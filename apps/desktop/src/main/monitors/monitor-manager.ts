import { screen } from 'electron'
import type { DisplayInfo } from '@shared/types/infrastructure'
import { captureScreen, imageToBase64 } from '../vision/screen-analyzer'

export function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((display) => ({
    id: display.id,
    label: display.label || `Display ${display.id}`,
    bounds: display.bounds,
    primary: display.id === primaryId,
    scaleFactor: display.scaleFactor,
  }))
}

export async function screenshotDisplay(displayId: number): Promise<string> {
  const image = await captureScreen(displayId)
  return imageToBase64(image)
}
