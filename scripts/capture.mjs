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

/**
 * Paper rules. The text sits on the rules, so the spacing matches the line height of the text.
 * The renderer ignores `stroke-opacity`, so the group holds the opacity.
 */
const RULE_STEP = 46
const RULE_START = 26

function ogDecoration(width, height) {
  const count = Math.ceil((height - RULE_START) / RULE_STEP)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <g stroke="#16181d" stroke-width="1.5" opacity="0.05">
    ${Array.from(
      { length: count },
      (_item, index) =>
        `<line x1="0" y1="${index * RULE_STEP + RULE_START}" x2="${width}" y2="${index * RULE_STEP + RULE_START}"/>`
    ).join('')}
  </g>
  <circle cx="1120" cy="86" r="150" fill="#16a47e" opacity="0.08"/>
  <circle cx="96" cy="596" r="140" fill="#4c6fff" opacity="0.08"/>
  <circle cx="640" cy="640" r="110" fill="#e8453c" opacity="0.06"/>
</svg>`
}

/**
 * Platform marks. The files hold the official mark of each platform.
 * Each mark belongs to its owner.
 */
const PLATFORMS = [
  { file: 'apple.webp', box: 120 },
  { file: 'windows.png', box: 114 },
  { file: 'linux.png', box: 124 }
]

const MARK_LEFT = 66
const MARK_BOTTOM = 578
const MARK_PITCH = 168

function ogText(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif">
    <text x="64" y="164" font-size="150" font-weight="700" fill="#16181d">Tasker</text>
    <text x="66" y="302" font-size="33" font-weight="500" fill="#4a5058">Rolodex and cassette interface</text>
    <text x="66" y="348" font-size="33" font-weight="500" fill="#4a5058">for managing your RPA</text>
  </g>
</svg>`
}

/** Puts the platform marks in a row at the lower left corner. */
async function addPlatformMarks(target) {
  for (let index = 0; index < PLATFORMS.length; index += 1) {
    const platform = PLATFORMS[index]
    const fitted = join(scratch, `mark-${index}.png`)
    await magick([
      join(root, 'assets', 'logos', platform.file),
      '-resize',
      `${platform.box}x${platform.box}`,
      fitted
    ])
    const size = await run('magick', ['identify', '-format', '%w %h', fitted])
    const [markWidth, markHeight] = size.stdout.trim().split(' ').map(Number)
    const centerX = MARK_LEFT + platform.box / 2 + index * MARK_PITCH
    const x = Math.round(centerX - markWidth / 2)
    const y = Math.round(MARK_BOTTOM - markHeight)
    await magick([
      target,
      fitted,
      '-gravity',
      'northwest',
      '-geometry',
      `+${x}+${y}`,
      '-composite',
      target
    ])
  }
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
  await addPlatformMarks(output)
  console.log('[og] assets/og-image.png')

  await magick([output, '-resize', '600x315', join(root, 'assets', 'og-image-small.png')])
  await rm(scratch, { recursive: true, force: true })
}

await capture()
await buildOg()
await run('magick', ['identify', join(root, 'assets', 'og-image.png')]).then((result) =>
  console.log(result.stdout.trim())
)
