import { CanvasTexture, LinearFilter, SRGBColorSpace, type Texture } from 'three'

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif'

export interface CardFace {
  title: string
  subtitle: string
  meta: string
  index: string
}

export interface CardStyle {
  background: string
  title: string
  subtitle: string
  rule: string
}

const WIDTH = 900

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter((word) => word !== '')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current === '' ? word : `${current} ${word}`
    if (ctx.measureText(next).width <= maxWidth) {
      current = next
      continue
    }
    if (current !== '') lines.push(current)
    current = word
    if (lines.length === maxLines) break
  }
  if (current !== '' && lines.length < maxLines) lines.push(current)
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1] ?? ''
    if (ctx.measureText(last).width > maxWidth * 0.98) {
      lines[maxLines - 1] = `${last.slice(0, Math.max(0, last.length - 2))}…`
    }
  }
  return lines
}

/** Draws the face of one rolodex card. The aspect matches the card mesh. */
export function cardTexture(face: CardFace, style: CardStyle, aspect: number): Texture {
  const HEIGHT = Math.round(WIDTH / Math.max(0.5, aspect))
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas context is not available')

  ctx.fillStyle = style.background
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const padding = 56
  ctx.textBaseline = 'top'

  ctx.fillStyle = style.subtitle
  ctx.font = `500 26px ${FONT_STACK}`
  ctx.fillText(face.index, padding, padding - 6)

  const metaWidth = ctx.measureText(face.meta).width
  ctx.fillText(face.meta, WIDTH - padding - metaWidth, padding - 6)

  ctx.fillStyle = style.rule
  ctx.fillRect(padding, padding + 40, WIDTH - padding * 2, 3)

  ctx.fillStyle = style.title
  ctx.font = `700 58px ${FONT_STACK}`
  const titleLines = wrap(ctx, face.title, WIDTH - padding * 2, 2)
  let y = padding + 84
  for (const line of titleLines) {
    ctx.fillText(line, padding, y)
    y += 66
  }

  ctx.fillStyle = style.subtitle
  ctx.font = `400 30px ${FONT_STACK}`
  const bodyLines = wrap(ctx, face.subtitle, WIDTH - padding * 2, 4)
  y += 14
  for (const line of bodyLines) {
    ctx.fillText(line, padding, y)
    y += 42
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.anisotropy = 4
  return texture
}
