/**
 * End to end test of the run path.
 * Electron runs this file as a main process, so the test uses the real Electron API,
 * the real adapters, the real child process and the real journal file.
 * Nothing here is a mock.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import type { Config, JournalEntry, RunStatus, Skill } from '@shared/types'
import { defaultConfig } from '../../src/main/config.js'
import { Journal } from '../../src/main/journal.js'
import { Runner } from '../../src/main/runner.js'
import { scanSkills } from '../../src/main/skills/scan.js'
import { SkillWatcher } from '../../src/main/skills/watch.js'

const work = mkdtempSync(join(tmpdir(), 'tasker-itest-'))
const isWindows = process.platform === 'win32'

const SKILL: Skill = {
  id: 'test-skill',
  name: 'Excel To QuickBooks',
  description: 'Copies rows.',
  dir: work,
  file: join(work, 'SKILL.md'),
  source: 'itest',
  preview: { kind: 'none', url: null, zoom: null, follow: true, loop: 'pingpong' },
  mtime: 0,
  tags: []
}

function config(patch: Partial<Config['adapter']>): Config {
  const base = defaultConfig()
  return { ...base, adapter: { ...base.adapter, ...patch } }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readJournal(file: string): JournalEntry[] {
  return JSON.parse(readFileSync(file, 'utf8')) as JournalEntry[]
}

interface Harness {
  journal: Journal
  runner: Runner
  file: string
  status: () => RunStatus
}

function harness(name: string): Harness {
  const file = join(work, `${name}.json`)
  const journal = new Journal(file)
  let latest: RunStatus = {
    state: 'idle',
    action: null,
    skillId: null,
    message: 'idle',
    startedAt: null
  }
  const runner = new Runner(
    journal,
    (status) => {
      latest = status
    },
    () => undefined
  )
  return { journal, runner, file, status: () => latest }
}

/** Waits until the runner reports a state that is not running. */
async function settle(get: () => RunStatus, limit = 8000): Promise<RunStatus> {
  const start = Date.now()
  while (Date.now() - start < limit) {
    const status = get()
    if (status.state === 'idle' || status.state === 'error') return status
    await wait(50)
  }
  throw new Error(`the runner did not settle: ${JSON.stringify(get())}`)
}

const tests: [string, () => Promise<void>][] = [
  [
    'the command adapter starts a real program and journals the exit code',
    async () => {
      const test = harness('command')
      const result = test.runner.run(
        'play',
        SKILL,
        config({
          id: 'command',
          commands: isWindows
            ? { play: { program: 'cmd', args: ['/c', 'echo', '${skillName}'] } }
            : { play: { program: '/bin/echo', args: ['tasker', '${skillName}'] } }
        })
      )
      assert.equal(result.ok, true)
      const status = await settle(test.status)
      assert.equal(status.state, 'idle', `unexpected state: ${status.message}`)

      const entries = readJournal(test.file)
      assert.equal(entries.length, 1)
      const entry = entries[0]
      assert.ok(entry)
      assert.equal(entry.action, 'play')
      assert.equal(entry.adapter, 'command')
      assert.equal(entry.exitCode, 0)
      assert.ok(entry.endedAt !== null)
      // The template expanded before the program started.
      assert.match(entry.command, /Excel To QuickBooks/)
    }
  ],
  [
    'a missing program reports an error and does not throw',
    async () => {
      const test = harness('missing')
      const result = test.runner.run(
        'play',
        SKILL,
        config({
          id: 'command',
          commands: { play: { program: 'tasker-program-that-does-not-exist', args: [] } }
        })
      )
      assert.equal(result.ok, true)
      const status = await settle(test.status)
      assert.equal(status.state, 'error')
    }
  ],
  [
    'the stop key ends a running child process',
    async () => {
      const test = harness('stop')
      test.runner.run(
        'play',
        SKILL,
        config({
          id: 'command',
          commands: isWindows
            ? { play: { program: 'cmd', args: ['/c', 'timeout', '/t', '30'] } }
            : { play: { program: '/bin/sleep', args: ['30'] } }
        })
      )
      await wait(400)
      assert.equal(test.status().state, 'running')

      test.runner.run('stop', SKILL, config({ id: 'command' }))
      const status = await settle(test.status, 4000)
      assert.equal(status.state, 'idle')

      if (!isWindows) {
        // The process table no longer holds the child.
        const listing = execFileSync('ps', ['-A', '-o', 'command'], { encoding: 'utf8' })
        const running = listing.split('\n').filter((line) => line.includes('/bin/sleep 30')).length
        assert.equal(running, 0, 'the child process stayed alive')
      }
    }
  ],
  [
    'the undo key marks the last run as reverted',
    async () => {
      const test = harness('undo')
      const play = config({
        id: 'command',
        commands: isWindows
          ? { play: { program: 'cmd', args: ['/c', 'echo', 'x'] } }
          : { play: { program: '/bin/echo', args: ['x'] } }
      })
      test.runner.run('play', SKILL, play)
      await settle(test.status)

      test.runner.run('undo', SKILL, config({ id: 'dry-run' }))
      await settle(test.status)

      const entries = readJournal(test.file)
      const played = entries.find((entry) => entry.action === 'play')
      const undone = entries.find((entry) => entry.action === 'undo')
      assert.ok(played)
      assert.ok(undone)
      assert.equal(played.reverted, true)
    }
  ],
  [
    'the dry-run adapter starts no program',
    async () => {
      const test = harness('dry')
      const before = Date.now()
      const result = test.runner.run('record', SKILL, config({ id: 'dry-run' }))
      assert.equal(result.ok, true)
      assert.equal(Date.now() - before < 500, true)
      const entries = readJournal(test.file)
      const entry = entries[0]
      assert.ok(entry)
      assert.equal(entry.adapter, 'dry-run')
      assert.equal(entry.exitCode, 0)
      assert.match(entry.command, /dry-run record/)
    }
  ],
  [
    'the cli adapter builds a prompt for the real claude binary',
    async () => {
      const test = harness('cli')
      // The program name points at a program that exists on every platform.
      const result = test.runner.run(
        'play',
        SKILL,
        config({ id: 'cli', cliProgram: isWindows ? 'cmd' : '/bin/echo' })
      )
      assert.equal(result.ok, true)
      const status = await settle(test.status)
      assert.equal(status.state, 'idle')
      const entry = readJournal(test.file)[0]
      assert.ok(entry)
      assert.match(entry.command, /Use the Excel To QuickBooks skill\./)
    }
  ],
  [
    'the watcher reports a new skill without a restart',
    async () => {
      const root = join(work, 'watched')
      mkdirSync(root, { recursive: true })
      let changes = 0
      const watcher = new SkillWatcher(() => {
        changes += 1
      })
      watcher.start([root])
      await wait(700)

      const dir = join(root, 'new-skill')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'SKILL.md'), '---\nname: New Skill\n---\n', 'utf8')

      const limit = Date.now() + 6000
      while (changes === 0 && Date.now() < limit) await wait(100)
      watcher.stop()
      assert.ok(changes > 0, 'the watcher reported no change')

      const found = await scanSkills([root])
      assert.equal(found.length, 1)
      assert.equal(found[0]?.name, 'New Skill')
    }
  ],
  [
    'the journal file survives a restart',
    async () => {
      const file = join(work, 'persist.json')
      const first = new Journal(file)
      first.append({
        action: 'play',
        skillId: SKILL.id,
        skillName: SKILL.name,
        adapter: 'dry-run',
        command: 'dry-run play',
        startedAt: Date.now(),
        endedAt: Date.now(),
        exitCode: 0,
        reverted: false
      })
      assert.equal(existsSync(file), true)
      const second = new Journal(file)
      assert.equal(second.list().length, 1)
      assert.equal(second.lastRevertable()?.skillName, SKILL.name)
    }
  ]
]

async function main(): Promise<void> {
  await app.whenReady()
  app.setPath('userData', work)

  let failed = 0
  console.log(`1..${tests.length}`)
  for (let index = 0; index < tests.length; index += 1) {
    const [name, run] = tests[index] as [string, () => Promise<void>]
    try {
      await run()
      console.log(`ok ${index + 1} - ${name}`)
    } catch (error) {
      failed += 1
      console.log(`not ok ${index + 1} - ${name}`)
      console.log(`  ${error instanceof Error ? error.stack : String(error)}`)
    }
  }
  console.log(`# pass ${tests.length - failed}`)
  console.log(`# fail ${failed}`)
  app.exit(failed === 0 ? 0 : 1)
}

void main()
