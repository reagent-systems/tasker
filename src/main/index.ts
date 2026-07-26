import { app, BrowserWindow, ipcMain, shell, type Tray } from 'electron'
import { delimiter } from 'node:path'
import type { AppState, Config, RunRequest, RunResult, Skill } from '@shared/types'
import { IPC } from '@shared/types'
import { loadConfig, updateConfig, configPath } from './config.js'
import { Journal } from './journal.js'
import { registerAssetScheme, serveAssets } from './protocol.js'
import { Runner } from './runner.js'
import { registerShortcuts, unregisterShortcuts } from './shortcuts.js'
import { scanSkills } from './skills/scan.js'
import { SkillWatcher } from './skills/watch.js'
import { createTray } from './tray.js'
import { createWidgetWindow, showWindow, toggleWindow } from './window.js'

registerAssetScheme()

let window: BrowserWindow | null = null
let tray: Tray | null = null
let skills: Skill[] = []
let journal: Journal | null = null
let runner: Runner | null = null
let watcher: SkillWatcher | null = null

/** Environment override. The capture script and the demo mode use this variable. */
function skillRoots(config: Config): string[] {
  const override = process.env.TASKER_SKILL_ROOTS
  if (override) return override.split(delimiter).filter((item) => item !== '')
  return config.skillRoots
}

function send(channel: string, payload: unknown): void {
  window?.webContents.send(channel, payload)
}

async function rescan(): Promise<void> {
  const config = loadConfig()
  skills = await scanSkills(skillRoots(config))
  send(IPC.skillsChanged, skills)
}

function currentState(): AppState {
  const config = loadConfig()
  return {
    skills,
    status: runner?.getStatus() ?? {
      state: 'idle',
      action: null,
      skillId: null,
      message: 'idle',
      startedAt: null
    },
    journal: journal?.list() ?? [],
    config,
    platform: process.platform,
    version: app.getVersion()
  }
}

function runAction(request: RunRequest): RunResult {
  if (!runner) return { ok: false, message: 'runner is not ready', entryId: null }
  const config = loadConfig()
  const skill = skills.find((item) => item.id === request.skillId) ?? null
  return runner.run(request.action, skill, config)
}

function applyShortcuts(config: Config): void {
  const failed = registerShortcuts(config, {
    onToggle: () => {
      if (window) toggleWindow(window)
    },
    onTransport: (action) => {
      send(IPC.transportRequested, action)
    }
  })
  if (failed.length > 0) console.warn('[shortcut] not registered:', failed.join(', '))
  else console.log('[shortcut] registered:', config.shortcut)
}

function wireIpc(): void {
  ipcMain.handle(IPC.getState, () => currentState())
  ipcMain.handle(IPC.run, (_event, request: RunRequest) => runAction(request))
  ipcMain.handle(IPC.rescan, async () => {
    await rescan()
    return skills
  })
  ipcMain.handle(IPC.setConfig, (_event, patch: Partial<Config>) => {
    const next = updateConfig(patch)
    applyShortcuts(next)
    if (window) {
      window.setAlwaysOnTop(next.window.alwaysOnTop, 'floating')
      window.setOpacity(next.window.opacity)
    }
    watcher?.start(skillRoots(next))
    void rescan()
    send(IPC.configChanged, next)
    return next
  })
  ipcMain.handle(IPC.openSkillFolder, (_event, id: string) => {
    const skill = skills.find((item) => item.id === id)
    if (skill) void shell.openPath(skill.dir)
    return skill !== undefined
  })
  ipcMain.handle(IPC.openConfigFile, () => void shell.openPath(configPath()))
  ipcMain.handle(IPC.hide, () => window?.hide())
  ipcMain.handle(IPC.quit, () => app.quit())
  ipcMain.handle(IPC.resize, (_event, size: { width: number; height: number }) => {
    if (!window) return
    const bounds = window.getBounds()
    window.setBounds({ ...bounds, width: Math.round(size.width), height: Math.round(size.height) })
  })
}

async function start(): Promise<void> {
  const config = loadConfig()
  journal = new Journal()
  runner = new Runner(
    journal,
    (status) => send(IPC.statusChanged, status),
    () => send(IPC.journalChanged, journal?.list() ?? [])
  )

  serveAssets(() => skillRoots(loadConfig()))
  window = createWidgetWindow(config)
  wireIpc()

  watcher = new SkillWatcher(() => void rescan())
  watcher.start(skillRoots(config))
  await rescan()

  window.once('ready-to-show', () => {
    if (process.env.TASKER_START_HIDDEN === '1') return
    showWindow(window as BrowserWindow)
  })

  tray = createTray(window, () => void rescan())
  applyShortcuts(config)

  if (process.env.TASKER_CAPTURE === '1') {
    const { runCapture } = await import('./capture.js')
    await runCapture(window)
    app.quit()
    return
  }

  if (config.launchAtLogin && app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (window) showWindow(window)
  })

  if (process.platform === 'darwin') app.dock?.hide()

  app
    .whenReady()
    .then(start)
    .catch((error) => {
      console.error('[main] start failed:', error)
      app.quit()
    })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('activate', () => {
    if (window) showWindow(window)
  })

  app.on('will-quit', () => {
    unregisterShortcuts()
    watcher?.stop()
    tray?.destroy()
  })
}
