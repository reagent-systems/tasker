import {
  CanvasTexture,
  LinearFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  VideoTexture
} from 'three'
import type { SkillPreview } from '@shared/types'

export interface PreviewSource {
  texture: Texture
  /** The scene calls this value on every frame. */
  update(elapsed: number): void
  dispose(): void
}

interface DecodedFrame {
  bitmap: ImageBitmap
  /** Frame duration in milliseconds. */
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

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function canvasTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  return texture
}

/** Draws a neutral pattern when a skill has no preview file. */
export function placeholderPreview(ink: string, background: string): PreviewSource {
  const canvas = makeCanvas(512, 512)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, 512, 512)
    ctx.strokeStyle = ink
    ctx.globalAlpha = 0.14
    ctx.lineWidth = 10
    for (let offset = -512; offset < 1024; offset += 48) {
      ctx.beginPath()
      ctx.moveTo(offset, 0)
      ctx.lineTo(offset + 512, 512)
      ctx.stroke()
    }
  }
  const texture = canvasTexture(canvas)
  return {
    texture,
    update: () => undefined,
    dispose: () => texture.dispose()
  }
}

function fromImage(url: string): PreviewSource {
  const texture = new TextureLoader().load(url)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  return { texture, update: () => undefined, dispose: () => texture.dispose() }
}

function fromVideo(url: string, host: HTMLElement): PreviewSource {
  const video = document.createElement('video')
  video.src = url
  video.loop = true
  video.muted = true
  video.autoplay = true
  video.playsInline = true
  host.appendChild(video)
  void video.play().catch(() => undefined)
  const texture = new VideoTexture(video)
  texture.colorSpace = SRGBColorSpace
  return {
    texture,
    update: () => undefined,
    dispose: () => {
      video.pause()
      video.remove()
      texture.dispose()
    }
  }
}

/**
 * Decodes an animated image and plays the frames on a canvas texture.
 * The decoder path uses the platform image decoder. The fallback path draws an image element.
 */
function fromGif(url: string, host: HTMLElement): PreviewSource {
  const canvas = makeCanvas(512, 384)
  const ctx = canvas.getContext('2d')
  const texture = canvasTexture(canvas)
  const frames: DecodedFrame[] = []
  let disposed = false
  let cursor = 0
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
    try {
      const response = await fetch(url)
      const data = await response.arrayBuffer()
      const decoder = new Decoder({ data, type: 'image/gif' })
      await decoder.tracks.ready
      const count = decoder.tracks.selectedTrack?.frameCount ?? 0
      if (count === 0) {
        decoder.close()
        useFallback()
        return
      }
      for (let index = 0; index < count && !disposed; index += 1) {
        const result = await decoder.decode({ frameIndex: index })
        const bitmap = await createImageBitmap(result.image as unknown as ImageBitmapSource)
        frames.push({ bitmap, duration: Math.max(20, (result.image.duration ?? 100000) / 1000) })
        result.image.close()
      }
      decoder.close()
      if (frames.length > 0) {
        canvas.width = frames[0]?.bitmap.width ?? 512
        canvas.height = frames[0]?.bitmap.height ?? 384
      }
    } catch {
      useFallback()
    }
  }

  void load()

  return {
    texture,
    update: (elapsed: number) => {
      if (!ctx) return
      if (fallback) {
        if (fallback.naturalWidth === 0) return
        canvas.width = fallback.naturalWidth
        canvas.height = fallback.naturalHeight
        ctx.drawImage(fallback, 0, 0)
        texture.needsUpdate = true
        return
      }
      if (frames.length === 0) return
      if (elapsed < nextAt) return
      const frame = frames[cursor % frames.length]
      if (!frame) return
      ctx.drawImage(frame.bitmap, 0, 0, canvas.width, canvas.height)
      texture.needsUpdate = true
      nextAt = elapsed + frame.duration
      cursor += 1
    },
    dispose: () => {
      disposed = true
      for (const frame of frames) frame.bitmap.close()
      frames.length = 0
      fallback?.remove()
      texture.dispose()
    }
  }
}

export function createPreview(
  preview: SkillPreview,
  host: HTMLElement,
  ink: string,
  background: string
): PreviewSource {
  if (!preview.url || preview.kind === 'none') return placeholderPreview(ink, background)
  if (preview.kind === 'gif') return fromGif(preview.url, host)
  if (preview.kind === 'video') return fromVideo(preview.url, host)
  return fromImage(preview.url)
}
