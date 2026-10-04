import { execFileSync, spawn } from 'node:child_process'
import { isAbsolute } from 'node:path'

// pnpm exposes its JavaScript entry when running a script. Invoking that entry
// avoids Windows .cmd shell interpretation and keeps file paths as separate args.
function command(args) {
  const entry = process.env.npm_execpath
  if (entry && isAbsolute(entry) && /(?:^|[\\/])pnpm\.(?:cjs|js)$/.test(entry))
    return [process.execPath, [entry, ...args]]
  if (process.platform === 'win32') throw new Error('Run this SDK tool through its pnpm package script.')
  return ['pnpm', args]
}
export function runPnpm(args, options) {
  return execFileSync(...command(args), options)
}
export function spawnPnpm(args, options) {
  return spawn(...command(args), options)
}
