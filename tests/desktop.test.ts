import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  linuxCommand,
  macCommand,
  parseSequence,
  windowsCommand
} from '../src/main/adapters/desktop.js'

test('reads a key sequence', () => {
  assert.deepEqual(parseSequence('cmd+shift+r'), { modifiers: ['cmd', 'shift'], key: 'r' })
  assert.deepEqual(parseSequence('esc'), { modifiers: [], key: 'esc' })
  assert.equal(parseSequence(''), null)
})

test('builds an AppleScript command', () => {
  const command = macCommand('Claude', { modifiers: ['cmd', 'shift'], key: 'r' })
  assert.equal(command.program, 'osascript')
  const script = command.args[1] ?? ''
  assert.match(script, /tell application "Claude" to activate/)
  assert.match(script, /keystroke "r" using \{command down, shift down\}/)
})

test('uses key codes for named keys on macOS', () => {
  const command = macCommand('Claude', { modifiers: [], key: 'esc' })
  assert.match(command.args[1] ?? '', /key code 53/)
})

test('escapes quotation marks in the application name', () => {
  const command = macCommand('My "App"', { modifiers: [], key: 'a' })
  assert.match(command.args[1] ?? '', /My \\"App\\"/)
})

test('builds a PowerShell command', () => {
  const command = windowsCommand('Claude', { modifiers: ['ctrl', 'shift'], key: 'r' })
  assert.equal(command.program, 'powershell')
  const script = command.args[3] ?? ''
  assert.match(script, /AppActivate\('Claude'\)/)
  assert.match(script, /SendKeys\('\^\+r'\)/)
})

test('builds an xdotool command', () => {
  const command = linuxCommand('Claude', { modifiers: ['ctrl'], key: 'esc' })
  assert.equal(command.program, 'xdotool')
  assert.deepEqual(command.args, [
    'search',
    '--name',
    'Claude',
    'windowactivate',
    '--sync',
    'key',
    '--clearmodifiers',
    'ctrl+Escape'
  ])
})

test('never uses a shell string', () => {
  const command = macCommand('Claude', { modifiers: [], key: 'a' })
  assert.equal(Array.isArray(command.args), true)
})
