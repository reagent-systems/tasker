import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** Runs ImageMagick. The scripts need the `magick` binary. */
export async function magick(args) {
  return run('magick', args, { maxBuffer: 1024 * 1024 * 64 })
}

export async function svgToPng(svg, output, width, height) {
  const dir = await mkdtemp(join(tmpdir(), 'tasker-svg-'))
  const file = join(dir, 'frame.svg')
  await writeFile(file, svg, 'utf8')
  // The background setting must come before the input file. The delegate reads it at raster time.
  await magick(['-background', 'none', file, '-resize', `${width}x${height}`, output])
  await rm(dir, { recursive: true, force: true })
}

/** Converts SVG frames into one animated GIF. */
export async function svgFramesToGif(frames, output, options = {}) {
  const delay = options.delay ?? 12
  const width = options.width ?? 480
  const height = options.height ?? 360
  const dir = await mkdtemp(join(tmpdir(), 'tasker-gif-'))
  const files = []
  for (let index = 0; index < frames.length; index += 1) {
    const svgFile = join(dir, `f${String(index).padStart(3, '0')}.svg`)
    const pngFile = join(dir, `f${String(index).padStart(3, '0')}.png`)
    await writeFile(svgFile, frames[index], 'utf8')
    await magick(['-background', 'none', svgFile, '-resize', `${width}x${height}!`, pngFile])
    files.push(pngFile)
  }
  await magick([
    '-delay',
    String(delay),
    '-loop',
    '0',
    ...files,
    '-layers',
    'optimize',
    '-colors',
    '128',
    output
  ])
  await rm(dir, { recursive: true, force: true })
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/** Smooth step between 0 and 1. */
export function ease(t) {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}
