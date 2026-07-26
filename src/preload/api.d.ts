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

declare global {
  interface Window {
    tasker: {
      getState(): Promise<AppState>
      run(request: RunRequest): Promise<RunResult>
      rescan(): Promise<Skill[]>
      setConfig(patch: Partial<Config>): Promise<Config>
      openSkillFolder(id: string): Promise<boolean>
      openConfigFile(): Promise<void>
      hide(): Promise<void>
      quit(): Promise<void>
      resize(size: { width: number; height: number }): Promise<void>
      onSkills(listener: (skills: Skill[]) => void): () => void
      onStatus(listener: (status: RunStatus) => void): () => void
      onJournal(listener: (entries: JournalEntry[]) => void): () => void
      onConfig(listener: (config: Config) => void): () => void
      onTransport(listener: (action: TransportAction) => void): () => void
    }
  }
}

export {}
