/**
 * Exports the widget parts as glTF binary files.
 * The application builds the same shapes at run time. These files serve design and documentation.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape, Color } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

// The exporter reads binary buffers through a file reader.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    constructor() {
      this.result = null
      this.onloadend = null
      this.onerror = null
    }

    readAsArrayBuffer(blob) {
      blob
        .arrayBuffer()
        .then((buffer) => {
          this.result = buffer
          if (this.onloadend) this.onloadend()
        })
        .catch((error) => {
          if (this.onerror) this.onerror(error)
        })
    }
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'assets', 'models')

const INK = new Color('#16181d')
const PAPER = new Color('#ffffff')
const BODY = new Color('#faf8f4')

function roundedRectShape(width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  const x = -width / 2
  const y = -height / 2
  const shape = new Shape()
  shape.moveTo(x + r, y)
  shape.lineTo(x + width - r, y)
  shape.quadraticCurveTo(x + width, y, x + width, y + r)
  shape.lineTo(x + width, y + height - r)
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  shape.lineTo(x + r, y + height)
  shape.quadraticCurveTo(x, y + height, x, y + height - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)
  return shape
}

function arrowShape(width, height, dir) {
  const w = width / 2
  const h = height / 2
  const stem = h * 0.4
  const head = w * 0.28
  const shape = new Shape()
  shape.moveTo(-w * dir, stem)
  shape.lineTo(head * dir, stem)
  shape.lineTo(head * dir, h)
  shape.lineTo(w * dir, 0)
  shape.lineTo(head * dir, -h)
  shape.lineTo(head * dir, -stem)
  shape.lineTo(-w * dir, -stem)
  shape.closePath()
  return shape
}

function circleShape(radius) {
  const shape = new Shape()
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false)
  return shape
}

function extrude(shape, depth, bevel, segments = 10) {
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: segments
  })
  geometry.center()
  geometry.computeVertexNormals()
  return geometry
}

function roundedBox(width, height, depth, radius, bevel = Math.min(0.02, depth / 4)) {
  return extrude(
    roundedRectShape(width - bevel * 2, height - bevel * 2, radius),
    depth - bevel * 2,
    bevel
  )
}

function material(color, roughness = 0.5) {
  return new MeshStandardMaterial({ color, roughness, metalness: 0.02 })
}

function keyCap(name, iconShape, iconColor) {
  const group = new Group()
  group.name = name
  const socket = new Mesh(roundedBox(1.16, 0.66, 0.05, 0.11), material(INK, 0.9))
  socket.position.z = -0.02
  socket.name = `${name}-socket`
  const cap = new Mesh(roundedBox(1.12, 0.62, 0.1, 0.095), material(PAPER, 0.42))
  cap.position.z = 0.03
  cap.name = `${name}-cap`
  const icon = new Mesh(extrude(iconShape, 0.028, 0.008, 24), material(iconColor, 0.34))
  icon.position.z = 0.085
  icon.name = `${name}-icon`
  group.add(socket, cap, icon)
  return group
}

function card() {
  const group = new Group()
  group.name = 'card'
  const edge = new Mesh(roundedBox(3.0, 1.6, 0.035, 0.095), material(INK, 0.9))
  edge.position.z = -0.012
  const face = new Mesh(roundedBox(2.95, 1.55, 0.04, 0.08), material(PAPER, 0.62))
  group.add(edge, face)
  return group
}

function body() {
  const group = new Group()
  group.name = 'body'
  const outline = new Mesh(roundedBox(5.0, 3.4, 0.13, 0.19), material(INK, 0.9))
  outline.position.z = -0.045
  const panel = new Mesh(roundedBox(4.91, 3.31, 0.16, 0.16), material(BODY, 0.5))
  group.add(outline, panel)
  return group
}

const SIZE = 0.3
const KEYS = [
  ['key-undo', arrowShape(SIZE, SIZE * 0.86, -1), new Color('#4c6fff')],
  ['key-stop', roundedRectShape(SIZE * 0.74, SIZE * 0.74, SIZE * 0.16), new Color('#2b2f36')],
  ['key-record', circleShape(SIZE * 0.44), new Color('#e8453c')],
  ['key-play', arrowShape(SIZE, SIZE * 0.86, 1), new Color('#16a47e')]
]

function widget() {
  const group = new Group()
  group.name = 'tasker-widget'
  group.add(body())
  const deck = new Group()
  deck.name = 'deck'
  KEYS.forEach(([name, shape, color], index) => {
    const key = keyCap(name, shape, color)
    key.position.set(-1.86 + index * 1.24, -1.16, 0.12)
    deck.add(key)
  })
  const stack = new Group()
  stack.name = 'rolodex'
  for (let index = 0; index < 4; index += 1) {
    const item = card()
    item.position.set(-0.85, 0.45 + index * 0.115, 0.14 - index * 0.012)
    item.scale.setScalar(1 - index * 0.02)
    stack.add(item)
  }
  const preview = new Group()
  preview.name = 'preview'
  const previewEdge = new Mesh(roundedBox(1.29, 1.85, 0.035, 0.09), material(INK, 0.9))
  previewEdge.position.z = -0.012
  const previewFace = new Mesh(
    roundedBox(1.25, 1.81, 0.04, 0.08),
    material(new Color('#f2f0ea'), 0.7)
  )
  preview.add(previewEdge, previewFace)
  preview.position.set(1.78, 0.45, 0.14)
  group.add(deck, stack, preview)
  return group
}

async function save(object, file) {
  const exporter = new GLTFExporter()
  const buffer = await new Promise((resolve, reject) => {
    exporter.parse(object, resolve, reject, { binary: true, onlyVisible: false })
  })
  await writeFile(file, Buffer.from(buffer))
  console.log(`[models] ${file.replace(root + '/', '')}`)
}

async function main() {
  await mkdir(outDir, { recursive: true })
  await save(widget(), join(outDir, 'tasker-widget.glb'))
  await save(card(), join(outDir, 'card.glb'))
  for (const [name, shape, color] of KEYS) {
    await save(keyCap(name, shape, color), join(outDir, `${name}.glb`))
  }
}

await main()
