import { Group, Mesh, MeshStandardMaterial, type Object3D } from 'three'
import type { TransportAction } from '@shared/types'
import { TRANSPORT_ORDER } from '@shared/types'
import type { Rect } from './layout.js'
import type { Palette } from './palette.js'
import { arrowShape, circleShape, extrude, roundedBox, roundedRectShape } from './shapes.js'

const TRAVEL = 0.052

interface Key {
  action: TransportAction
  group: Group
  cap: Mesh
  icon: Mesh
  socket: Mesh
  press: number
  hover: number
  active: boolean
}

function iconGeometry(action: TransportAction, size: number): ReturnType<typeof extrude> {
  const depth = 0.028
  const bevel = 0.008
  if (action === 'undo') return extrude(arrowShape(size, size * 0.86, -1), { depth, bevel })
  if (action === 'play') return extrude(arrowShape(size, size * 0.86, 1), { depth, bevel })
  if (action === 'record') return extrude(circleShape(size * 0.44), { depth, bevel, segments: 48 })
  return extrude(roundedRectShape(size * 0.74, size * 0.74, size * 0.16), { depth, bevel })
}

function iconColor(action: TransportAction, colors: Palette): Palette['undo'] {
  if (action === 'undo') return colors.undo
  if (action === 'play') return colors.play
  if (action === 'record') return colors.record
  return colors.stop
}

/** Row of transport keys. The keys look and move like the keys of a cassette player. */
export class Deck {
  readonly group = new Group()
  private keys: Key[] = []

  constructor(
    rects: Rect[],
    private colors: Palette
  ) {
    TRANSPORT_ORDER.forEach((action, index) => {
      const rect = rects[index]
      if (!rect) return
      this.keys.push(this.createKey(action, rect))
    })
  }

  private createKey(action: TransportAction, rect: Rect): Key {
    const group = new Group()
    group.position.set(rect.x, rect.y, 0.12)

    const socket = new Mesh(
      roundedBox(rect.width, rect.height, 0.05, 0.11),
      new MeshStandardMaterial({ color: this.colors.cardEdge, roughness: 0.92 })
    )
    socket.position.z = -0.02

    const cap = new Mesh(
      roundedBox(rect.width - 0.045, rect.height - 0.045, 0.1, 0.095),
      new MeshStandardMaterial({
        color: this.colors.keyCap,
        roughness: 0.42,
        metalness: 0.02
      })
    )
    cap.position.z = 0.03
    cap.castShadow = true
    cap.receiveShadow = true

    const size = Math.min(rect.height * 0.52, rect.width * 0.36)
    const icon = new Mesh(
      iconGeometry(action, size),
      new MeshStandardMaterial({
        color: iconColor(action, this.colors),
        roughness: 0.34,
        metalness: 0.1,
        emissive: iconColor(action, this.colors),
        emissiveIntensity: 0
      })
    )
    icon.position.z = 0.085
    icon.castShadow = true

    group.add(socket, cap, icon)
    this.group.add(group)
    return { action, group, cap, icon, socket, press: 0, hover: 0, active: false }
  }

  setColors(colors: Palette): void {
    this.colors = colors
    for (const key of this.keys) {
      ;(key.cap.material as MeshStandardMaterial).color.copy(colors.keyCap)
      ;(key.socket.material as MeshStandardMaterial).color.copy(colors.cardEdge)
      const material = key.icon.material as MeshStandardMaterial
      material.color.copy(iconColor(key.action, colors))
      material.emissive.copy(iconColor(key.action, colors))
    }
  }

  /** Objects for the ray caster. */
  targets(): Object3D[] {
    return this.keys.map((key) => key.cap)
  }

  actionOf(object: Object3D): TransportAction | null {
    const key = this.keys.find((item) => item.cap === object || item.group === object.parent)
    return key?.action ?? null
  }

  setHover(action: TransportAction | null): void {
    for (const key of this.keys) key.hover = key.action === action ? 1 : 0
  }

  push(action: TransportAction): void {
    const key = this.keys.find((item) => item.action === action)
    if (key) key.press = 1
  }

  /** Marks the key that reports the current state. */
  setActive(action: TransportAction | null): void {
    for (const key of this.keys) key.active = key.action === action
  }

  update(elapsed: number, dt: number): void {
    for (const key of this.keys) {
      const held = key.active ? 0.55 : 0
      const goal = Math.max(key.press, held)
      key.press += (goal - key.press) * Math.min(1, dt * 9)
      if (key.press < 0.002) key.press = 0

      const lift = key.hover * 0.012
      key.cap.position.z = 0.03 - key.press * TRAVEL + lift
      key.icon.position.z = 0.085 - key.press * TRAVEL + lift
      key.cap.scale.setScalar(1 - key.press * 0.022)
      key.icon.scale.setScalar(1 - key.press * 0.022)

      // A pressed key sits deeper in the socket, so the cap takes less light.
      const cap = key.cap.material as MeshStandardMaterial
      cap.color.copy(this.colors.keyCap).lerp(this.colors.lampOff, key.press * 0.8)

      const material = key.icon.material as MeshStandardMaterial
      if (key.active && key.action === 'record') {
        material.emissiveIntensity = 0.4 + Math.sin(elapsed / 260) * 0.28
      } else if (key.active) {
        material.emissiveIntensity = 0.25
      } else {
        material.emissiveIntensity = key.hover * 0.12
      }
    }
  }
}
