/**
 * Builds the demo skill library.
 * Each preview is a screen recording of a full desktop.
 * The widget crops the recording around the pointer, so the recording stays wide here.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ease, svgFramesToGif } from './lib/render.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'assets', 'demo-skills')

const SKILLS = [
  {
    dir: 'excel-to-quickbooks',
    name: 'Excel To QuickBooks',
    description: 'Copies Excel rows into QuickBooks as receipts.',
    tags: ['finance', 'data entry'],
    accent: '#16a47e',
    source: 'Receipts.xlsx',
    app: 'QuickBooks',
    rows: 6
  },
  {
    dir: 'invoice-export',
    name: 'Invoice Export',
    description: 'Exports open invoices to a dated folder.',
    tags: ['finance', 'export'],
    accent: '#4c6fff',
    source: 'Invoices',
    app: 'Export',
    rows: 5
  },
  {
    dir: 'lead-handoff',
    name: 'Lead Handoff',
    description: 'Moves new leads from the form to the CRM.',
    tags: ['sales', 'crm'],
    accent: '#e8453c',
    source: 'Form',
    app: 'CRM',
    rows: 5
  },
  {
    dir: 'ticket-triage',
    name: 'Ticket Triage',
    description: 'Sorts new tickets by product area and priority.',
    tags: ['support'],
    accent: '#b45cf0',
    source: 'Inbox',
    app: 'Tickets',
    rows: 6
  },
  {
    dir: 'expense-report',
    name: 'Expense Report',
    description: 'Reads receipt images and fills the expense form.',
    tags: ['finance'],
    accent: '#f2a33c',
    source: 'Receipts',
    app: 'Expenses',
    rows: 4
  }
]

const WIDTH = 1280
const HEIGHT = 800
const OUT_WIDTH = 720
const OUT_HEIGHT = 450
const FRAMES = 84

// Screen furniture.
const LEFT = { x: 64, y: 108, w: 520, h: 600 }
const RIGHT = { x: 640, y: 152, w: 576, h: 520 }
const ROW_HEIGHT = 46
const FIELD_HEIGHT = 54

function lerp(a, b, t) {
  return a + (b - a) * t
}

function rowPoint(skill, index) {
  return { x: LEFT.x + 150, y: LEFT.y + 128 + index * ROW_HEIGHT + 14 }
}

function fieldPoint(index) {
  return { x: RIGHT.x + 300, y: RIGHT.y + 150 + (index % 3) * FIELD_HEIGHT + 16 }
}

/** Pointer path. The pointer reads one row, then fills one field, then returns. */
function pointer(skill, t) {
  const perRow = 1 / skill.rows
  const index = Math.min(skill.rows - 1, Math.floor(t / perRow))
  const local = (t - index * perRow) / perRow
  const from = rowPoint(skill, index)
  const to = fieldPoint(index)
  if (local < 0.35) {
    const k = ease(local / 0.35)
    return { x: lerp(from.x - 40, from.x, k), y: from.y, index, phase: 'read' }
  }
  if (local < 0.75) {
    const k = ease((local - 0.35) / 0.4)
    return { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), index, phase: 'move' }
  }
  return { x: to.x, y: to.y, index, phase: 'type' }
}

function sourceWindow(skill, active, phase) {
  const rows = []
  for (let row = 0; row < skill.rows; row += 1) {
    const y = LEFT.y + 128 + row * ROW_HEIGHT
    const done = row < active || (row === active && phase !== 'read')
    const selected = row === active && phase === 'read'
    rows.push(
      `<rect x="${LEFT.x + 24}" y="${y}" width="${LEFT.w - 48}" height="${ROW_HEIGHT - 8}" rx="7" fill="${
        selected ? skill.accent : '#eeece6'
      }" opacity="${selected ? 0.28 : 1}"/>` +
        `<rect x="${LEFT.x + 40}" y="${y + 13}" width="${96 + ((row * 41) % 90)}" height="12" rx="6" fill="#8f96a2"/>` +
        `<rect x="${LEFT.x + 250}" y="${y + 13}" width="${70 + ((row * 29) % 70)}" height="12" rx="6" fill="#c2c7cf"/>` +
        (done
          ? `<circle cx="${LEFT.x + LEFT.w - 66}" cy="${y + 19}" r="9" fill="${skill.accent}"/>`
          : '')
    )
  }
  return `<g>
    <rect x="${LEFT.x}" y="${LEFT.y}" width="${LEFT.w}" height="${LEFT.h}" rx="18" fill="#ffffff" stroke="#c8c4bb" stroke-width="2"/>
    <rect x="${LEFT.x}" y="${LEFT.y}" width="${LEFT.w}" height="52" rx="18" fill="#f1efe9"/>
    <rect x="${LEFT.x}" y="${LEFT.y + 34}" width="${LEFT.w}" height="18" fill="#f1efe9"/>
    <circle cx="${LEFT.x + 26}" cy="${LEFT.y + 26}" r="7" fill="#e8453c"/>
    <circle cx="${LEFT.x + 48}" cy="${LEFT.y + 26}" r="7" fill="#f2a33c"/>
    <circle cx="${LEFT.x + 70}" cy="${LEFT.y + 26}" r="7" fill="#16a47e"/>
    <rect x="${LEFT.x + 96}" y="${LEFT.y + 19}" width="${skill.source.length * 10}" height="14" rx="7" fill="#cfcbc2"/>
    <rect x="${LEFT.x + 24}" y="${LEFT.y + 84}" width="200" height="16" rx="8" fill="#3b414b"/>
    ${rows.join('\n    ')}
  </g>`
}

function targetWindow(skill, active, phase) {
  const fields = []
  for (let field = 0; field < 3; field += 1) {
    const y = RIGHT.y + 150 + field * FIELD_HEIGHT
    const current = field === active % 3 && phase === 'type'
    const filled = field < active % 3 || (field === active % 3 && phase === 'type')
    fields.push(
      `<rect x="${RIGHT.x + 40}" y="${y}" width="${RIGHT.w - 80}" height="${FIELD_HEIGHT - 12}" rx="9" fill="#ffffff" stroke="${current ? skill.accent : '#c9c5bc'}" stroke-width="${current ? 4 : 3}"/>` +
        (filled
          ? `<rect x="${RIGHT.x + 56}" y="${y + 15}" width="${110 + field * 46}" height="12" rx="6" fill="#7b828e"/>`
          : '')
    )
  }
  return `<g>
    <rect x="${RIGHT.x}" y="${RIGHT.y}" width="${RIGHT.w}" height="${RIGHT.h}" rx="18" fill="#ffffff" stroke="#c8c4bb" stroke-width="2"/>
    <rect x="${RIGHT.x}" y="${RIGHT.y}" width="${RIGHT.w}" height="52" rx="18" fill="${skill.accent}" opacity="0.14"/>
    <rect x="${RIGHT.x}" y="${RIGHT.y + 34}" width="${RIGHT.w}" height="18" fill="${skill.accent}" opacity="0.14"/>
    <rect x="${RIGHT.x + 24}" y="${RIGHT.y + 19}" width="${skill.app.length * 11}" height="14" rx="7" fill="${skill.accent}"/>
    <rect x="${RIGHT.x + 40}" y="${RIGHT.y + 94}" width="240" height="18" rx="9" fill="#3b414b"/>
    ${fields.join('\n    ')}
    <rect x="${RIGHT.x + RIGHT.w - 200}" y="${RIGHT.y + RIGHT.h - 84}" width="160" height="46" rx="23" fill="${skill.accent}"/>
    <rect x="${RIGHT.x + RIGHT.w - 168}" y="${RIGHT.y + RIGHT.h - 67}" width="96" height="12" rx="6" fill="#ffffff" opacity="0.9"/>
  </g>`
}

function frame(skill, index) {
  const t = index / FRAMES
  const p = pointer(skill, t)
  const click = p.phase === 'type'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#b9c2cc"/>
  <circle cx="1030" cy="120" r="260" fill="#a9b4c2" opacity="0.55"/>
  <circle cx="220" cy="720" r="220" fill="#c6cdd6" opacity="0.6"/>
  <rect width="${WIDTH}" height="34" fill="#20242b" opacity="0.86"/>
  <rect x="18" y="12" width="70" height="10" rx="5" fill="#ffffff" opacity="0.7"/>
  <rect x="${WIDTH - 130}" y="12" width="52" height="10" rx="5" fill="#ffffff" opacity="0.5"/>
  <rect x="${WIDTH - 66}" y="12" width="40" height="10" rx="5" fill="#ffffff" opacity="0.5"/>
  ${sourceWindow(skill, p.index, p.phase)}
  ${targetWindow(skill, p.index, p.phase)}
  <rect x="${WIDTH / 2 - 150}" y="${HEIGHT - 62}" width="300" height="46" rx="23" fill="#20242b" opacity="0.2"/>
  ${click ? `<circle cx="${p.x}" cy="${p.y}" r="26" fill="${skill.accent}" opacity="0.28"/>` : ''}
  <g transform="translate(${p.x} ${p.y})">
    <path d="M0 0 L0 30 L7.7 22.7 L12.7 33.3 L18.3 30.7 L13.3 20.3 L23.3 20 Z" fill="#16181d" stroke="#ffffff" stroke-width="2.4"/>
  </g>
</svg>`
}

function skillMarkdown(skill) {
  return `---
name: ${skill.name}
description: ${skill.description}
tags: [${skill.tags.join(', ')}]
preview: preview.gif
previewFollow: true
---

# ${skill.name}

${skill.description}

## Steps

1. Open ${skill.source}.
2. Read each row.
3. Open ${skill.app}.
4. Enter the row values.
5. Save the record.
6. Repeat until the last row.

## Checks

- The row count matches the source file.
- Each amount matches the source value.
`
}

async function main() {
  for (const skill of SKILLS) {
    const dir = join(target, skill.dir)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'SKILL.md'), skillMarkdown(skill), 'utf8')
    const frames = []
    for (let index = 0; index < FRAMES; index += 1) frames.push(frame(skill, index))
    await svgFramesToGif(frames, join(dir, 'preview.gif'), {
      delay: 4,
      width: OUT_WIDTH,
      height: OUT_HEIGHT,
      colors: 96
    })
    console.log(`[demo] ${skill.dir}`)
  }
}

await main()
