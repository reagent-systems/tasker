import type { CommandSpec } from '@shared/types'
import type { Adapter } from './index.js'

/**
 * Sends a key sequence to the Claude desktop application.
 * The desktop application has no public control interface, so Tasker uses the operating system.
 * macOS needs accessibility permission. Linux needs the `xdotool` package.
 */

const MAC_KEY_CODES: Record<string, number> = {
  esc: 53,
  escape: 53,
  return: 36,
  enter: 36,
  tab: 48,
  space: 49,
  delete: 51,
  left: 123,
  right: 124,
  down: 125,
  up: 126
}

const MAC_MODIFIERS: Record<string, string> = {
  cmd: 'command down',
  command: 'command down',
  ctrl: 'control down',
  control: 'control down',
  alt: 'option down',
  option: 'option down',
  shift: 'shift down'
}

const WIN_MODIFIERS: Record<string, string> = {
  ctrl: '^',
  control: '^',
  cmd: '^',
  command: '^',
  alt: '%',
  option: '%',
  shift: '+'
}

const WIN_KEYS: Record<string, string> = {
  esc: '{ESC}',
  escape: '{ESC}',
  return: '{ENTER}',
  enter: '{ENTER}',
  tab: '{TAB}',
  space: ' ',
  left: '{LEFT}',
  right: '{RIGHT}',
  up: '{UP}',
  down: '{DOWN}'
}

const LINUX_MODIFIERS: Record<string, string> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  cmd: 'super',
  command: 'super',
  alt: 'alt',
  option: 'alt',
  shift: 'shift'
}

const LINUX_KEYS: Record<string, string> = {
  esc: 'Escape',
  escape: 'Escape',
  return: 'Return',
  enter: 'Return',
  tab: 'Tab',
  space: 'space',
  left: 'Left',
  right: 'Right',
  up: 'Up',
  down: 'Down'
}

interface Sequence {
  modifiers: string[]
  key: string
}

export function parseSequence(text: string): Sequence | null {
  const parts = text
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part !== '')
  if (parts.length === 0) return null
  const key = parts[parts.length - 1] ?? ''
  if (key === '') return null
  return { modifiers: parts.slice(0, -1), key }
}

function quoteAppleScript(text: string): string {
  return text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

export function macCommand(app: string, sequence: Sequence): CommandSpec {
  const modifiers = sequence.modifiers
    .map((name) => MAC_MODIFIERS[name])
    .filter((value): value is string => value !== undefined)
  const using = modifiers.length > 0 ? ` using {${modifiers.join(', ')}}` : ''
  const code = MAC_KEY_CODES[sequence.key]
  const press =
    code === undefined
      ? `keystroke "${quoteAppleScript(sequence.key)}"${using}`
      : `key code ${code}${using}`
  const script = [
    `tell application "${quoteAppleScript(app)}" to activate`,
    'delay 0.25',
    `tell application "System Events" to ${press}`
  ].join('\n')
  return { program: 'osascript', args: ['-e', script] }
}

export function windowsCommand(app: string, sequence: Sequence): CommandSpec {
  const prefix = sequence.modifiers
    .map((name) => WIN_MODIFIERS[name] ?? '')
    .filter((value) => value !== '')
    .join('')
  const key = WIN_KEYS[sequence.key] ?? sequence.key
  const script = [
    '$shell = New-Object -ComObject WScript.Shell;',
    `$null = $shell.AppActivate('${app.replaceAll("'", "''")}');`,
    'Start-Sleep -Milliseconds 250;',
    `$shell.SendKeys('${prefix}${key}')`
  ].join(' ')
  return {
    program: 'powershell',
    args: ['-NoProfile', '-NonInteractive', '-Command', script]
  }
}

export function linuxCommand(app: string, sequence: Sequence): CommandSpec {
  const modifiers = sequence.modifiers
    .map((name) => LINUX_MODIFIERS[name] ?? '')
    .filter((value) => value !== '')
  const key = LINUX_KEYS[sequence.key] ?? sequence.key
  const combo = [...modifiers, key].join('+')
  return {
    program: 'xdotool',
    args: ['search', '--name', app, 'windowactivate', '--sync', 'key', '--clearmodifiers', combo]
  }
}

export function keyCommand(app: string, text: string): CommandSpec | null {
  const sequence = parseSequence(text)
  if (!sequence) return null
  if (process.platform === 'darwin') return macCommand(app, sequence)
  if (process.platform === 'win32') return windowsCommand(app, sequence)
  return linuxCommand(app, sequence)
}

export const desktopAdapter: Adapter = {
  id: 'desktop',
  resolve(action, _skill, config) {
    const text = config.keys[action] ?? ''
    if (!text) return { spec: null, label: `desktop ${action} has no key` }
    const spec = keyCommand(config.targetApp || 'Claude', text)
    if (!spec) return { spec: null, label: `desktop ${action} key is invalid` }
    return { spec, label: `desktop ${action} ${text}` }
  }
}
