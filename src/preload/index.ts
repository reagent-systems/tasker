import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppState,
  Config,
  JournalEntry,
  RunRequest,
  RunResult,
  RunStatus,
  Skill,
  TransportAction
} from '@shared/types'
import { IPC } from '@shared/types'

type Unsubscribe = () => void

function on<T>(channel: string, listener: (payload: T) => void): Unsubscribe {
  const handler = (_event: unknown, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke(IPC.getState),
  run: (request: RunRequest): Promise<RunResult> => ipcRenderer.invoke(IPC.run, request),
  rescan: (): Promise<Skill[]> => ipcRenderer.invoke(IPC.rescan),
  setConfig: (patch: Partial<Config>): Promise<Config> => ipcRenderer.invoke(IPC.setConfig, patch),
  openSkillFolder: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.openSkillFolder, id),
  openConfigFile: (): Promise<void> => ipcRenderer.invoke(IPC.openConfigFile),
  hide: (): Promise<void> => ipcRenderer.invoke(IPC.hide),
  quit: (): Promise<void> => ipcRenderer.invoke(IPC.quit),
  resize: (size: { width: number; height: number }): Promise<void> =>
    ipcRenderer.invoke(IPC.resize, size),
  onSkills: (listener: (skills: Skill[]) => void): Unsubscribe => on(IPC.skillsChanged, listener),
  onStatus: (listener: (status: RunStatus) => void): Unsubscribe => on(IPC.statusChanged, listener),
  onJournal: (listener: (entries: JournalEntry[]) => void): Unsubscribe =>
    on(IPC.journalChanged, listener),
  onConfig: (listener: (config: Config) => void): Unsubscribe => on(IPC.configChanged, listener),
  onTransport: (listener: (action: TransportAction) => void): Unsubscribe =>
    on(IPC.transportRequested, listener)
}

export type TaskerApi = typeof api

contextBridge.exposeInMainWorld('tasker', api)
