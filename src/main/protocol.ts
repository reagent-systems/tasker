import { net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import { normalize, resolve, sep } from 'node:path'

export const ASSET_SCHEME = 'tasker-asset'

/** The renderer reads preview files through this scheme. Registration runs before `app.ready`. */
export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ASSET_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: false
      }
    }
  ])
}

/** Serves preview files that live inside one of the allowed roots. */
export function serveAssets(allowedRoots: () => string[]): void {
  protocol.handle(ASSET_SCHEME, async (request) => {
    const url = new URL(request.url)
    const file = normalize(decodeURIComponent(url.pathname.replace(/^\//, '')))
    const roots = allowedRoots().map((root) => resolve(root))
    const target = resolve(file)
    const allowed = roots.some((root) => target === root || target.startsWith(root + sep))
    if (!allowed) return new Response('forbidden', { status: 403 })
    return net.fetch(pathToFileURL(target).toString())
  })
}
