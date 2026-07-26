/**
 * Builds the demo skill library.
 * The output feeds the screenshots, the OG image and the first run of a new user.
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
    app: 'QuickBooks',
    rows: 6
  },
  {
    dir: 'invoice-export',
    name: 'Invoice Export',
    description: 'Exports open invoices to a dated folder.',
    tags: ['finance', 'export'],
    accent: '#4c6fff',
    app: 'Invoices',
    rows: 5
  },
  {
    dir: 'lead-handoff',
    name: 'Lead Handoff',
    description: 'Moves new leads from the form to the CRM.',
    tags: ['sales', 'crm'],
    accent: '#e8453c',
    app: 'CRM',
    rows: 5
  },
  {
    dir: 'ticket-triage',
    name: 'Ticket Triage',
    description: 'Sorts new tickets by product area and priority.',
    tags: ['support'],
    accent: '#b45cf0',
    app: 'Tickets',
    rows: 7
  },
  {
    dir: 'expense-report',
    name: 'Expense Report',
    description: 'Reads receipt images and fills the expense form.',
    tags: ['finance'],
    accent: '#f2a33c',
    app: 'Expenses',
    rows: 4
  }
]

const WIDTH = 480
const HEIGHT = 360
const FRAMES = 24

function frame(skill, index) {
  const t = index / FRAMES
  const rowHeight = 26
  const tableTop = 108
  const active = Math.floor(ease(Math.min(1, t * 1.25)) * skill.rows)
  const cursorY = tableTop + active * rowHeight + 14
  const cursorX = 120 + Math.sin(t * Math.PI * 2) * 26
  const done = t > 0.82
  const rows = []
  for (let row = 0; row < skill.rows; row += 1) {
    const y = tableTop + row * rowHeight
    const filled = row < active
    rows.push(
      `<rect x="86" y="${y}" width="360" height="20" rx="5" fill="${filled ? skill.accent : '#e8e6e0'}" opacity="${filled ? 0.22 : 1}"/>` +
        `<rect x="94" y="${y + 6}" width="${74 + ((row * 37) % 60)}" height="8" rx="4" fill="#9aa0ab"/>` +
        `<rect x="250" y="${y + 6}" width="${44 + ((row * 23) % 48)}" height="8" rx="4" fill="#c3c7cf"/>` +
        (filled
          ? `<circle cx="428" cy="${y + 10}" r="7" fill="${skill.accent}"/><path d="M424.5 ${y + 10} l2.6 2.8 l5.2 -5.6" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
          : '')
    )
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#f4f2ec"/>
  <rect x="26" y="26" width="428" height="308" rx="14" fill="#ffffff" stroke="#16181d" stroke-width="3"/>
  <rect x="26" y="26" width="428" height="42" rx="14" fill="#f7f6f2"/>
  <rect x="26" y="60" width="428" height="8" fill="#f7f6f2"/>
  <circle cx="48" cy="47" r="6" fill="#e8453c"/>
  <circle cx="68" cy="47" r="6" fill="#f2a33c"/>
  <circle cx="88" cy="47" r="6" fill="#16a47e"/>
  <rect x="112" y="40" width="${skill.app.length * 9}" height="14" rx="7" fill="#d7d4cc"/>
  <rect x="42" y="86" width="44" height="232" rx="8" fill="#f2f0ea"/>
  <rect x="52" y="100" width="24" height="8" rx="4" fill="${skill.accent}"/>
  <rect x="52" y="120" width="24" height="8" rx="4" fill="#cfd2d8"/>
  <rect x="52" y="140" width="24" height="8" rx="4" fill="#cfd2d8"/>
  ${rows.join('\n  ')}
  <rect x="86" y="78" width="${140 + skill.rows * 6}" height="12" rx="6" fill="#16181d" opacity="0.75"/>
  ${
    done
      ? `<g><rect x="292" y="286" width="154" height="34" rx="17" fill="${skill.accent}"/><path d="M312 303 l7 7 l14 -15" stroke="#ffffff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="344" y="298" width="86" height="10" rx="5" fill="#ffffff" opacity="0.9"/></g>`
      : ''
  }
  <g transform="translate(${cursorX} ${cursorY})">
    <path d="M0 0 L0 18 L4.6 13.6 L7.6 20 L11 18.4 L8 12.2 L14 12 Z" fill="#16181d" stroke="#ffffff" stroke-width="1.4"/>
  </g>
</svg>`
}

function skillMarkdown(skill) {
  return `---
name: ${skill.name}
description: ${skill.description}
tags: [${skill.tags.join(', ')}]
preview: preview.gif
---

# ${skill.name}

${skill.description}

## Steps

1. Open the source file.
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
      delay: 8,
      width: WIDTH,
      height: HEIGHT
    })
    console.log(`[demo] ${skill.dir}`)
  }
}

await main()
