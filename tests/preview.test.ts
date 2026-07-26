import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  advance,
  autoZoom,
  cropRect,
  selectFrames,
  smoothPath,
  startPath
} from '../src/renderer/three/preview.js'

const PANEL = 0.7

test('a wide recording gets a zoom', () => {
  assert.ok(autoZoom(1920, 1080) > 1)
  assert.ok(autoZoom(1280, 800) > 1)
  assert.ok(autoZoom(720, 450) > 1)
})

test('an upright recording keeps the zoom at one', () => {
  assert.equal(autoZoom(400, 600), 1)
  assert.equal(autoZoom(0, 0), 1)
})

test('the crop keeps the panel aspect', () => {
  const rect = cropRect(1280, 800, PANEL, 1.7, { x: 0.5, y: 0.5 })
  assert.ok(Math.abs(rect.width / rect.height - PANEL) < 1e-6)
})

test('the crop stays inside the recording', () => {
  for (const focus of [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 0.5, y: 0.5 },
    { x: -2, y: 3 }
  ]) {
    const rect = cropRect(1280, 800, PANEL, 1.7, focus)
    assert.ok(rect.x >= 0)
    assert.ok(rect.y >= 0)
    assert.ok(rect.x + rect.width <= 1280 + 1e-9)
    assert.ok(rect.y + rect.height <= 800 + 1e-9)
  }
})

test('the crop follows the focus point', () => {
  const left = cropRect(1280, 800, PANEL, 1.7, { x: 0.25, y: 0.5 })
  const right = cropRect(1280, 800, PANEL, 1.7, { x: 0.75, y: 0.5 })
  assert.ok(right.x > left.x)
})

test('a stronger zoom gives a smaller crop', () => {
  const wide = cropRect(1280, 800, PANEL, 1.2, { x: 0.5, y: 0.5 })
  const close = cropRect(1280, 800, PANEL, 2.4, { x: 0.5, y: 0.5 })
  assert.ok(close.width < wide.width)
})

test('the path loses the steps', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 0 }
  ]
  const smooth = smoothPath(path, 5)
  assert.equal(smooth.length, path.length)
  const middle = smooth[2]
  assert.ok(middle)
  assert.ok(middle.x > 0.2 && middle.x < 0.8)
})

test('the path starts at the first found point', () => {
  const filled = startPath([
    { x: 0.5, y: 0.5 },
    { x: 0.5, y: 0.5 },
    { x: 0.2, y: 0.8 }
  ])
  assert.deepEqual(filled[0], { x: 0.2, y: 0.8 })
  assert.deepEqual(filled[1], { x: 0.2, y: 0.8 })
})

test('every frame stays when the memory is enough', () => {
  assert.deepEqual(selectFrames(4, 1000), [0, 1, 2, 3])
  // A crop of a 720 by 450 recording holds 210 by 300 pixels.
  assert.equal(selectFrames(84, 210 * 300 * 4).length, 84)
})

test('the forward mode returns to the first frame', () => {
  let head = { index: 2, direction: 1 as const }
  head = advance(head, 4, false)
  assert.equal(head.index, 3)
  head = advance(head, 4, false)
  assert.equal(head.index, 0)
})

test('the pingpong mode turns at each end', () => {
  const count = 4
  let head: { index: number; direction: 1 | -1 } = { index: 0, direction: 1 }
  const path = [head.index]
  for (let step = 0; step < 8; step += 1) {
    head = advance(head, count, true)
    path.push(head.index)
  }
  assert.deepEqual(path, [0, 1, 2, 3, 2, 1, 0, 1, 2])
})

test('the pingpong mode shows no frame two times in a row', () => {
  let head: { index: number; direction: 1 | -1 } = { index: 0, direction: 1 }
  let previous = head.index
  for (let step = 0; step < 40; step += 1) {
    head = advance(head, 6, true)
    assert.notEqual(head.index, previous)
    assert.ok(head.index >= 0 && head.index < 6)
    previous = head.index
  }
})

test('one frame stays at the first frame', () => {
  const head = advance({ index: 0, direction: 1 }, 1, true)
  assert.deepEqual(head, { index: 0, direction: 1 })
})

test('a long recording loses frames in one pattern', () => {
  const picked = selectFrames(1000, 4 * 1024 * 1024)
  assert.ok(picked.length < 1000)
  assert.ok(picked.length >= 8)
  for (let index = 1; index < picked.length; index += 1) {
    assert.ok((picked[index] ?? 0) > (picked[index - 1] ?? 0))
  }
  assert.equal(picked[0], 0)
})
