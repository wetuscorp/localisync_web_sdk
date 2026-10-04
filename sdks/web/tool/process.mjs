import { execFileSync, spawn } from 'node:child_process'
import { basename, isAbsolute } from 'node:path'

function command(args) {
  const entry = process.env.npm_execpath
  if (entry && isAbsolute(entry)) {
    const name = basename(entry)
    if (/^pnpm\.(?:cjs|mjs|js)$/.test(name)) return [process.execPath, [entry, ...args]]
    // pnpm 11 also ships a native executable, including pnpm.exe on Windows.
    // Execute it directly; no command shell or interpolated arguments are needed.
    if (name === 'pnpm' || name === 'pnpm.exe') return [entry, args]
  }
  if (process.platform === 'win32') throw new Error('Run this SDK tool through its pnpm package script.')
  return ['pnpm', args]
}
export function runPnpm(args, options) {
  return execFileSync(...command(args), options)
}
export function spawnPnpm(args, options) {
  return spawn(...command(args), options)
}
