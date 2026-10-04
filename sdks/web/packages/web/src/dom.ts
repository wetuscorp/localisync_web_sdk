import { LocalisyncError } from './core/index.js'
import type { LocalisyncClient, Parameters } from './core/index.js'

export interface DomOptions {
  readonly observe?: boolean
  readonly onDiagnostic?: (error: LocalisyncError) => void
}
const attributes = ['title', 'placeholder', 'aria-label', 'alt'] as const
const selector = ['[data-localisync]', ...attributes.map(a => `[data-localisync-${a}]`)].join(',')
export function bindDom(root: Element, client: LocalisyncClient, options: DomOptions = {}) {
  let closed = false,
    scheduled = false,
    dirty = false
  const elements = new Set<Element>()
  const report = () =>
    options.onDiagnostic?.(
      new LocalisyncError('arguments', 'A DOM translation binding has invalid parameters or an unsafe text target.')
    )
  function args(element: Element): Parameters {
    const source = element.getAttribute('data-localisync-args')
    if (!source) return {}
    if (source.length > 16 * 1024) throw new Error('Argument size')
    const value: unknown = JSON.parse(source)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Arguments')
    const result: Record<string, string | number> = Object.create(null)
    for (const [key, v] of Object.entries(value)) {
      if (
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ||
        (typeof v !== 'string' && !(typeof v === 'number' && Number.isFinite(v)))
      )
        throw new Error('Argument type')
      result[key] = v
    }
    return result
  }
  function apply(element: Element) {
    try {
      const parameters = args(element),
        key = element.getAttribute('data-localisync')
      if (key) {
        if (
          element.children.length ||
          ['INPUT', 'TEXTAREA', 'SELECT', 'SCRIPT', 'STYLE', 'IFRAME'].includes(element.tagName) ||
          element.getAttribute('contenteditable') !== null ||
          ('isContentEditable' in element && element.isContentEditable === true)
        )
          report()
        else {
          const text = client.translate(key, parameters)
          if (element.textContent !== text) element.textContent = text
        }
      }
      for (const attribute of attributes) {
        const key = element.getAttribute('data-localisync-' + attribute)
        if (key) {
          const text = client.translate(key, parameters)
          if (element.getAttribute(attribute) !== text) element.setAttribute(attribute, text)
        }
      }
    } catch {
      report()
    }
  }
  function scan() {
    if (closed) return
    elements.clear()
    if (root.matches(selector)) elements.add(root)
    for (const element of root.querySelectorAll(selector)) elements.add(element)
    schedule()
  }
  function schedule() {
    if (closed) return
    if (scheduled) {
      dirty = true
      return
    }
    scheduled = true
    const remaining = [...elements]
    let index = 0
    const batch = () => {
      if (closed) return
      const start = performance.now()
      while (index < remaining.length && performance.now() - start < 8) {
        const element = remaining[index++]
        if (element && (element === root || root.contains(element))) apply(element)
      }
      if (index < remaining.length) setTimeout(batch, 0)
      else {
        scheduled = false
        if (dirty) {
          dirty = false
          schedule()
        }
      }
    }
    queueMicrotask(batch)
  }
  const unsubscribe = client.subscribe(schedule)
  const observer =
    options.observe === false
      ? null
      : new MutationObserver(records => {
          if (
            records.some(
              record =>
                record.type === 'attributes' ||
                Array.from(record.addedNodes).some(node => node.nodeType === Node.ELEMENT_NODE) ||
                Array.from(record.removedNodes).some(node => node.nodeType === Node.ELEMENT_NODE)
            )
          )
            scan()
        })
  observer?.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-localisync', 'data-localisync-args', ...attributes.map(a => 'data-localisync-' + a)]
  })
  scan()
  return {
    refresh: scan,
    dispose() {
      closed = true
      observer?.disconnect()
      unsubscribe()
      elements.clear()
    }
  }
}
