import type { Skill, TransportAction } from '@shared/types'
import { Widget } from './three/scene.js'
import type { ThemeName } from './three/palette.js'

const canvas = document.getElementById('stage') as HTMLCanvasElement | null
const media = document.getElementById('media') as HTMLElement | null
if (!canvas || !media) throw new Error('stage is missing')

function systemTheme(): ThemeName {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

let skills: Skill[] = []
let selected: Skill | null = null

const widget = new Widget(canvas, media, systemTheme(), {
  onAction: (action) => void run(action),
  onSelect: (skill) => {
    selected = skill
  },
  onOpen: (skill) => {
    if (skill) void window.tasker.openSkillFolder(skill.id)
  }
})

async function run(action: TransportAction): Promise<void> {
  const result = await window.tasker.run({ action, skillId: selected?.id ?? null })
  if (!result.ok) console.warn('[run]', result.message)
}

const KEY_ACTIONS: Record<string, TransportAction> = {
  Enter: 'play',
  ' ': 'play',
  r: 'record',
  R: 'record',
  s: 'stop',
  S: 'stop',
  Escape: 'stop',
  u: 'undo',
  U: 'undo',
  Backspace: 'undo'
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    widget.step(1)
    return
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    widget.step(-1)
    return
  }
  if (event.key === 'w' && (event.metaKey || event.ctrlKey)) {
    void window.tasker.hide()
    return
  }
  if (event.key === 'z' && (event.metaKey || event.ctrlKey)) {
    widget.press('undo')
    void run('undo')
    return
  }
  if (event.key === 'o' && (event.metaKey || event.ctrlKey)) {
    if (selected) void window.tasker.openSkillFolder(selected.id)
    return
  }
  const action = KEY_ACTIONS[event.key]
  if (!action) return
  if (event.key === 'Escape' && !event.shiftKey) {
    void window.tasker.hide()
    return
  }
  event.preventDefault()
  widget.press(action)
  void run(action)
})

window.addEventListener('resize', () => widget.resize())
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => widget.setTheme(systemTheme()))

window.tasker.onSkills((next) => {
  skills = next
  widget.setSkills(skills)
})
window.tasker.onStatus((status) => widget.setStatus(status))
window.tasker.onTransport((action) => {
  widget.press(action)
  void run(action)
})

async function boot(): Promise<void> {
  const state = await window.tasker.getState()
  if (new URLSearchParams(window.location.search).get('capture') === '1') {
    document.body.classList.add('capture')
  }
  skills = state.skills
  widget.setSkills(skills)
  widget.setStatus(state.status)
  if (state.config.theme !== 'system') widget.setTheme(state.config.theme)
  widget.start()
}

void boot()
