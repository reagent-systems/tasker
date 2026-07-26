import type { Adapter } from './index.js'
import { expand } from './index.js'

/**
 * Runs a user defined program for each transport action.
 * The command list comes from the configuration file. Tasker starts the program directly.
 * No shell interprets the arguments.
 */
export const commandAdapter: Adapter = {
  id: 'command',
  resolve(action, skill, config) {
    const spec = config.commands[action]
    if (!spec || !spec.program) {
      return { spec: null, label: `command ${action} not configured` }
    }
    return {
      spec: {
        program: expand(spec.program, skill),
        args: (spec.args ?? []).map((arg) => expand(arg, skill))
      },
      label: `command ${action}`
    }
  }
}
