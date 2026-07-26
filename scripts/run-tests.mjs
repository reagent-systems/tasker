/** Bundles the TypeScript tests, then runs them with the node test runner. */
import { execFile } from 'node:child_process'
import { readdir, rm, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { build } from 'esbuild'

const run = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const testDir = join(root, 'tests')
const outDir = join(root, 'out', 'tests')

const files = (await readdir(testDir)).filter((name) => name.endsWith('.test.ts'))
if (files.length === 0) {
  console.error('[test] no test files')
  process.exit(1)
}

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

await build({
  entryPoints: files.map((name) => join(testDir, name)),
  outdir: outDir,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: 'inline',
  outExtension: { '.js': '.mjs' },
  external: ['electron', 'chokidar'],
  alias: { '@shared': join(root, 'src', 'shared') }
})

const built = files.map((name) => join(outDir, name.replace(/\.ts$/, '.mjs')))

try {
  const result = await run(process.execPath, ['--test', ...built], { cwd: root })
  process.stdout.write(result.stdout)
} catch (error) {
  process.stdout.write(error.stdout ?? '')
  process.stderr.write(error.stderr ?? '')
  process.exit(1)
}
