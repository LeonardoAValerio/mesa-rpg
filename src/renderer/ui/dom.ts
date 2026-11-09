type Props = Record<string, string | number | boolean | ((ev: Event) => void) | undefined>

/** Small element builder. Text always goes through textContent, never innerHTML (CHAT-04). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Array<Node | string | null | undefined | false>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === false) continue
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, '').toLowerCase(), v)
    else if (k === 'class') el.className = String(v)
    else if (k === 'testid') el.dataset.testid = String(v)
    else if (k === 'value' && 'value' in el) (el as HTMLInputElement).value = String(v)
    else if (v === true) el.setAttribute(k, '')
    else el.setAttribute(k, String(v))
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue
    el.append(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return el
}

export function clear(el: Element): void {
  while (el.firstChild) el.firstChild.remove()
}
