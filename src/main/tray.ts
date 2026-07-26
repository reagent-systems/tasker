import { app, Menu, nativeImage, shell, Tray, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { configPath } from './config.js'

const ICON = 'trayTemplate.png'

export function createTray(window: BrowserWindow, onRescan: () => void): Tray {
  const file = join(import.meta.dirname, '../renderer/icons', ICON)
  const image = nativeImage.createFromPath(file)
  image.setTemplateImage(true)
  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)

  const menu = Menu.buildFromTemplate([
    { label: 'Show Tasker', click: () => window.show() },
    { label: 'Hide Tasker', click: () => window.hide() },
    { type: 'separator' },
    { label: 'Rescan skills', click: onRescan },
    { label: 'Open config file', click: () => void shell.openPath(configPath()) },
    { type: 'separator' },
    { label: `Version ${app.getVersion()}`, enabled: false },
    { label: 'Quit', role: 'quit' }
  ])
  tray.setToolTip('Tasker')
  tray.setContextMenu(menu)
  tray.on('click', () => (window.isVisible() ? window.hide() : window.show()))
  return tray
}
