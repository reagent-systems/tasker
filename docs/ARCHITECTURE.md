# Architecture

Tasker is an Electron application. The code has three parts.

| Part           | Folder         | Task                                                          |
| -------------- | -------------- | ------------------------------------------------------------- |
| Main process   | `src/main`     | Window, tray, shortcuts, skill discovery, adapters, journal.  |
| Preload bridge | `src/preload`  | One fixed application programming interface for the renderer. |
| Renderer       | `src/renderer` | The 3D user interface.                                        |

The folder `src/shared` holds the types and the channel names of both sides.

## Data flow

1. The main process reads the configuration file.
2. The main process scans the skill folders.
3. The main process sends the skill list to the renderer.
4. The user presses a key in the renderer.
5. The renderer calls `run` on the bridge.
6. The main process selects the adapter and starts the program.
7. The main process writes the run to the journal.
8. The main process sends the status to the renderer.
9. The renderer moves the key and sets the lamp color.

## Main process

| File                    | Task                                            |
| ----------------------- | ----------------------------------------------- |
| `index.ts`              | Start, IPC handlers, application lifetime.      |
| `window.ts`             | Frameless window, position, always on top.      |
| `tray.ts`               | Tray icon and menu.                             |
| `shortcuts.ts`          | Global accelerators.                            |
| `config.ts`             | Read, merge and write the configuration file.   |
| `protocol.ts`           | The `tasker-asset://` scheme for preview files. |
| `runner.ts`             | Start, stop and report one action.              |
| `journal.ts`            | Run history for the undo key.                   |
| `capture.ts`            | Screenshot mode for the documentation.          |
| `skills/scan.ts`        | Find skill folders and read the frontmatter.    |
| `skills/frontmatter.ts` | Read the YAML frontmatter subset.               |
| `skills/watch.ts`       | Watch the skill folders.                        |
| `adapters/*.ts`         | Translate an action into a command.             |

## Renderer

The renderer draws one WebGL canvas. Three.js builds every part.

| File                    | Task                                                          |
| ----------------------- | ------------------------------------------------------------- |
| `main.ts`               | Bridge events, keyboard, boot.                                |
| `three/scene.ts`        | Camera, lights, ray caster, frame loop.                       |
| `three/layout.ts`       | Positions of the body, the rolodex, the preview and the keys. |
| `three/body.ts`         | Shell, grip and status lamp.                                  |
| `three/rolodex.ts`      | Card deck and turn animation.                                 |
| `three/previewPanel.ts` | Preview screen.                                               |
| `three/preview.ts`      | GIF, video and image sources.                                 |
| `three/deck.ts`         | Transport keys and key travel.                                |
| `three/shapes.ts`       | Rounded rectangles, arrows, circles and extrusions.           |
| `three/text.ts`         | Card face texture.                                            |
| `three/palette.ts`      | Light colors and dark colors.                                 |

The layout uses one world unit system. The view height is always 4 units.
The view width follows the window aspect. Each part reads its rectangle from `layout.ts`.

### Animated previews

`preview.ts` decodes an animated image with the platform image decoder.
The decoder produces one bitmap for each frame.
The panel draws the current frame to a canvas texture.
A video file uses a video texture. A skill without a preview file gets a pattern.

## Security model

| Setting                 | Value                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| `contextIsolation`      | `true`                                                           |
| `sandbox`               | `true`                                                           |
| `nodeIntegration`       | `false`                                                          |
| `webviewTag`            | `false`                                                          |
| Content security policy | `default-src 'self'` with the asset scheme for images and media. |
| Navigation              | Blocked. External links open in the system browser.              |

The preload script is CommonJS because a sandboxed preload script cannot use modules.

The asset protocol resolves the file path and compares it against the skill roots.
A file outside those roots gets a 403 response.

## Process control

`runner.ts` starts one child process at a time.
The program and the arguments come from the adapter as a list.
No shell reads the string, so an argument cannot inject a command.
The stop key sends `SIGTERM` to the child process and runs the stop command of the adapter.

## Tests

`npm test` bundles the TypeScript tests with esbuild and runs the node test runner.
The tests cover the frontmatter reader, the skill scanner, the key sequence builder and the layout.
