import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { PreviewKind, Skill, SkillPreview } from '@shared/types'
import { asList, asString, parseFrontmatter } from './frontmatter.js'

const MAX_DEPTH = 4
const SKIP = new Set(['node_modules', '.git', '.venv', 'dist', 'out', 'build', '__pycache__'])

const PREVIEW_NAMES = ['preview', 'demo', 'recording', 'thumbnail']
const PREVIEW_KIND: Record<string, PreviewKind> = {
  '.gif': 'gif',
  '.mp4': 'video',
  '.webm': 'video',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image'
}

export function skillId(dir: string): string {
  return createHash('sha1').update(dir).digest('hex').slice(0, 12)
}

/** The renderer loads preview files through a custom protocol. */
export function assetUrl(file: string): string {
  return `tasker-asset://local/${encodeURIComponent(file)}`
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

async function findPreview(dir: string, declared: string): Promise<SkillPreview> {
  const candidates: string[] = []
  if (declared) candidates.push(join(dir, declared))

  let entries: string[] = []
  try {
    entries = await readdir(dir)
  } catch {
    entries = []
  }
  const ranked = entries
    .filter((name) => PREVIEW_KIND[extensionOf(name)] !== undefined)
    .sort((a, b) => rank(a) - rank(b))
  for (const name of ranked) candidates.push(join(dir, name))

  for (const file of candidates) {
    const kind = PREVIEW_KIND[extensionOf(file)]
    if (!kind) continue
    try {
      const info = await stat(file)
      if (info.isFile()) return { kind, url: assetUrl(file) }
    } catch {
      continue
    }
  }
  return { kind: 'none', url: null }
}

function rank(name: string): number {
  const stem = basename(name, extensionOf(name)).toLowerCase()
  const index = PREVIEW_NAMES.indexOf(stem)
  const byName = index === -1 ? PREVIEW_NAMES.length : index
  const byKind = extensionOf(name) === '.gif' ? 0 : 1
  return byName * 10 + byKind
}

async function readSkill(dir: string, file: string, source: string): Promise<Skill | null> {
  let text: string
  let mtime = 0
  try {
    text = await readFile(file, 'utf8')
    mtime = (await stat(file)).mtimeMs
  } catch {
    return null
  }
  const { data } = parseFrontmatter(text)
  const name = asString(data.name) || basename(dir)
  const description = asString(data.description)
  const preview = await findPreview(dir, asString(data.preview))
  return {
    id: skillId(dir),
    name,
    description,
    dir,
    file,
    source,
    preview,
    mtime,
    tags: asList(data.tags ?? data.keywords)
  }
}

async function walk(dir: string, source: string, depth: number, found: Skill[]): Promise<void> {
  if (depth > MAX_DEPTH) return
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  const hasSkillFile = entries.some((entry) => entry.isFile() && entry.name === 'SKILL.md')
  if (hasSkillFile) {
    const skill = await readSkill(dir, join(dir, 'SKILL.md'), source)
    if (skill) found.push(skill)
    return
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP.has(entry.name) || entry.name.startsWith('.')) continue
    await walk(join(dir, entry.name), source, depth + 1, found)
  }
}

/** Reads every root and returns a sorted, duplicate-free list of skills. */
export async function scanSkills(roots: string[]): Promise<Skill[]> {
  const found: Skill[] = []
  for (const root of roots) {
    await walk(root, basename(root) || root, 0, found)
  }
  const unique = new Map<string, Skill>()
  for (const skill of found) unique.set(skill.dir, skill)
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name))
}
