# Configuration

Tasker reads one JSON file. Open the file from the tray menu.

| Platform | Path                                               |
| -------- | -------------------------------------------------- |
| macOS    | `~/Library/Application Support/Tasker/config.json` |
| Windows  | `%APPDATA%\Tasker\config.json`                     |
| Linux    | `~/.config/Tasker/config.json`                     |

Tasker writes the default file at the first start.
Tasker merges an incomplete file with the defaults.
A damaged file causes no failure. Tasker uses the defaults and writes a message to the log.

## Fields

| Field                       | Type                                     | Default                                        | Use                                                               |
| --------------------------- | ---------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| `skillRoots`                | list of strings                          | Platform folders                               | Folders that hold skill folders.                                  |
| `shortcut`                  | string                                   | `Command+Shift+Space` or `Control+Shift+Space` | Accelerator that shows and hides the window.                      |
| `transportShortcuts`        | object                                   | empty                                          | Accelerator for each key. An empty string disables one.           |
| `theme`                     | `system`, `light` or `dark`              | `system`                                       | Color theme.                                                      |
| `window.width`              | number                                   | `460`                                          | Window width in pixels.                                           |
| `window.height`             | number                                   | `320`                                          | Window height in pixels.                                          |
| `window.x`                  | number or `null`                         | `null`                                         | Window position. `null` centers the window.                       |
| `window.y`                  | number or `null`                         | `null`                                         | Window position.                                                  |
| `window.alwaysOnTop`        | boolean                                  | `true`                                         | Keep the window above other windows.                              |
| `window.opacity`            | number                                   | `1`                                            | Window opacity between 0 and 1.                                   |
| `window.hideOnBlur`         | boolean                                  | `false`                                        | Hide the window when it loses focus.                              |
| `adapter.id`                | `dry-run`, `command`, `cli` or `desktop` | `dry-run`                                      | Adapter for the transport keys.                                   |
| `adapter.commands`          | object                                   | empty                                          | Command for each key. The `command` adapter uses this field.      |
| `adapter.keys`              | object                                   | Platform keys                                  | Key sequence for each key. The `desktop` adapter uses this field. |
| `adapter.targetApp`         | string                                   | `Claude`                                       | Application that receives the key sequence.                       |
| `adapter.cliProgram`        | string                                   | `claude`                                       | Program of the `cli` adapter.                                     |
| `adapter.cliPromptTemplate` | string                                   | `Use the ${skillName} skill.`                  | Prompt of the `cli` adapter.                                      |
| `confirmBeforeRun`          | boolean                                  | `false`                                        | Reserved for a future release.                                    |
| `launchAtLogin`             | boolean                                  | `false`                                        | Start Tasker at login. The packaged application uses this field.  |

## Accelerator format

An accelerator uses the Electron format.
Join the parts with `+`.

| Part     | Values                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------- |
| Modifier | `Command`, `Control`, `CommandOrControl`, `Alt`, `Option`, `Shift`, `Super`                    |
| Key      | `A` to `Z`, `0` to `9`, `F1` to `F24`, `Space`, `Tab`, `Escape`, `Up`, `Down`, `Left`, `Right` |

Tasker writes a message to the log when a shortcut is already in use.

## Example

```json
{
  "version": 1,
  "skillRoots": ["/Users/me/.claude/skills", "/Users/me/work/skills"],
  "shortcut": "Command+Shift+Space",
  "transportShortcuts": { "record": "Command+Shift+R", "stop": "Command+Shift+S" },
  "theme": "system",
  "window": {
    "width": 460,
    "height": 320,
    "x": null,
    "y": null,
    "alwaysOnTop": true,
    "opacity": 1,
    "hideOnBlur": false
  },
  "adapter": {
    "id": "command",
    "commands": {
      "play": { "program": "claude", "args": ["-p", "Use the ${skillName} skill."] }
    },
    "keys": { "record": "cmd+shift+r", "stop": "esc" },
    "targetApp": "Claude",
    "cliProgram": "claude",
    "cliPromptTemplate": "Use the ${skillName} skill."
  },
  "confirmBeforeRun": false,
  "launchAtLogin": false
}
```

## Environment variables

| Variable              | Use                                                                        |
| --------------------- | -------------------------------------------------------------------------- |
| `TASKER_SKILL_ROOTS`  | Replace the skill folders. Separate the paths with the platform separator. |
| `TASKER_START_HIDDEN` | Set the value to `1` to start without the window.                          |
| `TASKER_CAPTURE`      | Set the value to `1` to run the screenshot mode.                           |
| `TASKER_CAPTURE_DIR`  | Output folder of the screenshot mode.                                      |
