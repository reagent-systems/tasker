# Adapters

An adapter translates a transport action into a command.
Tasker has four adapters. Select one with the `adapter.id` field.

The Claude desktop application has no public control interface.
Each adapter therefore uses a different route to the same result.

## dry-run

This adapter is the default. It starts no program.
It writes each action to the journal.
Use this adapter to check the skill list and the user interface.

```json
{ "adapter": { "id": "dry-run" } }
```

## command

This adapter starts a program that you define for each key.
Tasker starts the program directly. No shell reads the arguments.

```json
{
  "adapter": {
    "id": "command",
    "commands": {
      "play": { "program": "claude", "args": ["-p", "Use the ${skillName} skill."] },
      "record": { "program": "open", "args": ["-a", "Claude"] },
      "stop": { "program": "/usr/local/bin/stop-run.sh", "args": [] },
      "undo": { "program": "git", "args": ["-C", "${skillDir}", "revert", "--no-edit", "HEAD"] }
    }
  }
}
```

### Variables

| Variable       | Value                                 |
| -------------- | ------------------------------------- |
| `${skillName}` | Name from the frontmatter.            |
| `${skillDir}`  | Absolute path of the skill folder.    |
| `${skillFile}` | Absolute path of the `SKILL.md` file. |
| `${skillId}`   | Internal identifier of the skill.     |

A key without a command does nothing. Tasker writes the state to the journal.

## cli

This adapter sends a prompt to the `claude` command line interface.
The play key and the undo key work. The record key needs the desktop application.

```json
{
  "adapter": {
    "id": "cli",
    "cliProgram": "claude",
    "cliPromptTemplate": "Use the ${skillName} skill."
  }
}
```

Tasker starts the program in the skill folder.

## desktop

This adapter sends a key sequence to the Claude desktop application.

```json
{
  "adapter": {
    "id": "desktop",
    "targetApp": "Claude",
    "keys": { "record": "cmd+shift+r", "stop": "esc", "play": "return", "undo": "cmd+z" }
  }
}
```

### Platform behavior

| Platform | Program      | Requirement                                                 |
| -------- | ------------ | ----------------------------------------------------------- |
| macOS    | `osascript`  | Give accessibility permission to Tasker in System Settings. |
| Windows  | `powershell` | No extra requirement.                                       |
| Linux    | `xdotool`    | Install the `xdotool` package.                              |

### Key names

Write the modifiers first. Separate the parts with `+`.

| Part          | Values                                                         |
| ------------- | -------------------------------------------------------------- |
| Modifier      | `cmd`, `ctrl`, `alt`, `shift`                                  |
| Named key     | `esc`, `return`, `tab`, `space`, `left`, `right`, `up`, `down` |
| Character key | One character, for example `r`                                 |

The key sequence of the record function can change with a new version of the Claude
desktop application. The sequence is a configuration value for this reason.

## Undo behavior

The undo key does two things.

1. Tasker marks the last play entry or record entry in the journal as reverted.
2. Tasker runs the undo command of the adapter.

The journal file holds the last 200 entries.

| Platform | Path                                                |
| -------- | --------------------------------------------------- |
| macOS    | `~/Library/Application Support/Tasker/journal.json` |
| Windows  | `%APPDATA%\Tasker\journal.json`                     |
| Linux    | `~/.config/Tasker/journal.json`                     |

## Write a new adapter

1. Add a file to `src/main/adapters`.
2. Export an object with an `id` field and a `resolve` function.
3. Return a command specification or `null`.
4. Register the adapter in `src/main/adapters/index.ts`.
5. Add the identifier to the `AdapterId` type in `src/shared/types.ts`.

```ts
export const exampleAdapter: Adapter = {
  id: 'example',
  resolve(action, skill, config) {
    if (action !== 'play' || !skill) return { spec: null, label: 'example idle' }
    return { spec: { program: 'echo', args: [skill.name] }, label: 'example play' }
  }
}
```
