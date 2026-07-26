import { globalShortcut } from 'electron'
import type { Config, TransportAction } from '@shared/types'
import { TRANSPORT_ORDER } from '@shared/types'

export interface ShortcutHandlers {
  onToggle: () => void
  onTransport: (action: TransportAction) => void
}

/** Registers the global accelerators. Returns the accelerators that failed. */
export function registerShortcuts(config: Config, handlers: ShortcutHandlers): string[] {
  globalShortcut.unregisterAll()
  const failed: string[] = []

  if (config.shortcut) {
    if (!safeRegister(config.shortcut, handlers.onToggle)) failed.push(config.shortcut)
  }
  for (const action of TRANSPORT_ORDER) {
    const accelerator = config.transportShortcuts[action] ?? ''
    if (!accelerator) continue
    if (!safeRegister(accelerator, () => handlers.onTransport(action as TransportAction))) {
      failed.push(accelerator)
    }
  }
  return failed
}

function safeRegister(accelerator: string, callback: () => void): boolean {
  try {
    return globalShortcut.register(accelerator, callback)
  } catch (error) {
    console.error('[shortcut] register failed:', accelerator, error)
    return false
  }
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll()
}
