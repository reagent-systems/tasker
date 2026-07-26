import chokidar, { type FSWatcher } from 'chokidar'

/** Watches the skill roots and reports changes after a quiet period. */
export class SkillWatcher {
  private watcher: FSWatcher | null = null
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly onChange: () => void) {}

  start(roots: string[]): void {
    this.stop()
    this.watcher = chokidar.watch(roots, {
      ignoreInitial: true,
      depth: 4,
      awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
      ignored: (path: string) => path.includes('node_modules') || path.includes('/.git/')
    })
    const bump = (): void => this.schedule()
    this.watcher.on('add', bump)
    this.watcher.on('change', bump)
    this.watcher.on('unlink', bump)
    this.watcher.on('addDir', bump)
    this.watcher.on('unlinkDir', bump)
    this.watcher.on('error', (error) => console.error('[watch]', error))
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.onChange()
    }, 300)
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    void this.watcher?.close()
    this.watcher = null
  }
}
