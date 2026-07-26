# Security

## Report a problem

Report a security problem through the GitHub security advisory page of this repository.
Do not open a public issue for a security problem.

Include this information:

1. The version of Tasker.
2. The operating system.
3. The steps that show the problem.
4. The effect of the problem.

The maintainers answer within seven days.

## Supported versions

| Version        | Support |
| -------------- | ------- |
| Latest release | Yes     |
| Older releases | No      |

## Design

Tasker limits the attack surface with these measures.

| Measure                 | Detail                                                                       |
| ----------------------- | ---------------------------------------------------------------------------- |
| Renderer isolation      | `contextIsolation`, `sandbox` and no node integration.                       |
| Fixed bridge            | The preload script exposes a fixed list of functions.                        |
| Content security policy | `default-src 'self'`. The asset scheme serves images and media only.         |
| No navigation           | The window blocks navigation. External links open in the system browser.     |
| Path check              | The asset protocol serves files inside the skill folders only.               |
| No shell                | Tasker starts a program with a list of arguments. No shell reads the string. |
| One child process       | The runner holds one child process. The stop key ends it.                    |
| No network              | Tasker makes no network call at run time.                                    |

## Risks that you accept

1. A skill folder holds instructions for Claude. Read a skill before you play it.
2. The `command` adapter starts the program that you configure. Check the command.
3. The `desktop` adapter sends key events to another application.
   macOS requires accessibility permission for this action.
4. A preview file comes from the skill folder. Tasker decodes it in the renderer sandbox.
