# Contributing

Thank you for your interest in Tasker.

## Setup

```bash
git clone https://github.com/thyfriendlyfox/tasker.git
cd tasker
pnpm install
pnpm run dev
```

Node 20.19 or later and pnpm 11 or later are required.
Run `corepack enable pnpm` to install pnpm.
The asset scripts need ImageMagick 7. macOS also needs `iconutil` for the icon file.

The file `pnpm-workspace.yaml` allows the install scripts of `electron` and `esbuild`.
Add a package to the `allowBuilds` list when the package needs an install script.
Do not use npm or yarn. The lock file is `pnpm-lock.yaml`.

## Checks

Run these commands before you open a pull request.

```bash
pnpm run format:check && pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build
```

## Rules

1. Keep the user interface free of explanatory text.
2. Write every text in Simplified Technical English. See [docs/STYLE.md](docs/STYLE.md).
3. Add a test for each new pure function.
4. Do not add a network call to the run time.
5. Do not add a dependency without a reason in the pull request.
6. Keep the renderer inside the sandbox. Do not add node integration.
7. Build every asset from a script. Do not commit an asset that a script cannot rebuild.

## Structure

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first.
The main process holds the system access. The renderer holds the user interface.
The two sides share the types in `src/shared/types.ts`.

## Commits

Write the subject line in the imperative form.
Keep the subject under 60 characters.

```
Add the video preview source
Fix the card order after a rescan
```

## Adapters

An adapter is the correct place for a new control route.
Read [docs/ADAPTERS.md](docs/ADAPTERS.md) for the steps.

## Assets

Run `pnpm run assets` after a change to the shapes, the colors or the layout.
The command rebuilds the icons, the demo skills, the models, the screenshots and the OG image.
Commit the output with the code change.

## Release

1. Update `CHANGELOG.md`.
2. Update the version in `package.json`.
3. Create the tag `v<version>`.
4. Push the tag. The release workflow builds the installers and creates a draft release.
5. Check the draft release and publish it.
