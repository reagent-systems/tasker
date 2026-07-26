import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  ShadowMaterial,
  Vector2,
  WebGLRenderer,
  type MeshStandardMaterial,
  type SphereGeometry
} from 'three'
import type { RunStatus, Skill, TransportAction } from '@shared/types'
import { createBody, type BodyParts } from './body.js'
import { Deck } from './deck.js'
import { computeLayout, VIEW_HEIGHT, type Layout } from './layout.js'
import { palette, type Palette, type ThemeName } from './palette.js'
import { PreviewPanel } from './previewPanel.js'
import { Rolodex } from './rolodex.js'

const FOV = 28

export interface WidgetEvents {
  onAction(action: TransportAction): void
  onSelect(skill: Skill | null): void
  onOpen(skill: Skill | null): void
}

export class Widget {
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera: PerspectiveCamera
  private root = new Group()
  private layout: Layout
  private colors: Palette
  private theme: ThemeName
  private deck: Deck
  private rolodex: Rolodex
  private preview: PreviewPanel
  private lamp: Mesh<SphereGeometry, MeshStandardMaterial> | null = null
  private body: BodyParts | null = null
  private shadowPlane: Mesh<PlaneGeometry, ShadowMaterial> | null = null
  private hemisphere: HemisphereLight | null = null
  private keyLight: DirectionalLight | null = null
  private rimLight: DirectionalLight | null = null
  private pointer = new Vector2(-2, -2)
  private hasPointer = false
  private tilt = new Vector2(0, 0)
  private raycaster = new Raycaster()
  private last = 0
  private frame = 0
  private status: RunStatus = {
    state: 'idle',
    action: null,
    skillId: null,
    message: 'idle',
    startedAt: null
  }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly media: HTMLElement,
    theme: ThemeName,
    private readonly events: WidgetEvents
  ) {
    this.theme = theme
    this.colors = palette(theme)
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power'
    })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    const aspect = this.aspect()
    this.camera = new PerspectiveCamera(FOV, aspect, 0.1, 60)
    this.camera.position.set(0, 0, VIEW_HEIGHT / 2 / Math.tan((FOV / 2) * (Math.PI / 180)))
    this.layout = computeLayout(aspect)

    const parts = createBody(this.layout, this.colors)
    this.body = parts
    this.lamp = parts.lamp
    this.rolodex = new Rolodex(this.layout.rolodex, this.colors)
    this.preview = new PreviewPanel(this.layout.preview, this.colors, this.media)
    this.deck = new Deck(this.layout.keys, this.colors)

    this.root.add(parts.group, this.rolodex.group, this.preview.group, this.deck.group)
    this.scene.add(this.root)
    this.addLights()
    this.addShadowCatcher()
    this.resize()
    this.bindPointer()
  }

  private aspect(): number {
    const rect = this.canvas.getBoundingClientRect()
    return Math.max(0.4, rect.width / Math.max(1, rect.height))
  }

  private addLights(): void {
    const hemisphere = new HemisphereLight(
      this.colors.ambient.getHex(),
      this.colors.background.getHex(),
      0.9
    )
    this.hemisphere = hemisphere
    const key = new DirectionalLight(this.colors.key.getHex(), 2.1)
    this.keyLight = key
    key.position.set(-2.6, 3.4, 5.2)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.near = 1
    key.shadow.camera.far = 16
    key.shadow.camera.left = -4
    key.shadow.camera.right = 4
    key.shadow.camera.top = 3
    key.shadow.camera.bottom = -3
    key.shadow.radius = 3
    key.shadow.bias = -0.0012

    const rim = new DirectionalLight(this.colors.rim.getHex(), 0.85)
    rim.position.set(3.4, -1.6, 2.6)
    this.rimLight = rim

    this.scene.add(hemisphere, key, rim, new AmbientLight(0xffffff, 0.28))
  }

  private addShadowCatcher(): void {
    const plane = new Mesh(
      new PlaneGeometry(20, 20),
      new ShadowMaterial({ opacity: this.theme === 'dark' ? 0.34 : 0.16 })
    )
    plane.position.z = -0.42
    plane.receiveShadow = true
    this.shadowPlane = plane
    this.scene.add(plane)
  }

  private bindPointer(): void {
    this.canvas.addEventListener('pointermove', (event) => {
      const rect = this.canvas.getBoundingClientRect()
      this.pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )
      this.hasPointer = true
    })
    this.canvas.addEventListener('pointerleave', () => {
      this.pointer.set(-2, -2)
      this.hasPointer = false
    })
    this.canvas.addEventListener('pointerdown', () => this.handleClick())
    this.canvas.addEventListener('dblclick', () => this.events.onOpen(this.rolodex.current))
    this.canvas.addEventListener(
      'wheel',
      (event) => {
        if (Math.abs(event.deltaY) < 2) return
        this.rolodex.step(event.deltaY > 0 ? 1 : -1)
        this.events.onSelect(this.rolodex.current)
      },
      { passive: true }
    )
  }

  private pick(): { action: TransportAction | null; cardIndex: number | null } {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const keyHits = this.raycaster.intersectObjects(this.deck.targets(), false)
    const first = keyHits[0]
    if (first) return { action: this.deck.actionOf(first.object), cardIndex: null }

    const cards = this.rolodex.targets()
    const cardHits = this.raycaster.intersectObjects(
      cards.map((card) => card.object),
      false
    )
    const hit = cardHits[0]
    if (hit) {
      const match = cards.find((card) => card.object === hit.object)
      return { action: null, cardIndex: match?.index ?? null }
    }
    return { action: null, cardIndex: null }
  }

  private handleClick(): void {
    const { action, cardIndex } = this.pick()
    if (action) {
      this.deck.push(action)
      this.events.onAction(action)
      return
    }
    if (cardIndex === null) return
    if (cardIndex === this.rolodex.index) {
      this.deck.push('play')
      this.events.onAction('play')
      return
    }
    this.rolodex.setIndex(cardIndex)
    this.events.onSelect(this.rolodex.current)
  }

  setSkills(skills: Skill[]): void {
    this.rolodex.setSkills(skills)
    this.preview.setSkill(this.rolodex.current)
    this.events.onSelect(this.rolodex.current)
  }

  step(delta: number): void {
    this.rolodex.step(delta)
    this.events.onSelect(this.rolodex.current)
  }

  press(action: TransportAction): void {
    this.deck.push(action)
  }

  get currentSkill(): Skill | null {
    return this.rolodex.current
  }

  setStatus(status: RunStatus): void {
    this.status = status
    const busy = status.state === 'running' || status.state === 'recording'
    this.deck.setActive(busy ? status.action : null)
  }

  setTheme(theme: ThemeName): void {
    if (theme === this.theme) return
    this.theme = theme
    this.colors = palette(theme)
    this.body?.setColors(this.colors)
    this.rolodex.setColors(this.colors)
    this.preview.setColors(this.colors)
    this.deck.setColors(this.colors)
    if (this.shadowPlane) this.shadowPlane.material.opacity = theme === 'dark' ? 0.34 : 0.16
    this.hemisphere?.color.copy(this.colors.ambient)
    this.hemisphere?.groundColor.copy(this.colors.background)
    this.keyLight?.color.copy(this.colors.key)
    this.rimLight?.color.copy(this.colors.rim)
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width))
    const height = Math.max(1, Math.round(rect.height))
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private lampColor(): void {
    if (!this.lamp) return
    const material = this.lamp.material
    const map = {
      idle: this.colors.lampOff,
      starting: this.colors.undo,
      running: this.colors.play,
      recording: this.colors.record,
      error: this.colors.record
    }
    const color = map[this.status.state]
    material.color.copy(color)
    material.emissive.copy(color)
    material.emissiveIntensity = this.status.state === 'idle' ? 0.08 : 0.9
  }

  private tick = (time: number): void => {
    const dt = Math.min(0.05, (time - this.last) / 1000)
    this.last = time

    const hover = this.pick()
    this.deck.setHover(hover.action)
    this.canvas.style.cursor = hover.action || hover.cardIndex !== null ? 'pointer' : 'default'

    const goalX = this.hasPointer ? this.pointer.y * 0.05 : 0
    const goalY = this.hasPointer ? this.pointer.x * 0.07 : 0
    this.tilt.x += (goalX - this.tilt.x) * Math.min(1, dt * 6)
    this.tilt.y += (goalY - this.tilt.y) * Math.min(1, dt * 6)
    this.root.rotation.x = this.tilt.x
    this.root.rotation.y = this.tilt.y

    this.rolodex.update(dt)
    this.preview.setSkill(this.rolodex.current)
    this.preview.update(time, dt)
    this.deck.update(time, dt)
    this.lampColor()

    this.renderer.render(this.scene, this.camera)
    this.frame = requestAnimationFrame(this.tick)
  }

  start(): void {
    this.last = performance.now()
    this.frame = requestAnimationFrame(this.tick)
  }

  stop(): void {
    cancelAnimationFrame(this.frame)
  }
}
