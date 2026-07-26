import { spawn, type ChildProcess } from 'node:child_process'
import type { Config, RunResult, RunStatus, Skill, TransportAction } from '@shared/types'
import { getAdapter } from './adapters/index.js'
import type { Journal } from './journal.js'

const STATE_FOR: Record<TransportAction, RunStatus['state']> = {
  play: 'running',
  record: 'recording',
  undo: 'running',
  stop: 'idle'
}

export class Runner {
  private child: ChildProcess | null = null
  private entryId: string | null = null
  private status: RunStatus = {
    state: 'idle',
    action: null,
    skillId: null,
    message: 'idle',
    startedAt: null
  }

  constructor(
    private readonly journal: Journal,
    private readonly onStatus: (status: RunStatus) => void,
    private readonly onJournal: () => void
  ) {}

  getStatus(): RunStatus {
    return this.status
  }

  private setStatus(next: Partial<RunStatus>): void {
    this.status = { ...this.status, ...next }
    this.onStatus(this.status)
  }

  run(action: TransportAction, skill: Skill | null, config: Config): RunResult {
    if (action === 'stop') {
      const result = this.stop()
      const stopSpec = getAdapter(config.adapter.id).resolve('stop', skill, config.adapter).spec
      if (stopSpec) {
        try {
          spawn(stopSpec.program, stopSpec.args, { shell: false, stdio: 'ignore' }).unref()
        } catch (error) {
          console.error('[run] stop command failed:', error)
        }
      }
      return result
    }

    const adapter = getAdapter(config.adapter.id)
    const resolution = adapter.resolve(action, skill, config.adapter)

    const entry = this.journal.append({
      action,
      skillId: skill?.id ?? null,
      skillName: skill?.name ?? null,
      adapter: adapter.id,
      command: resolution.spec
        ? `${resolution.spec.program} ${resolution.spec.args.join(' ')}`
        : resolution.label,
      startedAt: Date.now(),
      endedAt: null,
      exitCode: null,
      reverted: false
    })
    this.onJournal()

    if (action === 'undo') {
      const target = this.journal.lastRevertable()
      if (target) {
        this.journal.markReverted(target.id)
        this.onJournal()
      }
    }

    if (!resolution.spec) {
      this.journal.finish(entry.id, 0)
      this.onJournal()
      this.setStatus({
        state: 'idle',
        action,
        skillId: skill?.id ?? null,
        message: resolution.label,
        startedAt: Date.now()
      })
      return { ok: true, message: resolution.label, entryId: entry.id }
    }

    this.kill()
    try {
      this.child = spawn(resolution.spec.program, resolution.spec.args, {
        cwd: resolution.spec.cwd,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'spawn failed'
      this.journal.finish(entry.id, -1)
      this.onJournal()
      this.setStatus({ state: 'error', action, skillId: skill?.id ?? null, message })
      return { ok: false, message, entryId: entry.id }
    }

    this.entryId = entry.id
    this.setStatus({
      state: STATE_FOR[action],
      action,
      skillId: skill?.id ?? null,
      message: resolution.label,
      startedAt: Date.now()
    })

    this.child.stdout?.on('data', (chunk: Buffer) => console.log('[run]', chunk.toString().trim()))
    this.child.stderr?.on('data', (chunk: Buffer) => console.warn('[run]', chunk.toString().trim()))
    this.child.on('error', (error) => {
      this.setStatus({ state: 'error', message: error.message })
    })
    this.child.on('close', (code) => {
      if (this.entryId) {
        this.journal.finish(this.entryId, code)
        this.onJournal()
      }
      this.child = null
      this.entryId = null
      this.setStatus({
        state: code === 0 ? 'idle' : 'error',
        message: code === 0 ? 'done' : `exit ${code}`
      })
    })

    return { ok: true, message: resolution.label, entryId: entry.id }
  }

  private kill(): void {
    if (!this.child) return
    try {
      this.child.kill('SIGTERM')
    } catch (error) {
      console.error('[run] kill failed:', error)
    }
    this.child = null
  }

  stop(): RunResult {
    const active = this.child !== null
    this.kill()
    if (this.entryId) {
      this.journal.finish(this.entryId, null)
      this.entryId = null
      this.onJournal()
    }
    this.setStatus({ state: 'idle', action: 'stop', message: active ? 'stopped' : 'idle' })
    return { ok: true, message: active ? 'stopped' : 'idle', entryId: null }
  }
}
