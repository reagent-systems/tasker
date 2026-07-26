import { TRANSPORT_ORDER } from '@shared/types'

/** World height of the camera view. Every layout value uses this scale. */
export const VIEW_HEIGHT = 4

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Layout {
  viewWidth: number
  viewHeight: number
  body: Rect
  grip: Rect
  rolodex: Rect
  preview: Rect
  keys: Rect[]
  lamp: { x: number; y: number; radius: number }
}

export function computeLayout(aspect: number): Layout {
  const viewWidth = VIEW_HEIGHT * aspect
  const margin = 0.26
  const body: Rect = {
    x: 0,
    y: 0,
    width: viewWidth - margin * 2,
    height: VIEW_HEIGHT - margin * 2
  }
  const top = body.height / 2
  const bottom = -body.height / 2
  const padding = 0.22
  const inner = body.width - padding * 2

  const grip: Rect = { x: 0, y: top - 0.17, width: inner * 0.42, height: 0.075 }

  const keyHeight = Math.min(0.68, body.height * 0.19)
  const gap = 0.1
  const keyWidth = (inner - gap * (TRANSPORT_ORDER.length - 1)) / TRANSPORT_ORDER.length
  const keyY = bottom + padding + keyHeight / 2
  const keys: Rect[] = TRANSPORT_ORDER.map((_action, index) => ({
    x: -inner / 2 + keyWidth / 2 + index * (keyWidth + gap),
    y: keyY,
    width: keyWidth,
    height: keyHeight
  }))

  const zoneTop = top - 0.34
  const zoneBottom = keyY + keyHeight / 2 + 0.14
  const zoneHeight = zoneTop - zoneBottom
  const zoneCenter = (zoneTop + zoneBottom) / 2

  const previewWidth = Math.min(inner * 0.3, zoneHeight * 0.86)
  const columnGap = 0.14
  const rolodexWidth = inner - previewWidth - columnGap

  const rolodex: Rect = {
    x: -inner / 2 + rolodexWidth / 2,
    y: zoneCenter,
    width: rolodexWidth,
    height: zoneHeight
  }
  const preview: Rect = {
    x: inner / 2 - previewWidth / 2,
    y: zoneCenter,
    width: previewWidth,
    height: zoneHeight
  }

  return {
    viewWidth,
    viewHeight: VIEW_HEIGHT,
    body,
    grip,
    rolodex,
    preview,
    keys,
    lamp: { x: inner / 2 - 0.02, y: top - 0.175, radius: 0.042 }
  }
}
