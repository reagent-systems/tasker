/** Builds the application icons and the tray icon from one vector source. */
import { execFile } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { magick, svgToPng } from './lib/render.mjs'

const run = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = join(root, 'build')
const linuxDir = join(buildDir, 'icons')
const trayDir = join(root, 'src', 'renderer', 'public', 'icons')

const INK = '#16181d'

function appIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#16181d" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect x="64" y="64" width="896" height="896" rx="212" fill="${INK}"/>
  <rect x="92" y="92" width="840" height="840" rx="190" fill="#faf8f4"/>
  <g filter="url(#soft)">
    <rect x="252" y="168" width="520" height="34" rx="17" fill="#ffffff" stroke="${INK}" stroke-width="14"/>
    <rect x="220" y="196" width="584" height="38" rx="19" fill="#ffffff" stroke="${INK}" stroke-width="15"/>
    <rect x="188" y="228" width="648" height="230" rx="42" fill="#ffffff" stroke="${INK}" stroke-width="17"/>
  </g>
  <rect x="240" y="300" width="368" height="32" rx="16" fill="${INK}"/>
  <rect x="240" y="364" width="236" height="24" rx="12" fill="#a6abb5"/>
  <g stroke="${INK}" stroke-width="17" fill="#ffffff">
    <rect x="178" y="536" width="152" height="176" rx="42"/>
    <rect x="350" y="536" width="152" height="176" rx="42"/>
    <rect x="522" y="536" width="152" height="176" rx="42"/>
    <rect x="694" y="536" width="152" height="176" rx="42"/>
  </g>
  <path d="M206 624 L276 580 L276 606 L302 606 L302 642 L276 642 L276 668 Z" fill="#4c6fff"/>
  <rect x="392" y="588" width="68" height="72" rx="18" fill="#2b2f36"/>
  <circle cx="598" cy="624" r="40" fill="#e8453c"/>
  <path d="M818 624 L748 580 L748 606 L722 606 L722 642 L748 642 L748 668 Z" fill="#16a47e"/>
  <rect x="188" y="776" width="648" height="24" rx="12" fill="${INK}" opacity="0.1"/>
</svg>`
}

function trayIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect x="36" y="96" width="440" height="320" rx="64" fill="none" stroke="#000000" stroke-width="34"/>
  <circle cx="182" cy="256" r="52" fill="none" stroke="#000000" stroke-width="34"/>
  <circle cx="330" cy="256" r="52" fill="none" stroke="#000000" stroke-width="34"/>
  <rect x="182" y="238" width="148" height="36" fill="#000000"/>
</svg>`
}

const LINUX_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
const ICONSET = [
  [16, '16x16'],
  [32, '16x16@2x'],
  [32, '32x32'],
  [64, '32x32@2x'],
  [128, '128x128'],
  [256, '128x128@2x'],
  [256, '256x256'],
  [512, '256x256@2x'],
  [512, '512x512'],
  [1024, '512x512@2x']
]

async function main() {
  await mkdir(buildDir, { recursive: true })
  await mkdir(linuxDir, { recursive: true })
  await mkdir(trayDir, { recursive: true })

  const master = join(buildDir, 'icon.png')
  await svgToPng(appIcon(), master, 1024, 1024)

  for (const size of LINUX_SIZES) {
    await magick([master, '-resize', `${size}x${size}`, join(linuxDir, `${size}x${size}.png`)])
  }
  await magick([
    master,
    '-define',
    'icon:auto-resize=256,128,64,48,32,16',
    join(buildDir, 'icon.ico')
  ])

  if (process.platform === 'darwin') {
    const iconset = join(buildDir, 'icon.iconset')
    await rm(iconset, { recursive: true, force: true })
    await mkdir(iconset, { recursive: true })
    for (const [size, name] of ICONSET) {
      await magick([master, '-resize', `${size}x${size}`, join(iconset, `icon_${name}.png`)])
    }
    await run('iconutil', ['-c', 'icns', iconset, '-o', join(buildDir, 'icon.icns')])
    await rm(iconset, { recursive: true, force: true })
  } else {
    console.warn('[icons] icns needs macOS')
  }

  const traySource = join(trayDir, 'tray-source.png')
  await svgToPng(trayIcon(), traySource, 512, 512)
  await magick([traySource, '-resize', '18x18', join(trayDir, 'trayTemplate.png')])
  await magick([traySource, '-resize', '36x36', join(trayDir, 'trayTemplate@2x.png')])
  await rm(traySource, { force: true })

  await writeFile(
    join(buildDir, 'README.md'),
    '# build\n\nThe files in this folder come from `npm run assets:icons`.\nDo not edit them by hand.\n',
    'utf8'
  )
  console.log('[icons] done')
}

await main()
