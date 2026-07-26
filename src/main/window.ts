import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import type { Config } from '@shared/types'
import { loadConfig, updateConfig } from './config.js'

const RENDERER_DEV = process.env.ELECTRON_RENDERER_URL

export function createWidgetWindow(config: Config): BrowserWindow {
  const window = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    minWidth: 380,
    minHeight: 260,
    maxWidth: 900,
    maxHeight: 640,
    x: config.window.x ?? undefined,
    y: config.window.y ?? undefined,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    roundedCorners: true,
    titleBarStyle: process.platform === 'darwin' ? 'customButtonsOnHover' : 'default',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false
    }
  })

  window.setAlwaysOnTop(config.window.alwaysOnTop, 'floating')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  window.setOpacity(config.window.opacity)
  if (config.window.x === null || config.window.y === null) centerOnCursor(window)

  window.on('moved', () => persistBounds(window))
  window.on('resized', () => persistBounds(window))
  window.on('blur', () => {
    if (config.window.hideOnBlur) window.hide()
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  const search = process.env.TASKER_CAPTURE === '1' ? 'capture=1' : undefined
  if (RENDERER_DEV) {
    void window.loadURL(search ? `${RENDERER_DEV}?${search}` : RENDERER_DEV)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'), { search })
  }

  return window
}

function persistBounds(window: BrowserWindow): void {
  const bounds = window.getBounds()
  const current = loadConfig()
  updateConfig({
    window: {
      ...current.window,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    }
  })
}

function centerOnCursor(window: BrowserWindow): void {
  const point = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(point)
  const bounds = window.getBounds()
  const x = Math.round(display.workArea.x + (display.workArea.width - bounds.width) / 2)
  const y = Math.round(display.workArea.y + (display.workArea.height - bounds.height) * 0.68)
  window.setPosition(x, y, false)
}

export function toggleWindow(window: BrowserWindow): void {
  if (window.isVisible() && window.isFocused()) {
    window.hide()
    return
  }
  showWindow(window)
}

export function showWindow(window: BrowserWindow): void {
  const point = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(point)
  const bounds = window.getBounds()
  const inside =
    bounds.x >= display.workArea.x - bounds.width &&
    bounds.x <= display.workArea.x + display.workArea.width
  if (!inside) centerOnCursor(window)
  window.show()
  window.focus()
}
