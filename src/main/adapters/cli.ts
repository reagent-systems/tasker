import type { Adapter } from './index.js'
import { expand } from './index.js'

/**
 * Sends a prompt to the Claude command line interface.
 * The adapter serves the play action. The record action needs the desktop application.
 */
export const cliAdapter: Adapter = {
  id: 'cli',
  resolve(action, skill, config) {
    const program = config.cliProgram || 'claude'
    if (action === 'play') {
      if (!skill) return { spec: null, label: 'cli play needs a skill' }
      const prompt = expand(config.cliPromptTemplate, skill)
      return { spec: { program, args: ['-p', prompt], cwd: skill.dir }, label: 'cli play' }
    }
    if (action === 'undo') {
      if (!skill) return { spec: null, label: 'cli undo needs a skill' }
      return {
        spec: { program, args: ['-p', `Undo the last change of the ${skill.name} skill.`] },
        label: 'cli undo'
      }
    }
    return { spec: null, label: `cli ${action} is not available` }
  }
}
