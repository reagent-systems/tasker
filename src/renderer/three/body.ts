import { Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, SphereGeometry } from 'three'
import type { Palette } from './palette.js'
import type { Layout } from './layout.js'
import { roundedBox } from './shapes.js'

export interface BodyParts {
  group: Group
  lamp: Mesh<SphereGeometry, MeshStandardMaterial>
  setColors(colors: Palette): void
}

/** Builds the shell of the widget: outline, panel, grip and status lamp. */
export function createBody(layout: Layout, colors: Palette): BodyParts {
  const group = new Group()

  const outlineMaterial = new MeshStandardMaterial({
    color: colors.bodyEdge,
    roughness: 0.9,
    metalness: 0
  })
  const outline = new Mesh(
    roundedBox(layout.body.width + 0.09, layout.body.height + 0.09, 0.13, 0.19),
    outlineMaterial
  )
  outline.position.z = -0.045
  group.add(outline)

  const panelMaterial = new MeshPhysicalMaterial({
    color: colors.body,
    roughness: 0.5,
    metalness: 0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.55,
    reflectivity: 0.25
  })
  const panel = new Mesh(
    roundedBox(layout.body.width, layout.body.height, 0.16, 0.16),
    panelMaterial
  )
  panel.castShadow = true
  panel.receiveShadow = true
  group.add(panel)

  const gripMaterial = new MeshStandardMaterial({
    color: colors.lampOff,
    roughness: 0.75,
    metalness: 0.05
  })
  const grip = new Mesh(
    roundedBox(layout.grip.width, layout.grip.height, 0.03, layout.grip.height / 2),
    gripMaterial
  )
  grip.position.set(layout.grip.x, layout.grip.y, 0.085)
  group.add(grip)

  const lampMaterial = new MeshStandardMaterial({
    color: colors.lampOff,
    emissive: colors.lampOff,
    emissiveIntensity: 0.1,
    roughness: 0.3
  })
  const lamp = new Mesh(new SphereGeometry(layout.lamp.radius, 24, 16), lampMaterial)
  lamp.position.set(layout.lamp.x, layout.lamp.y, 0.09)
  group.add(lamp)

  return {
    group,
    lamp,
    setColors(next: Palette): void {
      outlineMaterial.color.copy(next.bodyEdge)
      panelMaterial.color.copy(next.body)
      gripMaterial.color.copy(next.lampOff)
    }
  }
}
