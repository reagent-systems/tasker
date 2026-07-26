import { nativeTheme, type BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RunStatus } from '@shared/types'
import { IPC } from '@shared/types'

/**
 * Screenshot mode. The script `scripts/capture.mjs` starts the application with `TASKER_CAPTURE=1`.
 * The mode drives the real window with real input events and writes PNG files.
 */

const RECORDING: RunStatus = {
  state: 'recording',
  action: 'record',
  skillId: null,
  message: 'record',
  startedAt: Date.now()
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function shot(window: BrowserWindow, dir: string, name: string): Promise<void> {
  const image = await window.webContents.capturePage()
  await writeFile(join(dir, `${name}.png`), image.toPNG())
  console.log(`[capture] ${name}.png`)
}

function key(window: BrowserWindow, keyCode: string): void {
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode })
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode })
}

export async function runCapture(window: BrowserWindow): Promise<void> {
  const dir = process.env.TASKER_CAPTURE_DIR ?? 'assets/screenshots'
  await mkdir(dir, { recursive: true })

  // The screenshots use twice the default size. The layout follows the aspect, so the design holds.
  const bounds = window.getBounds()
  window.setBounds({ ...bounds, width: 920, height: 640 })

  nativeTheme.themeSource = 'light'
  await wait(1800)
  await shot(window, dir, 'widget-light')

  key(window, 'Right')
  await wait(160)
  await shot(window, dir, 'widget-turn')

  await wait(900)
  window.webContents.send(IPC.statusChanged, RECORDING)
  await wait(700)
  await shot(window, dir, 'widget-record')

  window.webContents.send(IPC.statusChanged, { ...RECORDING, state: 'idle', action: null })
  nativeTheme.themeSource = 'dark'
  await wait(1200)
  key(window, 'Right')
  await wait(900)
  await shot(window, dir, 'widget-dark')

  nativeTheme.themeSource = 'light'
  await window.webContents.executeJavaScript("document.body.classList.remove('capture')")
  await wait(1200)
  await shot(window, dir, 'widget-plain')
}
