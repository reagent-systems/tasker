import { Color } from 'three'

export type ThemeName = 'light' | 'dark'

export interface Palette {
  background: Color
  body: Color
  bodyEdge: Color
  ink: Color
  card: Color
  cardEdge: Color
  cardText: Color
  cardSubText: Color
  slot: Color
  keyCap: Color
  undo: Color
  stop: Color
  record: Color
  play: Color
  keyIcon: Color
  lampOff: Color
  ambient: Color
  key: Color
  rim: Color
}

const LIGHT: Palette = {
  background: new Color('#eceae4'),
  body: new Color('#fbfaf7'),
  bodyEdge: new Color('#16181d'),
  ink: new Color('#16181d'),
  card: new Color('#ffffff'),
  cardEdge: new Color('#16181d'),
  cardText: new Color('#14161a'),
  cardSubText: new Color('#6a6f7a'),
  slot: new Color('#f2f0ea'),
  keyCap: new Color('#ffffff'),
  undo: new Color('#4c6fff'),
  stop: new Color('#2b2f36'),
  record: new Color('#e8453c'),
  play: new Color('#16a47e'),
  keyIcon: new Color('#16181d'),
  lampOff: new Color('#c9c6bd'),
  ambient: new Color('#f4f2ec'),
  key: new Color('#ffffff'),
  rim: new Color('#cfd6e6')
}

const DARK: Palette = {
  background: new Color('#101216'),
  body: new Color('#20242b'),
  bodyEdge: new Color('#05060a'),
  ink: new Color('#05060a'),
  card: new Color('#2b3038'),
  cardEdge: new Color('#05060a'),
  cardText: new Color('#f3f4f6'),
  cardSubText: new Color('#a2a9b6'),
  slot: new Color('#191d23'),
  keyCap: new Color('#2e333c'),
  undo: new Color('#6d8bff'),
  stop: new Color('#aab2be'),
  record: new Color('#ff5b52'),
  play: new Color('#2ecb99'),
  keyIcon: new Color('#0b0d11'),
  lampOff: new Color('#3a4049'),
  ambient: new Color('#232830'),
  key: new Color('#dfe4ee'),
  rim: new Color('#4d5b7a')
}

export function palette(theme: ThemeName): Palette {
  return theme === 'dark' ? DARK : LIGHT
}
