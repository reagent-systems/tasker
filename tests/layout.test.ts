import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeLayout } from '../src/renderer/three/layout.js'

const ASPECTS = [1.4375, 1.2, 1.8, 0.9]

test('the layout has four keys', () => {
  for (const aspect of ASPECTS) {
    assert.equal(computeLayout(aspect).keys.length, 4)
  }
})

test('the keys stay inside the body', () => {
  for (const aspect of ASPECTS) {
    const layout = computeLayout(aspect)
    for (const key of layout.keys) {
      assert.ok(key.x - key.width / 2 >= -layout.body.width / 2)
      assert.ok(key.x + key.width / 2 <= layout.body.width / 2)
      assert.ok(key.y - key.height / 2 >= -layout.body.height / 2)
    }
  }
})

test('the keys do not overlap', () => {
  const keys = computeLayout(1.4375).keys
  for (let index = 1; index < keys.length; index += 1) {
    const previous = keys[index - 1]
    const current = keys[index]
    assert.ok(previous && current)
    assert.ok(previous.x + previous.width / 2 <= current.x - current.width / 2 + 1e-9)
  }
})

test('the rolodex and the preview do not overlap', () => {
  for (const aspect of ASPECTS) {
    const layout = computeLayout(aspect)
    const rolodexRight = layout.rolodex.x + layout.rolodex.width / 2
    const previewLeft = layout.preview.x - layout.preview.width / 2
    assert.ok(previewLeft >= rolodexRight)
  }
})

test('the card zone sits above the key row', () => {
  const layout = computeLayout(1.4375)
  const zoneBottom = layout.rolodex.y - layout.rolodex.height / 2
  const keyTop = (layout.keys[0]?.y ?? 0) + (layout.keys[0]?.height ?? 0) / 2
  assert.ok(zoneBottom >= keyTop)
})

test('the body fits the view', () => {
  const layout = computeLayout(1.4375)
  assert.ok(layout.body.width < layout.viewWidth)
  assert.ok(layout.body.height < layout.viewHeight)
})
