/** Shared contract between the main process, the preload bridge and the renderer. */

export type TransportAction = 'undo' | 'stop' | 'record' | 'play'

export const TRANSPORT_ORDER: readonly TransportAction[] = ['undo', 'stop', 'record', 'play']

export type PreviewKind = 'gif' | 'video' | 'image' | 'none'

export interface SkillPreview {
  kind: PreviewKind
  /** `tasker-asset://` URL. The renderer loads this URL directly. */
  url: string | null
}

export interface Skill {
  /** Stable identifier. The value is a hash of the skill directory path. */
  id: string
  /** Skill name from the frontmatter, or the directory name. */
  name: string
  /** One line from the frontmatter. The user interface truncates long text. */
  description: string
  /** Absolute path of the skill directory. */
  dir: string
  /** Absolute path of the SKILL.md file. */
  file: string
  /** Label of the root that holds this skill. */
  source: string
  preview: SkillPreview
  /** Modification time in milliseconds. The deck sorts on this value. */
  mtime: number
  tags: string[]
}

export type AdapterId = 'dry-run' | 'command' | 'cli' | 'desktop'

export type RunState = 'idle' | 'starting' | 'running' | 'recording' | 'error'

export interface RunStatus {
  state: RunState
  action: TransportAction | null
  skillId: string | null
  /** Short machine message. The user interface shows it in the status lamp tooltip. */
  message: string
  startedAt: number | null
}

export interface JournalEntry {
  id: string
  action: TransportAction
  skillId: string | null
  skillName: string | null
  adapter: AdapterId
  command: string
  startedAt: number
  endedAt: number | null
  exitCode: number | null
  reverted: boolean
}

export interface CommandSpec {
  /** Executable name or absolute path. */
  program: string
  args: string[]
  /** Working directory. The skill directory is the default for skill actions. */
  cwd?: string
}

export interface AdapterConfig {
  /** Adapter that serves the play, record, stop and undo actions. */
  id: AdapterId
  /** Commands for the `command` adapter. `${skill}`, `${skillDir}` and `${skillName}` expand. */
  commands: Partial<Record<TransportAction, CommandSpec>>
  /** Key sequence for the `desktop` adapter, per action. */
  keys: Partial<Record<TransportAction, string>>
  /** Application name that the `desktop` adapter activates. */
  targetApp: string
  /** Prompt template for the `cli` adapter. */
  cliProgram: string
  cliPromptTemplate: string
}

export interface WindowConfig {
  width: number
  height: number
  /** Screen position. `null` means the widget centers on the primary display. */
  x: number | null
  y: number | null
  alwaysOnTop: boolean
  opacity: number
  /** The widget hides when it loses focus. */
  hideOnBlur: boolean
}

export interface Config {
  version: number
  /** Directories that hold skill folders. */
  skillRoots: string[]
  /** Accelerator that shows and hides the widget. */
  shortcut: string
  /** Accelerators for the four transport actions. Empty string disables one. */
  transportShortcuts: Partial<Record<TransportAction, string>>
  theme: 'system' | 'light' | 'dark'
  window: WindowConfig
  adapter: AdapterConfig
  /** The widget asks for confirmation before it runs a skill. */
  confirmBeforeRun: boolean
  launchAtLogin: boolean
}

/** Same members as `NodeJS.Platform`. The renderer has no node types. */
export type Platform =
  | 'aix'
  | 'android'
  | 'darwin'
  | 'freebsd'
  | 'haiku'
  | 'linux'
  | 'openbsd'
  | 'sunos'
  | 'win32'
  | 'cygwin'
  | 'netbsd'

export interface AppState {
  skills: Skill[]
  status: RunStatus
  journal: JournalEntry[]
  config: Config
  platform: Platform
  version: string
}

export interface RunRequest {
  action: TransportAction
  skillId: string | null
}

export interface RunResult {
  ok: boolean
  message: string
  entryId: string | null
}

export const IPC = {
  getState: 'tasker:get-state',
  run: 'tasker:run',
  rescan: 'tasker:rescan',
  setConfig: 'tasker:set-config',
  openSkillFolder: 'tasker:open-skill-folder',
  openConfigFile: 'tasker:open-config-file',
  hide: 'tasker:hide',
  quit: 'tasker:quit',
  resize: 'tasker:resize',
  skillsChanged: 'tasker:skills-changed',
  statusChanged: 'tasker:status-changed',
  journalChanged: 'tasker:journal-changed',
  configChanged: 'tasker:config-changed',
  focusRequested: 'tasker:focus-requested',
  transportRequested: 'tasker:transport-requested'
} as const
