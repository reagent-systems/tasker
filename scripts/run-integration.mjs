/**
 * Bundles the integration tests, then runs them inside Electron.
 * The tests use the real Electron API, so a plain node process cannot run them.
 */
import { spawn } from 'node:child_process'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const testDir = join(root, 'tests', 'integration')
const outDir = join(root, 'out', 'integration')

const files = (await readdir(testDir)).filter((name) => name.endsWith('.itest.ts'))
if (files.length === 0) {
  console.error('[itest] no test files')
  process.exit(1)
}

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

await build({
  entryPoints: files.map((name) => join(testDir, name)),
  outdir: outDir,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: 'inline',
  outExtension: { '.js': '.cjs' },
  external: ['electron', 'chokidar'],
  alias: { '@shared': join(root, 'src', 'shared') }
})

let failed = 0
for (const name of files) {
  const script = join(outDir, name.replace(/\.ts$/, '.cjs'))
  const code = await new Promise((resolve) => {
    const child = spawn(electron, [script], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' }
    })
    child.on('exit', (value) => resolve(value ?? 1))
  })
  if (code !== 0) failed += 1
}

process.exit(failed === 0 ? 0 : 1)
