/**
 * Minimal YAML frontmatter reader.
 * The reader supports the subset that SKILL.md files use:
 * scalar values, quoted values, inline lists and block lists.
 */

export interface Frontmatter {
  data: Record<string, string | string[]>
  body: string
}

const DELIMITER = /^---\s*$/

function unquote(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

function parseInlineList(value: string): string[] | null {
  const trimmed = value.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null
  const inner = trimmed.slice(1, -1).trim()
  if (inner === '') return []
  return inner
    .split(',')
    .map((item) => unquote(item))
    .filter((item) => item !== '')
}

export function parseFrontmatter(text: string): Frontmatter {
  const lines = text.split(/\r?\n/)
  if (lines.length === 0 || !DELIMITER.test(lines[0] ?? '')) {
    return { data: {}, body: text }
  }
  let end = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (DELIMITER.test(lines[i] ?? '')) {
      end = i
      break
    }
  }
  if (end === -1) return { data: {}, body: text }

  const data: Record<string, string | string[]> = {}
  let currentKey: string | null = null
  let currentList: string[] | null = null

  for (let i = 1; i < end; i += 1) {
    const line = lines[i] ?? ''
    if (line.trim() === '' || line.trim().startsWith('#')) continue

    const listItem = /^\s*-\s+(.*)$/.exec(line)
    if (listItem && currentKey && currentList) {
      currentList.push(unquote(listItem[1] ?? ''))
      continue
    }

    const pair = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line)
    if (!pair) continue

    if (currentKey && currentList) {
      data[currentKey] = currentList
      currentList = null
    }
    const key = pair[1] ?? ''
    const raw = pair[2] ?? ''
    if (raw.trim() === '') {
      currentKey = key
      currentList = []
      data[key] = ''
      continue
    }
    const inline = parseInlineList(raw)
    data[key] = inline ?? unquote(raw)
    currentKey = key
    currentList = null
  }
  if (currentKey && currentList && currentList.length > 0) data[currentKey] = currentList

  return { data, body: lines.slice(end + 1).join('\n') }
}

export function asString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(', ')
  return value ?? ''
}

export function asList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
}
