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
  <g stroke="#16181d" stroke-opacity="0.014" stroke-width="1.5">
    ${Array.from({ length: 18 }, (_, i) => `<line x1="0" y1="${i * 36 + 18}" x2="${width}" y2="${i * 36 + 18}"/>`).join('')}
  </g>
  <circle cx="1120" cy="86" r="150" fill="#16a47e" opacity="0.08"/>
  <circle cx="96" cy="596" r="140" fill="#4c6fff" opacity="0.08"/>
  <circle cx="640" cy="640" r="110" fill="#e8453c" opacity="0.06"/>
</svg>`
}

/** Platform marks. Each mark is a simple silhouette that reads at a small size. */
const PLATFORM_ICONS = {
  apple: `<path d="M9.6 -4.2c-1.9 0-3 1.05-4.1 1.05C4.3 -3.15 3.1 -4.3 1.4 -4.3c-3.1 0-6.2 2.7-6.2 7.6 0 4.6 3.3 9.2 5.4 9.2 1.2 0 2.1-1 3.7-1 1.6 0 2.3 1 3.7 1 2.2 0 4.4-3.4 5.1-6-2.6-1-3.2-4.7-0.6-6.4-1-1.5-2.4-2.3-2.9-2.3z"/>
     <path d="M6.9 -6.1c1.4-0.3 2.7-1.9 2.6-3.6-1.6 0.1-3.2 1.5-3.1 3.3 0 0.2 0.2 0.4 0.5 0.3z"/>`,
  windows: `<path d="M-12 -10.5 L-1.4 -12 L-1.4 -1.4 L-12 -1.4 Z"/>
     <path d="M0.6 -12.3 L12 -14 L12 -1.4 L0.6 -1.4 Z"/>
     <path d="M-12 0.6 L-1.4 0.6 L-1.4 11.2 L-12 9.7 Z"/>
     <path d="M0.6 0.6 L12 0.6 L12 13.2 L0.6 11.5 Z"/>`,
  linux: `<ellipse cx="0" cy="4.4" rx="8.4" ry="9.2"/>
     <ellipse cx="0" cy="-5" rx="6" ry="6.6"/>
     <path d="M-3.4 12.4 L-8.6 15.4 L-3 15.4 Z"/>
     <path d="M3.4 12.4 L8.6 15.4 L3 15.4 Z"/>
     <circle cx="-2.3" cy="-5.6" r="2.1" fill="#ffffff"/>
     <circle cx="2.3" cy="-5.6" r="2.1" fill="#ffffff"/>
     <circle cx="-2.1" cy="-5.2" r="1" fill="#16181d"/>
     <circle cx="2.1" cy="-5.2" r="1" fill="#16181d"/>
     <path d="M0 -2.6 L-2.8 -0.3 L0 1.6 L2.8 -0.3 Z" fill="#f2a33c"/>`
}

const PLATFORMS = [
  { label: 'macOS', icon: 'apple', width: 152 },
  { label: 'Windows', icon: 'windows', width: 174 },
  { label: 'Linux', icon: 'linux', width: 138 }
]

function platformRow(x, y) {
  const height = 60
  let offset = 0
  const pills = PLATFORMS.map((platform) => {
    const left = x + offset
    offset += platform.width + 14
    return `<g>
      <rect x="${left}" y="${y}" width="${platform.width}" height="${height}" rx="${height / 2}" fill="#16181d" opacity="0.09"/>
      <g transform="translate(${left + 32} ${y + height / 2}) scale(1.3)" fill="#2b2f36">${PLATFORM_ICONS[platform.icon]}</g>
      <text x="${left + 56}" y="${y + 39}" font-size="25" font-weight="600" fill="#2b2f36">${platform.label}</text>
    </g>`
  })
  return pills.join('\n    ')
}

function ogText(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif">
    <text x="64" y="172" font-size="150" font-weight="700" fill="#16181d">Tasker</text>
    <text x="66" y="302" font-size="33" font-weight="500" fill="#4a5058">Rolodex and cassette interface</text>
    <text x="66" y="348" font-size="33" font-weight="500" fill="#4a5058">for managing your RPA</text>
    ${platformRow(64, 506)}
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
