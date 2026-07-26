import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from 'three'
import type { Skill } from '@shared/types'
import type { Rect } from './layout.js'
import type { Palette } from './palette.js'
import { createPreview, type PreviewSource } from './preview.js'
import { roundedBox } from './shapes.js'

/** Panel that plays the preview of the selected skill. */
export class PreviewPanel {
  readonly group = new Group()
  private screen: Mesh<PlaneGeometry, MeshBasicMaterial>
  private source: PreviewSource | null = null
  private skillId: string | null = null
  private frame: Mesh
  private frameAspect: number

  constructor(
    rect: Rect,
    private colors: Palette,
    private readonly media: HTMLElement
  ) {
    this.group.position.set(rect.x, rect.y, 0.14)
    this.frameAspect = (rect.width - 0.07) / (rect.height - 0.07)

    const edge = new Mesh(
      roundedBox(rect.width + 0.035, rect.height + 0.035, 0.035, 0.09),
      new MeshStandardMaterial({ color: colors.cardEdge, roughness: 0.9 })
    )
    edge.position.z = -0.012
    this.frame = new Mesh(
      roundedBox(rect.width, rect.height, 0.04, 0.08),
      new MeshStandardMaterial({ color: colors.slot, roughness: 0.7 })
    )
    this.screen = new Mesh(
      new PlaneGeometry(rect.width - 0.07, rect.height - 0.07),
      new MeshBasicMaterial({ transparent: true })
    )
    this.screen.position.z = 0.024
    this.group.add(edge, this.frame, this.screen)
  }

  setColors(colors: Palette): void {
    this.colors = colors
    ;(this.frame.material as MeshStandardMaterial).color.copy(colors.slot)
  }

  setSkill(skill: Skill | null): void {
    if (skill?.id === this.skillId) return
    this.skillId = skill?.id ?? null
    this.source?.dispose()
    this.source = createPreview(
      skill?.preview ?? { kind: 'none', url: null },
      this.media,
      `#${this.colors.cardSubText.getHexString()}`,
      `#${this.colors.slot.getHexString()}`
    )
    this.screen.material.map = this.source.texture
    this.screen.material.needsUpdate = true
    this.screen.scale.setScalar(0.94)
  }

  update(elapsed: number, dt: number): void {
    this.source?.update(elapsed)
    this.cover()
    const scale = this.screen.scale.x
    if (scale < 1) this.screen.scale.setScalar(Math.min(1, scale + dt * 1.6))
  }

  /** Fits the preview into the frame without distortion. The image keeps the frame full. */
  private cover(): void {
    const texture = this.screen.material.map
    const image = texture?.image as { width?: number; height?: number } | undefined
    if (!texture || !image?.width || !image.height) return
    const source = image.width / image.height
    const frame = this.frameAspect
    const repeatX = source > frame ? frame / source : 1
    const repeatY = source > frame ? 1 : source / frame
    texture.repeat.set(repeatX, repeatY)
    texture.offset.set((1 - repeatX) / 2, (1 - repeatY) / 2)
    texture.needsUpdate = true
  }

  dispose(): void {
    this.source?.dispose()
    this.source = null
  }
}
