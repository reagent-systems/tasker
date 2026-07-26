/**
 * Takes the README screenshots and builds the OG image.
 * The script starts the built application with the demo skill library.
 */
import { execFile, spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import electron from 'electron'
import { magick, svgToPng } from './lib/render.mjs'

const run = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const shots = join(root, 'assets', 'screenshots')
const demo = join(root, 'assets', 'demo-skills')
const scratch = join(root, 'assets', '.work')

async function capture() {
  await mkdir(shots, { recursive: true })
  await new Promise((resolve, reject) => {
    const child = spawn(electron, [root], {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        TASKER_CAPTURE: '1',
        TASKER_CAPTURE_DIR: shots,
        TASKER_SKILL_ROOTS: demo,
        ELECTRON_DISABLE_SECURITY_WARNINGS: '1'
      }
    })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`electron ${code}`))))
    child.on('error', reject)
  })
}

function ogDecoration(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <g stroke="#16181d" stroke-opacity="0.028" stroke-width="1.5">
    ${Array.from({ length: 18 }, (_, i) => `<line x1="0" y1="${i * 36 + 18}" x2="${width}" y2="${i * 36 + 18}"/>`).join('')}
  </g>
  <circle cx="1120" cy="86" r="150" fill="#16a47e" opacity="0.08"/>
  <circle cx="96" cy="596" r="140" fill="#4c6fff" opacity="0.08"/>
  <circle cx="640" cy="640" r="110" fill="#e8453c" opacity="0.06"/>
</svg>`
}

function ogText(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif">
    <text x="72" y="118" font-size="76" font-weight="700" fill="#16181d">Tasker</text>
    <text x="72" y="164" font-size="29" font-weight="500" fill="#4a5058">Rolodex and transport keys for Claude skills.</text>
    <g transform="translate(72 202)">
      <rect x="0" y="0" width="132" height="40" rx="20" fill="#16181d" opacity="0.08"/>
      <text x="20" y="27" font-size="20" font-weight="600" fill="#2b2f36">macOS</text>
      <rect x="146" y="0" width="150" height="40" rx="20" fill="#16181d" opacity="0.08"/>
      <text x="166" y="27" font-size="20" font-weight="600" fill="#2b2f36">Windows</text>
      <rect x="310" y="0" width="118" height="40" rx="20" fill="#16181d" opacity="0.08"/>
      <text x="330" y="27" font-size="20" font-weight="600" fill="#2b2f36">Linux</text>
    </g>
  </g>
</svg>`
}

async function buildOg() {
  const width = 1200
  const height = 630
  await mkdir(scratch, { recursive: true })
  const gradient = join(scratch, 'gradient.png')
  const deco = join(scratch, 'deco.png')
  const back = join(scratch, 'back.png')
  const text = join(scratch, 'text.png')
  const widget = join(scratch, 'widget.png')
  const stage = join(scratch, 'stage.png')
  const output = join(root, 'assets', 'og-image.png')

  await magick(['-size', `${width}x${height}`, 'gradient:#fdfcfa-#ded8cc', gradient])
  await svgToPng(ogDecoration(width, height), deco, width, height)
  await magick([gradient, deco, '-composite', back])
  await svgToPng(ogText(width, height), text, width, height)

  // The widget keeps a soft drop shadow.
  await magick([
    join(shots, 'widget-plain.png'),
    '-trim',
    '+repage',
    '-resize',
    '560x',
    '-bordercolor',
    'none',
    '-border',
    '20',
    '(',
    '+clone',
    '-background',
    'black',
    '-shadow',
    '55x12+0+8',
    ')',
    '+swap',
    '-background',
    'none',
    '-layers',
    'merge',
    '+repage',
    widget
  ])

  // The widget sits low and right. The text block keeps the upper left corner free.
  await magick([back, widget, '-gravity', 'southeast', '-geometry', '+6-8', '-composite', stage])
  await magick([stage, text, '-gravity', 'northwest', '-geometry', '+0+0', '-composite', output])
  console.log('[og] assets/og-image.png')

  await magick([output, '-resize', '600x315', join(root, 'assets', 'og-image-small.png')])
  await rm(scratch, { recursive: true, force: true })
}

await capture()
await buildOg()
await run('magick', ['identify', join(root, 'assets', 'og-image.png')]).then((result) =>
  console.log(result.stdout.trim())
)
