import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Config } from '@shared/types'

const CONFIG_VERSION = 1

function defaultSkillRoots(): string[] {
  const home = homedir()
  const roots = [join(home, '.claude', 'skills'), join(home, '.claude', 'plugins')]
  if (process.platform === 'darwin') {
    roots.push(join(home, 'Library', 'Application Support', 'Claude', 'skills'))
  } else if (process.platform === 'win32') {
    roots.push(join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Claude', 'skills'))
  } else {
    roots.push(join(process.env.XDG_CONFIG_HOME ?? join(home, '.config'), 'Claude', 'skills'))
  }
  return roots
}

/** Key sequence that opens the record dialog of the Claude desktop app. */
function defaultDesktopKeys(): Record<string, string> {
  return { record: 'cmd+shift+r', stop: 'esc', play: 'return', undo: 'cmd+z' }
}

export function defaultConfig(): Config {
  return {
    version: CONFIG_VERSION,
    skillRoots: defaultSkillRoots(),
    shortcut: process.platform === 'darwin' ? 'Command+Shift+Space' : 'Control+Shift+Space',
    transportShortcuts: { undo: '', stop: '', record: '', play: '' },
    theme: 'system',
    window: {
      width: 460,
      height: 320,
      x: null,
      y: null,
      alwaysOnTop: true,
      opacity: 1,
      hideOnBlur: false
    },
    adapter: {
      id: 'dry-run',
      commands: {},
      keys: defaultDesktopKeys(),
      targetApp: 'Claude',
      cliProgram: 'claude',
      cliPromptTemplate: 'Use the ${skillName} skill.'
    },
    confirmBeforeRun: false,
    launchAtLogin: false
  }
}

export function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function merge(base: Config, patch: unknown): Config {
  if (typeof patch !== 'object' || patch === null) return base
  const p = patch as Record<string, unknown>
  const out: Config = { ...base }
  for (const key of Object.keys(base) as (keyof Config)[]) {
    const value = p[key]
    if (value === undefined) continue
    if (key === 'window' || key === 'adapter' || key === 'transportShortcuts') {
      out[key] = { ...(base[key] as object), ...(value as object) } as never
      continue
    }
    out[key] = value as never
  }
  out.version = CONFIG_VERSION
  return out
}

let cache: Config | null = null

export function loadConfig(): Config {
  if (cache) return cache
  const file = configPath()
  const base = defaultConfig()
  if (!existsSync(file)) {
    cache = base
    saveConfig(base)
    return base
  }
  try {
    cache = merge(base, JSON.parse(readFileSync(file, 'utf8')))
  } catch (error) {
    console.error('[config] read failed, defaults apply:', error)
    cache = base
  }
  return cache
}

export function saveConfig(next: Config): Config {
  cache = next
  const file = configPath()
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

export function updateConfig(patch: Partial<Config>): Config {
  return saveConfig(merge(loadConfig(), patch))
}
