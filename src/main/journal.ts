import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { JournalEntry } from '@shared/types'

const LIMIT = 200

export class Journal {
  private entries: JournalEntry[] = []

  constructor(private readonly file = join(app.getPath('userData'), 'journal.json')) {
    this.load()
  }

  private load(): void {
    if (!existsSync(this.file)) return
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.file, 'utf8'))
      if (Array.isArray(parsed)) this.entries = parsed as JournalEntry[]
    } catch (error) {
      console.error('[journal] read failed:', error)
    }
  }

  private persist(): void {
    try {
      mkdirSync(app.getPath('userData'), { recursive: true })
      writeFileSync(this.file, `${JSON.stringify(this.entries.slice(0, LIMIT), null, 2)}\n`, 'utf8')
    } catch (error) {
      console.error('[journal] write failed:', error)
    }
  }

  list(): JournalEntry[] {
    return this.entries.slice(0, 50)
  }

  append(entry: Omit<JournalEntry, 'id'>): JournalEntry {
    const full: JournalEntry = { id: randomUUID(), ...entry }
    this.entries.unshift(full)
    this.entries = this.entries.slice(0, LIMIT)
    this.persist()
    return full
  }

  finish(id: string, exitCode: number | null): void {
    const entry = this.entries.find((item) => item.id === id)
    if (!entry) return
    entry.endedAt = Date.now()
    entry.exitCode = exitCode
    this.persist()
  }

  /** Returns the last entry that a play or record action created. */
  lastRevertable(): JournalEntry | null {
    return (
      this.entries.find(
        (entry) => !entry.reverted && (entry.action === 'play' || entry.action === 'record')
      ) ?? null
    )
  }

  markReverted(id: string): void {
    const entry = this.entries.find((item) => item.id === id)
    if (!entry) return
    entry.reverted = true
    this.persist()
  }
}
