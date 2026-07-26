import { ExtrudeGeometry, Shape, type BufferGeometry } from 'three'

export interface ExtrudeOptions {
  depth: number
  bevel: number
  segments?: number
}

/** Builds a rounded rectangle that centers on the origin. */
export function roundedRectShape(width: number, height: number, radius: number): Shape {
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

/** Right pointing arrow. A negative `dir` mirrors the arrow. */
export function arrowShape(width: number, height: number, dir: 1 | -1 = 1): Shape {
  const w = width / 2
  const h = height / 2
  const stem = h * 0.4
  const headWidth = w * 0.28
  const shape = new Shape()
  shape.moveTo(-w * dir, stem)
  shape.lineTo(headWidth * dir, stem)
  shape.lineTo(headWidth * dir, h)
  shape.lineTo(w * dir, 0)
  shape.lineTo(headWidth * dir, -h)
  shape.lineTo(headWidth * dir, -stem)
  shape.lineTo(-w * dir, -stem)
  shape.closePath()
  return shape
}

export function circleShape(radius: number): Shape {
  const shape = new Shape()
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false)
  return shape
}

export function extrude(shape: Shape, options: ExtrudeOptions): BufferGeometry {
  const geometry = new ExtrudeGeometry(shape, {
    depth: options.depth,
    bevelEnabled: options.bevel > 0,
    bevelThickness: options.bevel,
    bevelSize: options.bevel,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: options.segments ?? 24
  })
  geometry.center()
  geometry.computeVertexNormals()
  return geometry
}

/** Rounded box for panels, cards and key caps. */
export function roundedBox(
  width: number,
  height: number,
  depth: number,
  radius: number,
  bevel = Math.min(0.02, depth / 4)
): BufferGeometry {
  return extrude(roundedRectShape(width - bevel * 2, height - bevel * 2, radius), {
    depth: depth - bevel * 2,
    bevel
  })
}
