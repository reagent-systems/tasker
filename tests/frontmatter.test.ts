import assert from 'node:assert/strict'
import { test } from 'node:test'
import { asList, asString, parseFrontmatter } from '../src/main/skills/frontmatter.js'

test('reads scalar keys', () => {
  const { data, body } = parseFrontmatter(
    ['---', 'name: Invoice Export', 'description: Exports invoices.', '---', '# Title'].join('\n')
  )
  assert.equal(data.name, 'Invoice Export')
  assert.equal(data.description, 'Exports invoices.')
  assert.equal(body.trim(), '# Title')
})

test('removes quotation marks', () => {
  const { data } = parseFrontmatter(['---', 'name: "Ticket Triage"', "meta: 'x'", '---'].join('\n'))
  assert.equal(data.name, 'Ticket Triage')
  assert.equal(data.meta, 'x')
})

test('reads inline lists', () => {
  const { data } = parseFrontmatter(['---', 'tags: [finance, export]', '---'].join('\n'))
  assert.deepEqual(data.tags, ['finance', 'export'])
})

test('reads block lists', () => {
  const { data } = parseFrontmatter(
    ['---', 'tags:', '  - finance', '  - export', 'name: X', '---'].join('\n')
  )
  assert.deepEqual(data.tags, ['finance', 'export'])
  assert.equal(data.name, 'X')
})

test('returns the full text when the file has no frontmatter', () => {
  const text = '# Skill\n\nSteps.'
  const { data, body } = parseFrontmatter(text)
  assert.deepEqual(data, {})
  assert.equal(body, text)
})

test('returns the full text when the block does not close', () => {
  const text = '---\nname: X\n\n# Skill'
  const { body } = parseFrontmatter(text)
  assert.equal(body, text)
})

test('converts values to strings and lists', () => {
  assert.equal(asString(['a', 'b']), 'a, b')
  assert.equal(asString(undefined), '')
  assert.deepEqual(asList('a, b'), ['a', 'b'])
  assert.deepEqual(asList(undefined), [])
})

test('accepts carriage returns', () => {
  const { data } = parseFrontmatter('---\r\nname: X\r\n---\r\nbody')
  assert.equal(data.name, 'X')
})
