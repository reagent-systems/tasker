import { CanvasTexture, LinearFilter, SRGBColorSpace, type Texture } from 'three'
import type { SkillPreview } from '@shared/types'

/**
 * A skill preview is a screen recording. The preview panel is small and upright.
 * A full screen therefore stays unreadable at this size.
 * The source finds the place of the action in each frame and shows a zoomed crop of that place.
 */

export interface PreviewSource {
  texture: Texture
  /** The scene calls this function on every frame. */
  update(elapsed: number): void
  dispose(): void
}

export interface PreviewOptions {
  /** Width divided by height of the preview panel. */
  aspect: number
  /** Zoom of the crop. `null` selects the zoom from the source size. */
  zoom: number | null
  /** Move the crop to the place of the action. */
  follow: boolean
  /** `pingpong` plays the frames forward, then backward. */
  loop: 'pingpong' | 'forward'
  ink: string
  background: string
}

export interface PlayHead {
  index: number
  direction: 1 | -1
}

/**
 * Returns the next frame.
 * The `pingpong` mode turns at each end, so the recording holds no jump.
 */
export function advance(head: PlayHead, count: number, pingPong: boolean): PlayHead {
  if (count <= 1) return { index: 0, direction: 1 }
  if (!pingPong) return { index: (head.index + 1) % count, direction: 1 }
  const step = head.index + head.direction
  if (step >= count || step < 0) {
    const direction: 1 | -1 = head.direction === 1 ? -1 : 1
    return { index: head.index + direction, direction }
  }
  return { index: step, direction: head.direction }
}

interface Focus {
  x: number
  y: number
}

const CENTER: Focus = { x: 0.5, y: 0.5 }
const TARGET_WIDTH = 512
const MOTION_WIDTH = 64
const MOTION_THRESHOLD = 26
const VIDEO_INTERVAL = 120

/** Memory limit for the frames of one preview. */
const FRAME_BUDGET = 48 * 1024 * 1024
const STORE_WIDTH = 420
const MIN_FRAMES = 8
const MAX_FRAMES = 240

/** Selects the zoom from the source size. A wide source needs a strong zoom. */
export function autoZoom(width: number, height: number): number {
  if (width === 0 || height === 0) return 1
  const aspect = width / height
  // An upright crop of a wide source already removes most of the width.
  // The zoom below therefore stays small.
  if (aspect < 1.2) return 1
  if (width >= 1200) return 1.9
  if (width >= 800) return 1.7
  if (width >= 500) return 1.5
  return 1.2
}

/**
 * Returns the part of the source that the crop shows.
 * The crop keeps the panel aspect and stays inside the source.
 */
export function cropRect(
  width: number,
  height: number,
  aspect: number,
  zoom: number,
  focus: Focus
): { x: number; y: number; width: number; height: number } {
  let cropHeight = height / Math.max(1, zoom)
  let cropWidth = cropHeight * aspect
  if (cropWidth > width) {
    cropWidth = width
    cropHeight = cropWidth / aspect
  }
  if (cropHeight > height) {
    cropHeight = height
    cropWidth = cropHeight * aspect
  }
  const x = Math.min(Math.max(focus.x * width - cropWidth / 2, 0), width - cropWidth)
  const y = Math.min(Math.max(focus.y * height - cropHeight / 2, 0), height - cropHeight)
  return { x, y, width: cropWidth, height: cropHeight }
}

/** Smooths a path of focus points. The crop then moves without steps. */
export function smoothPath(path: Focus[], window = 7): Focus[] {
  if (path.length === 0) return path
  const half = Math.floor(window / 2)
  return path.map((_point, index) => {
    let x = 0
    let y = 0
    let count = 0
    for (let offset = -half; offset <= half; offset += 1) {
      const item = path[Math.min(path.length - 1, Math.max(0, index + offset))]
      if (!item) continue
      x += item.x
      y += item.y
      count += 1
    }
    return count === 0 ? CENTER : { x: x / count, y: y / count }
  })
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

function canvasTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.anisotropy = 4
  return texture
}

/** Finds the place of the action. The finder compares one frame against the frame before it. */
class MotionFinder {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null
  private previous: Uint8ClampedArray | null = null
  private height = 1

  constructor(sourceWidth: number, sourceHeight: number) {
    this.height = Math.max(1, Math.round((MOTION_WIDTH * sourceHeight) / Math.max(1, sourceWidth)))
    this.canvas = makeCanvas(MOTION_WIDTH, this.height)
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })
  }

  /**
   * Returns the strongest point of change.
   * The pointer is a small object with a high contrast, so it wins against a slow change
   * of a large area. A blur removes the noise of the image compression.
   */
  find(source: CanvasImageSource): Focus | null {
    if (!this.ctx) return null
    this.ctx.drawImage(source, 0, 0, MOTION_WIDTH, this.height)
    const frame = this.ctx.getImageData(0, 0, MOTION_WIDTH, this.height).data
    const last = this.previous
    this.previous = new Uint8ClampedArray(frame)
    if (!last) return null

    const width = MOTION_WIDTH
    const height = this.height
    const delta = new Float32Array(width * height)
    let total = 0
    for (let pixel = 0; pixel < delta.length; pixel += 1) {
      const index = pixel * 4
      const value =
        Math.abs((frame[index] ?? 0) - (last[index] ?? 0)) +
        Math.abs((frame[index + 1] ?? 0) - (last[index + 1] ?? 0)) +
        Math.abs((frame[index + 2] ?? 0) - (last[index + 2] ?? 0))
      if (value < MOTION_THRESHOLD) continue
      delta[pixel] = value
      total += value
    }
    if (total === 0) return null

    const blur = new Float32Array(delta.length)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sum = 0
        for (let dy = -1; dy <= 1; dy += 1) {
          const row = Math.min(height - 1, Math.max(0, y + dy))
          for (let dx = -1; dx <= 1; dx += 1) {
            const column = Math.min(width - 1, Math.max(0, x + dx))
            sum += delta[row * width + column] ?? 0
          }
        }
        blur[y * width + x] = sum
      }
    }

    let peak = 0
    let peakIndex = 0
    for (let index = 0; index < blur.length; index += 1) {
      const value = blur[index] ?? 0
      if (value > peak) {
        peak = value
        peakIndex = index
      }
    }
    if (peak === 0) return null

    // Refine the peak with the weighted mean of the pixels around it.
    const peakX = peakIndex % width
    const peakY = Math.floor(peakIndex / width)
    let weight = 0
    let sumX = 0
    let sumY = 0
    for (let y = peakY - 3; y <= peakY + 3; y += 1) {
      if (y < 0 || y >= height) continue
      for (let x = peakX - 3; x <= peakX + 3; x += 1) {
        if (x < 0 || x >= width) continue
        const value = delta[y * width + x] ?? 0
        sumX += x * value
        sumY += y * value
        weight += value
      }
    }
    if (weight === 0) return { x: (peakX + 0.5) / width, y: (peakY + 0.5) / height }
    return { x: sumX / weight / width, y: sumY / weight / height }
  }
}

/** Draws a zoomed crop of the source into the texture canvas. */
class Framer {
  readonly canvas: HTMLCanvasElement
  readonly texture: CanvasTexture
  private ctx: CanvasRenderingContext2D | null

  constructor(aspect: number, background: string) {
    this.canvas = makeCanvas(TARGET_WIDTH, TARGET_WIDTH / Math.max(0.2, aspect))
    this.ctx = this.canvas.getContext('2d')
    if (this.ctx) {
      this.ctx.fillStyle = background
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }
    this.texture = canvasTexture(this.canvas)
  }

  get aspect(): number {
    return this.canvas.width / this.canvas.height
  }

  draw(source: CanvasImageSource, width: number, height: number, focus: Focus, zoom: number): void {
    if (!this.ctx || width === 0 || height === 0) return
    const rect = cropRect(width, height, this.aspect, zoom, focus)
    this.ctx.drawImage(
      source,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    )
    this.texture.needsUpdate = true
  }

  /** Draws a frame that already holds the crop. */
  drawFull(source: CanvasImageSource): void {
    if (!this.ctx) return
    this.ctx.drawImage(source, 0, 0, this.canvas.width, this.canvas.height)
    this.texture.needsUpdate = true
  }
}

interface DecodedFrame {
  bitmap: ImageBitmap
  /** Frame time in milliseconds. */
  duration: number
}

interface ImageDecoderLike {
  tracks: {
    ready: Promise<void>
    selectedTrack: { frameCount: number } | null
  }
  decode(options: { frameIndex: number }): Promise<{
    image: { duration: number | null; close(): void }
  }>
  close(): void
}

type ImageDecoderConstructor = new (init: { data: ArrayBuffer; type: string }) => ImageDecoderLike

function decoderClass(): ImageDecoderConstructor | null {
  const value = (globalThis as Record<string, unknown>).ImageDecoder
  return typeof value === 'function' ? (value as ImageDecoderConstructor) : null
}

/** Draws a neutral pattern when a skill has no preview file. */
export function placeholderPreview(options: PreviewOptions): PreviewSource {
  const framer = new Framer(options.aspect, options.background)
  const ctx = framer.canvas.getContext('2d')
  if (ctx) {
    const { width, height } = framer.canvas
    ctx.fillStyle = options.background
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = options.ink
    ctx.globalAlpha = 0.14
    ctx.lineWidth = 10
    for (let offset = -height; offset < width + height; offset += 48) {
      ctx.beginPath()
      ctx.moveTo(offset, 0)
      ctx.lineTo(offset + height, height)
      ctx.stroke()
    }
    framer.texture.needsUpdate = true
  }
  return {
    texture: framer.texture,
    update: () => undefined,
    dispose: () => framer.texture.dispose()
  }
}

function fromImage(url: string, options: PreviewOptions): PreviewSource {
  const framer = new Framer(options.aspect, options.background)
  const image = new Image()
  let ready = false
  image.onload = (): void => {
    ready = true
  }
  image.src = url
  return {
    texture: framer.texture,
    update: () => {
      if (!ready) return
      ready = false
      const zoom = options.zoom ?? 1
      framer.draw(image, image.naturalWidth, image.naturalHeight, CENTER, zoom)
    },
    dispose: () => framer.texture.dispose()
  }
}

function fromVideo(url: string, host: HTMLElement, options: PreviewOptions): PreviewSource {
  const framer = new Framer(options.aspect, options.background)
  const video = document.createElement('video')
  video.src = url
  video.loop = true
  video.muted = true
  video.autoplay = true
  video.playsInline = true
  host.appendChild(video)
  void video.play().catch(() => undefined)

  let finder: MotionFinder | null = null
  let focus: Focus = { ...CENTER }
  let nextFind = 0

  return {
    texture: framer.texture,
    update: (elapsed: number) => {
      const width = video.videoWidth
      const height = video.videoHeight
      if (width === 0 || height === 0) return
      const zoom = options.zoom ?? autoZoom(width, height)
      if (options.follow && zoom > 1) {
        if (!finder) finder = new MotionFinder(width, height)
        if (elapsed >= nextFind) {
          nextFind = elapsed + VIDEO_INTERVAL
          const found = finder.find(video)
          if (found) {
            focus = {
              x: focus.x + (found.x - focus.x) * 0.35,
              y: focus.y + (found.y - focus.y) * 0.35
            }
          }
        }
      }
      framer.draw(video, width, height, focus, zoom)
    },
    dispose: () => {
      video.pause()
      video.remove()
      framer.texture.dispose()
    }
  }
}

/** Selects the frames that fit in the memory budget. The list keeps the frame order. */
export function selectFrames(count: number, bytesPerFrame: number): number[] {
  const limit = Math.min(
    MAX_FRAMES,
    Math.max(MIN_FRAMES, Math.floor(FRAME_BUDGET / Math.max(1, bytesPerFrame)))
  )
  if (count <= limit) return Array.from({ length: count }, (_index, index) => index)
  const step = count / limit
  const picked: number[] = []
  for (let index = 0; index < limit; index += 1) picked.push(Math.floor(index * step))
  return picked
}

/**
 * Decodes an animated image and plays the frames.
 *
 * The first pass reads every frame and finds the place of the action.
 * The second pass stores the crop of each frame only.
 * A full frame of a screen recording is large, so the second pass keeps the memory low.
 *
 * The decoder path uses the platform image decoder. The other path draws an image element.
 */
function fromGif(url: string, host: HTMLElement, options: PreviewOptions): PreviewSource {
  const framer = new Framer(options.aspect, options.background)
  const frames: DecodedFrame[] = []
  let disposed = false
  let head: PlayHead = { index: 0, direction: 1 }
  let nextAt = 0
  let fallback: HTMLImageElement | null = null

  const useFallback = (): void => {
    const image = document.createElement('img')
    image.src = url
    image.decoding = 'async'
    host.appendChild(image)
    fallback = image
  }

  const load = async (): Promise<void> => {
    const Decoder = decoderClass()
    if (!Decoder) {
      useFallback()
      return
    }
    let decoder: ImageDecoderLike | null = null
    try {
      const response = await fetch(url)
      const data = await response.arrayBuffer()
      decoder = new Decoder({ data, type: 'image/gif' })
      await decoder.tracks.ready
      const count = decoder.tracks.selectedTrack?.frameCount ?? 0
      if (count === 0) {
        decoder.close()
        useFallback()
        return
      }

      // Pass one: sizes, times and the place of the action.
      const durations: number[] = []
      const raw: Focus[] = []
      let width = 0
      let height = 0
      let finder: MotionFinder | null = null
      let last: Focus = { ...CENTER }

      for (let index = 0; index < count && !disposed; index += 1) {
        const result = await decoder.decode({ frameIndex: index })
        // The frame time must be read before the frame closes.
        const duration = Math.max(20, (result.image.duration ?? 100000) / 1000)
        const bitmap = await createImageBitmap(result.image as unknown as ImageBitmapSource)
        result.image.close()
        if (width === 0) {
          width = bitmap.width
          height = bitmap.height
          finder = new MotionFinder(width, height)
        }
        durations.push(duration)
        const found = finder?.find(bitmap) ?? null
        if (found) last = found
        raw.push({ ...last })
        bitmap.close()
      }
      if (disposed || width === 0) return

      const zoom = options.zoom ?? autoZoom(width, height)
      const path =
        options.follow && zoom > 1 ? smoothPath(startPath(raw)) : raw.map(() => ({ ...CENTER }))

      // Pass two: store the crop of each frame.
      const sample = cropRect(width, height, framer.aspect, zoom, CENTER)
      const storeWidth = Math.min(STORE_WIDTH, Math.round(sample.width))
      const storeHeight = Math.max(1, Math.round(storeWidth / framer.aspect))
      const wanted = selectFrames(count, storeWidth * storeHeight * 4)
      const scratch = makeCanvas(storeWidth, storeHeight)
      const ctx = scratch.getContext('2d')
      if (!ctx) return

      for (let position = 0; position < wanted.length && !disposed; position += 1) {
        const index = wanted[position] ?? 0
        const nextIndex = wanted[position + 1] ?? count
        const result = await decoder.decode({ frameIndex: index })
        const bitmap = await createImageBitmap(result.image as unknown as ImageBitmapSource)
        result.image.close()
        const rect = cropRect(width, height, framer.aspect, zoom, path[index] ?? CENTER)
        ctx.drawImage(
          bitmap,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          0,
          0,
          storeWidth,
          storeHeight
        )
        bitmap.close()
        let duration = 0
        for (let step = index; step < nextIndex; step += 1) duration += durations[step] ?? 0
        frames.push({
          bitmap: await createImageBitmap(scratch),
          duration: Math.max(20, duration)
        })
      }
    } catch {
      useFallback()
    } finally {
      decoder?.close()
    }
  }

  void load()

  return {
    texture: framer.texture,
    update: (elapsed: number) => {
      if (fallback) {
        if (fallback.naturalWidth === 0) return
        framer.draw(
          fallback,
          fallback.naturalWidth,
          fallback.naturalHeight,
          CENTER,
          options.zoom ?? autoZoom(fallback.naturalWidth, fallback.naturalHeight)
        )
        return
      }
      if (frames.length === 0) return
      if (elapsed < nextAt) return
      const frame = frames[head.index]
      if (!frame) return
      framer.drawFull(frame.bitmap)
      nextAt = elapsed + frame.duration
      head = advance(head, frames.length, options.loop === 'pingpong')
    },
    dispose: () => {
      disposed = true
      for (const frame of frames) frame.bitmap.close()
      frames.length = 0
      fallback?.remove()
      framer.texture.dispose()
    }
  }
}

/** Fills the start of a path. The first frames of a recording hold no motion. */
export function startPath(path: Focus[]): Focus[] {
  const start = path.find((point) => point.x !== CENTER.x || point.y !== CENTER.y)
  if (!start) return path
  return path.map((point) =>
    point.x === CENTER.x && point.y === CENTER.y ? { ...start } : { ...point }
  )
}

export function createPreview(
  preview: SkillPreview,
  host: HTMLElement,
  options: PreviewOptions
): PreviewSource {
  const merged: PreviewOptions = {
    ...options,
    zoom: preview.zoom ?? options.zoom,
    follow: preview.follow && options.follow,
    loop: preview.loop
  }
  if (!preview.url || preview.kind === 'none') return placeholderPreview(merged)
  if (preview.kind === 'gif') return fromGif(preview.url, host, merged)
  if (preview.kind === 'video') return fromVideo(preview.url, host, merged)
  return fromImage(preview.url, merged)
}
