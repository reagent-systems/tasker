import {
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Object3D,
  type Texture
} from 'three'
import type { Skill } from '@shared/types'
import type { Rect } from './layout.js'
import type { Palette } from './palette.js'
import { roundedBox } from './shapes.js'
import { cardTexture } from './text.js'

const POOL = 7
const BEHIND = 3
const FLIP_ANGLE = -Math.PI * 0.62

interface Card {
  pivot: Group
  mesh: Group
  face: Mesh<PlaneGeometry, MeshBasicMaterial>
  body: Mesh
  edge: Mesh
  /** Skill index that the slot shows. `-1` means the slot is free. */
  index: number
}

/** Card deck that turns like a rolodex. The front card selects the skill. */
export class Rolodex {
  readonly group = new Group()
  private cards: Card[] = []
  private textures = new Map<string, Texture>()
  private skills: Skill[] = []
  private spin = 0
  private target = 0
  private cardWidth = 1
  private cardHeight = 1

  constructor(
    rect: Rect,
    private colors: Palette
  ) {
    this.group.position.set(rect.x, rect.y - rect.height * 0.06, 0.14)
    this.cardWidth = rect.width
    this.cardHeight = rect.height * 0.78
    for (let index = 0; index < POOL; index += 1) this.cards.push(this.createCard())
  }

  private createCard(): Card {
    const pivot = new Group()
    const mesh = new Group()
    const radius = 0.08

    const edge = new Mesh(
      roundedBox(this.cardWidth + 0.055, this.cardHeight + 0.055, 0.035, radius + 0.015),
      new MeshStandardMaterial({
        color: this.colors.cardEdge,
        roughness: 0.9,
        transparent: true,
        opacity: 1
      })
    )
    edge.position.z = -0.012

    const body = new Mesh(
      roundedBox(this.cardWidth, this.cardHeight, 0.04, radius),
      new MeshStandardMaterial({
        color: this.colors.card,
        roughness: 0.62,
        metalness: 0,
        transparent: true,
        opacity: 1
      })
    )
    body.castShadow = true

    const face = new Mesh(
      new PlaneGeometry(this.cardWidth - 0.06, this.cardHeight - 0.06),
      new MeshBasicMaterial({ transparent: true, opacity: 1 })
    )
    face.position.z = 0.023

    mesh.add(edge, body, face)
    mesh.position.y = -this.cardHeight / 2
    pivot.add(mesh)
    pivot.visible = false
    this.group.add(pivot)
    return { pivot, mesh, face, body, edge, index: -1 }
  }

  setColors(colors: Palette): void {
    this.colors = colors
    for (const card of this.cards) {
      ;(card.body.material as MeshStandardMaterial).color.copy(colors.card)
      ;(card.edge.material as MeshStandardMaterial).color.copy(colors.cardEdge)
    }
    this.clearTextures()
  }

  private clearTextures(): void {
    for (const texture of this.textures.values()) texture.dispose()
    this.textures.clear()
  }

  setSkills(skills: Skill[]): void {
    this.skills = skills
    this.clearTextures()
    if (this.target > skills.length - 1) this.target = Math.max(0, skills.length - 1)
    this.spin = this.target
  }

  get index(): number {
    return Math.round(this.target)
  }

  get current(): Skill | null {
    return this.skills[this.index] ?? null
  }

  step(delta: number): void {
    if (this.skills.length === 0) return
    const next = this.index + delta
    this.target = Math.min(this.skills.length - 1, Math.max(0, next))
  }

  setIndex(index: number): void {
    if (this.skills.length === 0) return
    this.target = Math.min(this.skills.length - 1, Math.max(0, index))
  }

  private texture(skill: Skill, position: number): Texture {
    const cached = this.textures.get(skill.id)
    if (cached) return cached
    const created = cardTexture(
      {
        title: skill.name,
        subtitle: skill.description,
        meta: skill.source,
        index: `${position + 1}/${this.skills.length}`
      },
      {
        background: `#${this.colors.card.getHexString()}`,
        title: `#${this.colors.cardText.getHexString()}`,
        subtitle: `#${this.colors.cardSubText.getHexString()}`,
        rule: `#${this.colors.lampOff.getHexString()}`
      },
      (this.cardWidth - 0.06) / (this.cardHeight - 0.06)
    )
    this.textures.set(skill.id, created)
    return created
  }

  /** Visible card bodies with the skill index of each card. */
  targets(): { object: Object3D; index: number }[] {
    return this.cards
      .filter((card) => card.pivot.visible && card.index >= 0)
      .map((card) => ({ object: card.body, index: card.index }))
  }

  /** Front card object. The scene uses it for hit tests. */
  frontObject(): Object3D | null {
    const card = this.cards.find((item) => item.pivot.visible && item.index === this.index)
    return card ? card.body : null
  }

  update(dt: number): void {
    this.spin += (this.target - this.spin) * Math.min(1, dt * 12)
    if (Math.abs(this.target - this.spin) < 0.0005) this.spin = this.target

    const base = Math.floor(this.spin)
    for (let slot = 0; slot < this.cards.length; slot += 1) {
      const card = this.cards[slot]
      if (!card) continue
      const index = base - 1 + slot
      const skill = this.skills[index]
      if (!skill || index < 0) {
        card.pivot.visible = false
        card.index = -1
        continue
      }
      const offset = index - this.spin
      if (offset > BEHIND + 0.6) {
        card.pivot.visible = false
        card.index = -1
        continue
      }
      card.pivot.visible = true
      card.index = index
      card.face.material.map = this.texture(skill, index)
      card.face.material.needsUpdate = true

      const top = this.cardHeight / 2
      card.pivot.position.set(0, top, 0)

      if (offset < 0) {
        const t = Math.min(1, -offset)
        if (t >= 0.999) {
          card.pivot.visible = false
          card.index = -1
          continue
        }
        const eased = t * t * (3 - 2 * t)
        card.pivot.rotation.x = FLIP_ANGLE * eased
        card.pivot.position.z = 0.07 * eased
        this.setOpacity(card, 1 - eased)
        card.mesh.scale.setScalar(1)
      } else {
        const k = Math.min(BEHIND, offset)
        card.pivot.rotation.x = k * 0.03
        card.pivot.position.y = top + k * 0.115
        card.pivot.position.z = -k * 0.012
        card.mesh.scale.setScalar(1 - k * 0.02)
        this.setOpacity(card, 1)
      }
      card.pivot.renderOrder = 100 - index
    }
  }

  private setOpacity(card: Card, value: number): void {
    const opacity = Math.max(0, Math.min(1, value))
    ;(card.body.material as MeshStandardMaterial).opacity = opacity
    ;(card.edge.material as MeshStandardMaterial).opacity = opacity
    card.face.material.opacity = opacity
  }

  dispose(): void {
    this.clearTextures()
  }
}
