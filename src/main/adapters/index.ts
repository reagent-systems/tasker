import type { AdapterConfig, CommandSpec, Skill, TransportAction } from '@shared/types'
import { cliAdapter } from './cli.js'
import { commandAdapter } from './command.js'
import { desktopAdapter } from './desktop.js'

export interface Resolution {
  /** Command to spawn. `null` means the adapter reports the action and does nothing. */
  spec: CommandSpec | null
  /** Short machine readable summary for the journal. */
  label: string
}

export interface Adapter {
  id: AdapterConfig['id']
  resolve(action: TransportAction, skill: Skill | null, config: AdapterConfig): Resolution
}

const dryRunAdapter: Adapter = {
  id: 'dry-run',
  resolve(action, skill) {
    return { spec: null, label: `dry-run ${action} ${skill?.name ?? '-'}` }
  }
}

const ADAPTERS: Record<AdapterConfig['id'], Adapter> = {
  'dry-run': dryRunAdapter,
  command: commandAdapter,
  cli: cliAdapter,
  desktop: desktopAdapter
}

export function getAdapter(id: AdapterConfig['id']): Adapter {
  return ADAPTERS[id] ?? dryRunAdapter
}

/** Replaces `${skillName}`, `${skillDir}`, `${skillFile}` and `${skillId}`. */
export function expand(text: string, skill: Skill | null): string {
  return text
    .replaceAll('${skillName}', skill?.name ?? '')
    .replaceAll('${skillDir}', skill?.dir ?? '')
    .replaceAll('${skillFile}', skill?.file ?? '')
    .replaceAll('${skillId}', skill?.id ?? '')
    .replaceAll('${skill}', skill?.name ?? '')
}
