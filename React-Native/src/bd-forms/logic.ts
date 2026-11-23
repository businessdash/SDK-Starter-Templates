/**
 * The renderer's pure logic: no React, no React Native. What the controls
 * write, and how stored HTML reads back. Shared reading with the Swift and
 * Compose renderers, so a form behaves the same on every platform.
 *
 * Tested by `__tests__/logic.test.ts` (`pnpm test:forms`).
 */

// ─── HTML → styled runs ──────────────────────────────────────────────────────

/** One run of text with the styles the BD HTML dialect can give it. */
export interface BdSpan {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  code?: boolean
  /** 1–6 for headings. */
  heading?: number
  quote?: boolean
  /** A link the visitor can safely open (web, mail, phone). */
  link?: string
}

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  copy: '©',
  reg: '®',
  trade: '™',
  bull: '•',
}

function codePoint(cp: number): string | null {
  if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff) return null
  return String.fromCodePoint(cp)
}

export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s
  let out = ''
  let i = 0
  while (i < s.length) {
    if (s[i] === '&') {
      const semi = s.indexOf(';', i)
      if (semi > i && semi <= i + 12) {
        const name = s.slice(i + 1, semi)
        let rep: string | null | undefined
        if (/^#[xX][0-9a-fA-F]+$/.test(name)) rep = codePoint(Number.parseInt(name.slice(2), 16))
        else if (/^#\d+$/.test(name)) rep = codePoint(Number.parseInt(name.slice(1), 10))
        else rep = NAMED[name]
        if (rep != null) {
          out += rep
          i = semi + 1
          continue
        }
      }
    }
    out += s[i]
    i++
  }
  return out
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Only links a visitor can safely open: web, mail and phone. */
export function safeLink(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim()
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(s)
  if (!m) return null
  const scheme = m[1]?.toLowerCase()
  return scheme === 'http' || scheme === 'https' || scheme === 'mailto' || scheme === 'tel'
    ? s
    : null
}

/** Only http(s) links leave the form (images, "View" links). */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim()
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : null
}

function attribute(name: string, tag: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const m = re.exec(tag)
  if (!m) return null
  const v = m[2] ?? m[3] ?? m[4]
  return v == null ? null : decodeEntities(v)
}

/**
 * Server-sanitized `richtext` HTML as styled runs. Block elements become
 * line breaks (never more than one blank line in a row), lists become
 * "• " / "1. " lines, and only safe links survive.
 */
export function htmlSpans(html: string): BdSpan[] {
  const spans: BdSpan[] = []
  let plain = ''
  let bold = 0
  let italic = 0
  let underline = 0
  let strike = 0
  let code = 0
  let quote = 0
  let heading: number | undefined
  const links: Array<string | null> = []
  const lists: Array<{ ordered: boolean; n: number }> = []
  let pendingBreak = false
  let atLineStart = true

  const raw = (s: string) => {
    spans.push({ text: s })
    plain += s
  }
  const newline = (count = 1) => {
    if (plain.length === 0) return
    const have = plain.endsWith('\n\n') ? 2 : plain.endsWith('\n') ? 1 : 0
    if (count > have) raw('\n'.repeat(count - have))
    atLineStart = true
  }
  const emit = (text: string) => {
    const t = atLineStart ? text.replace(/^ +/, '') : text
    if (t.length === 0) return
    if (pendingBreak) {
      newline(2)
      pendingBreak = false
    }
    const span: BdSpan = { text: t }
    if (bold > 0 || heading != null) span.bold = true
    if (italic > 0 || quote > 0) span.italic = true
    if (underline > 0) span.underline = true
    if (strike > 0) span.strike = true
    if (code > 0) span.code = true
    if (heading != null) span.heading = heading
    if (quote > 0) span.quote = true
    const link = links[links.length - 1]
    if (link) span.link = link
    spans.push(span)
    plain += t
    atLineStart = false
  }
  const dec = (n: number) => Math.max(0, n - 1)

  let i = 0
  while (i < html.length) {
    if (html[i] === '<') {
      const close = html.indexOf('>', i)
      if (close >= 0) {
        const tag = html.slice(i + 1, close)
        i = close + 1
        if (tag.startsWith('!')) continue
        const isEnd = tag.startsWith('/')
        const body = isEnd ? tag.slice(1) : tag
        const name = (/^[a-zA-Z0-9]*/.exec(body)?.[0] ?? '').toLowerCase()
        switch (name) {
          case 'b':
          case 'strong':
            bold = isEnd ? dec(bold) : bold + 1
            break
          case 'i':
          case 'em':
            italic = isEnd ? dec(italic) : italic + 1
            break
          case 'u':
            underline = isEnd ? dec(underline) : underline + 1
            break
          case 's':
          case 'strike':
          case 'del':
            strike = isEnd ? dec(strike) : strike + 1
            break
          case 'code':
            code = isEnd ? dec(code) : code + 1
            break
          case 'a':
            if (isEnd) links.pop()
            else links.push(safeLink(attribute('href', body)))
            break
          case 'br':
            newline()
            pendingBreak = false
            break
          case 'p':
          case 'div':
          case 'pre':
            if (isEnd || plain.length > 0) pendingBreak = true
            break
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            if (isEnd) {
              heading = undefined
              pendingBreak = true
            } else {
              if (plain.length > 0) pendingBreak = true
              heading = Number(name.slice(1))
            }
            break
          case 'blockquote':
            if (isEnd) {
              quote = dec(quote)
              pendingBreak = true
            } else {
              if (plain.length > 0) pendingBreak = true
              quote++
            }
            break
          case 'ul':
          case 'ol':
            if (isEnd) {
              lists.pop()
              if (lists.length === 0) pendingBreak = true
            } else {
              if (lists.length === 0 && plain.length > 0) pendingBreak = true
              lists.push({ ordered: name === 'ol', n: 0 })
            }
            break
          case 'li':
            if (!isEnd) {
              if (pendingBreak) {
                newline(2)
                pendingBreak = false
              } else {
                newline()
              }
              const depth = Math.max(lists.length - 1, 0)
              let marker = '•'
              const top = lists[lists.length - 1]
              if (top) {
                top.n++
                if (top.ordered) marker = `${top.n}.`
              }
              raw(`${'    '.repeat(depth)}${marker} `)
              atLineStart = true
            }
            break
        }
        continue
      }
    }
    // Text up to the next tag. A stray "<" with no ">" after it is text.
    let next = html.indexOf('<', html[i] === '<' ? i + 1 : i)
    if (next < 0) next = html.length
    emit(decodeEntities(html.slice(i, next)).replace(/\s+/g, ' '))
    i = next
  }

  // Drop trailing line breaks.
  while (spans.length > 0) {
    const last = spans[spans.length - 1] as BdSpan
    const trimmed = last.text.replace(/\n+$/, '')
    if (trimmed.length === last.text.length) break
    if (trimmed.length === 0) spans.pop()
    else {
      spans[spans.length - 1] = { ...last, text: trimmed }
      break
    }
  }
  return spans
}

/** The runs' text, joined. */
export function spansText(spans: readonly BdSpan[]): string {
  return spans.map((s) => s.text).join('')
}

// ─── Rich text editor: light markup ↔ the HTML BD keeps ──────────────────────

/** Text plus selection, as a TextInput reports them. */
export interface BdTextState {
  text: string
  start: number
  end: number
}

const NUMBERED = /^(\d+)\. /
const BULLETS = ['• ', '- ', '* ']
// No lookbehind: the content starts and ends with a non-space.
const BOLD = /\*\*(\S(?:.*?\S)?)\*\*/g
const ITALIC = /(^|[^*\w])\*([^\s*](?:.*?[^\s*])?)\*(?![*\w])/g
const STRIKE = /~~(\S(?:.*?\S)?)~~/g

function inline(text: string): string {
  return escapeHtml(text)
    .replace(BOLD, '<strong>$1</strong>')
    .replace(ITALIC, '$1<em>$2</em>')
    .replace(STRIKE, '<s>$1</s>')
}

/**
 * One line is one paragraph; `• `, `- ` or `* ` starts a bullet, `1. ` a
 * numbered item; `**bold**`, `*italic*`, `~~struck~~` inline.
 */
export function markupToHtml(markup: string): string {
  if (markup.trim().length === 0) return ''
  const blocks: string[] = []
  let open: 'ul' | 'ol' | null = null
  const closeList = () => {
    if (open) blocks.push(`</${open}>`)
    open = null
  }
  for (const line of markup.split('\n')) {
    const bullet = BULLETS.find((b) => line.startsWith(b))
    const number = NUMBERED.exec(line)
    let kind: 'p' | 'ul' | 'ol' = 'p'
    let body = line
    if (bullet) {
      kind = 'ul'
      body = line.slice(bullet.length)
    } else if (number) {
      kind = 'ol'
      body = line.slice(number[0].length)
    }
    const inner = inline(body)
    if (kind === 'p') {
      closeList()
      blocks.push(inner.length === 0 ? '<p><br></p>' : `<p>${inner}</p>`)
    } else {
      if (open !== kind) {
        closeList()
        blocks.push(`<${kind}>`)
        open = kind
      }
      blocks.push(`<li>${inner}</li>`)
    }
  }
  closeList()
  while (blocks[blocks.length - 1] === '<p><br></p>') blocks.pop()
  return blocks.join('')
}

/** Stored HTML as editable markup (to restore a draft or default). */
export function htmlToMarkup(html: string): string {
  if (html.trim().length === 0) return ''
  let out = ''
  const lists: Array<{ ordered: boolean; n: number }> = []
  const lineBreak = () => {
    if (out.length > 0 && !out.endsWith('\n')) out += '\n'
  }
  let i = 0
  while (i < html.length) {
    if (html[i] === '<') {
      const close = html.indexOf('>', i)
      if (close >= 0) {
        const tag = html.slice(i + 1, close)
        i = close + 1
        const isEnd = tag.startsWith('/')
        const name = (/^[a-zA-Z0-9]*/.exec(tag.replace(/^\//, ''))?.[0] ?? '').toLowerCase()
        switch (name) {
          case 'strong':
          case 'b':
            out += '**'
            break
          case 'em':
          case 'i':
            out += '*'
            break
          case 's':
          case 'strike':
          case 'del':
            out += '~~'
            break
          case 'br':
            out += '\n'
            break
          case 'p':
          case 'div':
          case 'pre':
          case 'blockquote':
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            lineBreak()
            break
          case 'ul':
          case 'ol':
            lineBreak()
            if (isEnd) lists.pop()
            else lists.push({ ordered: name === 'ol', n: 0 })
            break
          case 'li':
            lineBreak()
            if (!isEnd) {
              const top = lists[lists.length - 1]
              if (top?.ordered) {
                top.n++
                out += `${top.n}. `
              } else {
                out += '• '
              }
            }
            break
        }
        continue
      }
    }
    let next = html.indexOf('<', html[i] === '<' ? i + 1 : i)
    if (next < 0) next = html.length
    let text = decodeEntities(html.slice(i, next)).replace(/\s+/g, ' ')
    if (out.length === 0 || out.endsWith('\n')) text = text.replace(/^ +/, '')
    out += text
    i = next
  }
  return out.replace(/^\n+|\n+$/g, '')
}

/** How many `c` in a row start at `at` (or end there, going back). */
function runOf(text: string, at: number, c: string, forward: boolean): number {
  let n = 0
  if (forward) while (at + n < text.length && text[at + n] === c) n++
  else while (at - n - 1 >= 0 && text[at - n - 1] === c) n++
  return n
}

/** Whether the caret's line has an unclosed `m`-long run of `c` before `at`. */
function openBefore(text: string, at: number, c: string, m: number): boolean {
  let i = at === 0 ? 0 : text.lastIndexOf('\n', at - 1) + 1
  let markers = 0
  while (i < at) {
    if (text[i] !== c) {
      i++
      continue
    }
    let n = 0
    while (i + n < at && text[i + n] === c) n++
    if (n === m) markers++
    i += n
  }
  return markers % 2 === 1
}

/** Wrap the selection in `marker` (or unwrap it), or drop a pair at the caret. */
export function wrapSelection(v: BdTextState, marker: string): BdTextState {
  const s = Math.min(v.start, v.end)
  const e = Math.max(v.start, v.end)
  const text = v.text
  const m = marker.length
  if (s === e) {
    const c = marker[0] as string
    const before = runOf(text, s, c, false)
    const after = runOf(text, s, c, true)
    // Pressed again before typing anything: take the empty pair back out.
    if (before === m && after === m) {
      return {
        text: text.slice(0, s - m) + text.slice(s + m),
        start: s - m,
        end: s - m,
      }
    }
    // Pressed again at the end of a formatted run: step past the closing
    // marker, so what's typed next is plain.
    if (after === m && openBefore(text, s, c, m)) {
      return { text, start: s + m, end: s + m }
    }
    return {
      text: text.slice(0, s) + marker + marker + text.slice(s),
      start: s + m,
      end: s + m,
    }
  }
  if (s >= m && text.startsWith(marker, s - m) && text.startsWith(marker, e)) {
    return {
      text: text.slice(0, s - m) + text.slice(s, e) + text.slice(e + m),
      start: s - m,
      end: e - m,
    }
  }
  return {
    text: text.slice(0, s) + marker + text.slice(s, e) + marker + text.slice(e),
    start: s + m,
    end: e + m,
  }
}

/** Make the caret's line a list item, switch its kind, or make it a paragraph again. */
export function toggleListLine(v: BdTextState, ordered: boolean): BdTextState {
  let text = v.text
  const point = Math.min(v.start, v.end)
  const start = point === 0 ? 0 : text.lastIndexOf('\n', point - 1) + 1
  const line = text.slice(start).split('\n')[0] ?? ''
  const bulletLen = BULLETS.find((b) => line.startsWith(b))?.length ?? 0
  const numberLen = NUMBERED.exec(line)?.[0].length ?? 0
  const existing = bulletLen > 0 ? bulletLen : numberLen
  let shift = 0
  if (existing > 0) {
    text = text.slice(0, start) + text.slice(start + existing)
    shift -= existing
    if (numberLen > 0 === ordered) {
      return {
        text,
        start: Math.max(v.start + shift, start),
        end: Math.max(v.end + shift, start),
      }
    }
  }
  let marker = '• '
  if (ordered) {
    // Continue the numbering of the line above.
    let n = 1
    if (start > 0) {
      const prevEnd = start - 1
      const prevStart = prevEnd === 0 ? 0 : text.lastIndexOf('\n', prevEnd - 1) + 1
      const prev = NUMBERED.exec(text.slice(prevStart, prevEnd))
      if (prev) n = Number(prev[1]) + 1
    }
    marker = `${n}. `
  }
  text = text.slice(0, start) + marker + text.slice(start)
  shift += marker.length
  const floor = start + marker.length
  return {
    text,
    start: Math.max(v.start + shift, floor),
    end: Math.max(v.end + shift, floor),
  }
}

// ─── Numbers typed as text ───────────────────────────────────────────────────

/** Keep what the field allows; a comma is a decimal point; "040" is "40". */
export function sanitizeNumber(s: string, allowDecimal: boolean, allowNegative: boolean): string {
  let out = ''
  let sawDot = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i] as string
    if (c >= '0' && c <= '9') out += c
    else if ((c === '.' || c === ',') && allowDecimal && !sawDot) {
      out += '.'
      sawDot = true
    } else if (c === '-' && allowNegative && i === 0) out += c
  }
  const start = out.startsWith('-') ? 1 : 0
  while (out.length > start + 1 && out[start] === '0' && /\d/.test(out[start + 1] as string)) {
    out = out.slice(0, start) + out.slice(start + 1)
  }
  return out
}

export function parseNumber(s: string): number | null {
  if (s === '' || s === '-' || s === '.' || s === '-.') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function formatNumber(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
}

// ─── Phone, tables, colors ───────────────────────────────────────────────────

export function formatPhone(input: string, international: boolean): string {
  if (international) {
    const plus = input.trimStart().startsWith('+') ? '+' : ''
    const digits = input.replace(/\D/g, '').slice(0, 15)
    return `${plus}${digits.replace(/(\d{3})(?=\d)/g, '$1 ')}`.trim()
  }
  const d = input.replace(/\D/g, '')
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`
}

/** A table cell in a `check` column: ✓, –, or its own text. */
export function tableCheckState(cell: string): 'yes' | 'no' | 'text' {
  const v = cell.trim().toLowerCase()
  if (['yes', 'y', 'true', '1', 'x', '✓', '✔', 'check'].includes(v)) return 'yes'
  if (['no', 'n', 'false', '0', '-', '–', '—', ''].includes(v)) return 'no'
  return 'text'
}

/** `#RRGGBB`, uppercase, as BD stores colors; null when it isn't a hex color. */
export function normalizeHex(hex: string): string | null {
  let s = hex.trim().replace(/^#/, '')
  if (s.length === 3)
    s = s
      .split('')
      .map((c) => c + c)
      .join('')
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null
  return `#${s.toUpperCase()}`
}

/** Black or white, whichever reads on `hex`. */
export function contrastingText(hex: string | null | undefined): string {
  const n = hex ? normalizeHex(hex) : null
  if (!n) return '#000000'
  const v = Number.parseInt(n.slice(1), 16)
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const l = 0.2126 * lin((v >> 16) & 255) + 0.7152 * lin((v >> 8) & 255) + 0.0722 * lin(v & 255)
  return l > 0.45 ? '#000000' : '#FFFFFF'
}

/** `#RRGGBB` plus an alpha, for tinted backgrounds. */
export function withAlpha(hex: string, alpha: number): string {
  const n = normalizeHex(hex)
  if (!n) return hex
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${n}${a.toUpperCase()}`
}

// ─── Dates and times ─────────────────────────────────────────────────────────

/** A calendar day, with no time zone. Month is 1–12. */
export interface BdDay {
  y: number
  m: number
  d: number
}

/** The day at the start of an ISO date or date-time, or null. */
export function parseDay(s: string | null | undefined): BdDay | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? '')
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null
  return { y, m: mo, d }
}

export function formatDay(day: BdDay): string {
  return `${String(day.y).padStart(4, '0')}-${String(day.m).padStart(2, '0')}-${String(day.d).padStart(2, '0')}`
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function compareDays(a: BdDay, b: BdDay): number {
  return a.y - b.y || a.m - b.m || a.d - b.d
}

export function today(): BdDay {
  const n = new Date()
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() }
}

export function addDays(day: BdDay, n: number): BdDay {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d + n))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

/** 0 = Sunday. */
export function weekday(day: BdDay): number {
  return new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay()
}

/** `HH:MM` from a stored time ("9:05" or "09:05:30" read too), or null. */
export function parseTime(s: string | null | undefined): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(s ?? '')
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** "14:30" as "2:30 PM", or as is in 24-hour format. */
export function formatTime(hhmm: string, twelveHour: boolean): string {
  if (!twelveHour) return hhmm
  const [hs, ms = '00'] = hhmm.split(':')
  const h = Number(hs)
  return `${h % 12 === 0 ? 12 : h % 12}:${ms} ${h < 12 ? 'AM' : 'PM'}`
}

/** Every time of day, `step` minutes apart, as `HH:MM`. */
export function timesOfDay(step: number): string[] {
  const s = Math.max(Math.floor(step) || 30, 1)
  const out: string[] = []
  for (let t = 0; t < 24 * 60; t += s) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`)
  }
  return out
}

/** "1.5 MB" style sizes. */
export function formatBytes(n: number | null | undefined): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB']
  let v = n / 1024
  let u = 0
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024
    u++
  }
  return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10} ${units[u]}`
}

/** Toggle `item` in a list of strings. */
export function toggled(list: readonly string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

/** A value as a list of strings (checkbox, tags, multi pickers). */
export function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** A value as an object (name, address, date range…). */
export function record(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

export function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
