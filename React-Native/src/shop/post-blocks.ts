import { safePostHtml } from './blog'

/**
 * A post's body as native pieces — a heading, a paragraph, a list, a
 * photo… — for `<PostBody>` to draw with `Text` and `Image`. The HTML goes
 * through `safePostHtml` (the web starters' allowlist) first, so what is read
 * here is well nested and holds only the allowlisted tags, and nothing in a
 * post ever runs in the app.
 *
 * Links keep web, mail and phone addresses only (a path on the website means
 * nothing in the app), and photos need a full http(s) address. The Swift
 * starter reads posts the same way (`PostBlocks.swift`).
 */

/** A stretch of text with its inline styles. */
export type Run = {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  strike?: boolean
  /** http(s), mailto: or tel: only. */
  link?: string
}

export type PostListItem = {
  /** "1.", "•" or "◦"; empty for a line that continues the item above. */
  marker: string
  text: Run[]
  /** 0 for the outer list, 1 for a list inside it, … */
  depth: number
}

export type PostTableRow = {
  cells: Run[][]
  /** Every cell is a `<th>`, or the row is in `<thead>`. */
  isHeader: boolean
}

export type PostBlock =
  | { kind: 'heading'; level: number; text: Run[] }
  | { kind: 'paragraph'; text: Run[] }
  | { kind: 'quote'; text: Run[] }
  | { kind: 'list'; items: PostListItem[] }
  | { kind: 'code'; text: string }
  | { kind: 'image'; url: string; alt: string }
  /** A photo's caption (`<figcaption>`) or a table's (`<caption>`). */
  | { kind: 'caption'; text: Run[] }
  | { kind: 'table'; rows: PostTableRow[] }
  | { kind: 'rule' }

/** A post's HTML as blocks. */
export function postBlocks(html: string | null | undefined): PostBlock[] {
  const reader = new Reader()
  reader.read(safePostHtml(html ?? ''))
  return reader.blocks
}

/** The text of runs, styles dropped. */
export function plainText(runs: Run[]): string {
  return runs.map((run) => run.text).join('')
}

const TAG = /<(\/?)([a-z0-9]+)((?:\s+[a-z-]+="[^"]*")*)\s*\/?>/g
const ATTRIBUTE = /([a-z-]+)="([^"]*)"/g
const SPACE = /[\t\n\r\f ]+/g
const ENTITY = /&(#[0-9]{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/g
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  ndash: '–', mdash: '—', hellip: '…', middot: '·',
  bull: '•', copy: '©', reg: '®', trade: '™',
  times: '×', deg: '°', euro: '€', pound: '£',
}

class Reader {
  blocks: PostBlock[] = []
  // The text being gathered, and the inline styles open around it.
  private inline: Run[] = []
  // Underline and highlight (<u>, <mark>) read as plain text.
  private bold = 0
  private italic = 0
  private strike = 0
  private code = 0
  private links: (string | null)[] = []
  // Where the text goes when it's finished.
  private heading: number | null = null
  private quoteDepth = 0
  private preDepth = 0
  private inCaption = false
  private lists: { ordered: boolean; next: number }[] = []
  private listItems: PostListItem[] = []
  /** One marker per open `<li>`; "" once its first line is out. */
  private items: string[] = []
  private tableRows: PostTableRow[] | null = null
  private row: Run[][] | null = null
  private rowIsHeader = true
  private inHead = false

  read(html: string) {
    let at = 0
    for (const match of html.matchAll(TAG)) {
      const index = match.index ?? 0
      if (index > at) this.text(html.slice(at, index))
      at = index + match[0].length
      const closing = match[1] === '/'
      const name = match[2]
      if (closing) this.close(name)
      else this.open(name, attributes(match[3] ?? ''))
    }
    if (at < html.length) this.text(html.slice(at))
    this.finishParagraph()
    this.finishList()
  }

  /** A finished block. A list still being gathered goes out first, so a
   *  photo inside a list item lands between its lines, not before them. */
  private emit(block: PostBlock) {
    if (this.listItems.length > 0) {
      this.blocks.push({ kind: 'list', items: this.listItems })
      this.listItems = []
    }
    this.blocks.push(block)
  }

  private open(name: string, attrs: Record<string, string>) {
    switch (name) {
      case 'p':
      case 'div':
        if (this.items.length > 0 || this.row) this.newLine()
        else this.finishParagraph()
        break
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        this.finishParagraph()
        this.heading = Number(name.slice(1)) || 2
        break
      case 'blockquote':
        this.finishParagraph()
        this.quoteDepth += 1
        break
      case 'pre':
        this.finishParagraph()
        this.preDepth += 1
        break
      case 'ul':
      case 'ol':
        // A list inside an item: the item's text so far is its first line.
        this.finishParagraph()
        this.lists.push({ ordered: name === 'ol', next: Number.parseInt(attrs.start ?? '', 10) || 1 })
        break
      case 'li': {
        this.finishParagraph()
        const list = this.lists[this.lists.length - 1]
        if (!list) break
        if (list.ordered) {
          this.items.push(`${list.next}.`)
          list.next += 1
        } else {
          this.items.push(this.lists.length === 1 ? '•' : '◦')
        }
        break
      }
      case 'table':
        this.finishParagraph()
        this.tableRows = []
        break
      case 'thead':
        this.inHead = true
        break
      case 'tr':
        this.row = []
        this.rowIsHeader = true
        break
      case 'td':
      case 'th':
        this.inline = []
        if (name === 'td') this.rowIsHeader = false
        break
      case 'caption':
      case 'figcaption':
        this.finishParagraph()
        this.inCaption = true
        break
      case 'img': {
        this.finishParagraph()
        const src = attrs.src ?? ''
        if (/^https?:\/\//i.test(src)) this.emit({ kind: 'image', url: src, alt: attrs.alt ?? '' })
        break
      }
      case 'hr':
        this.finishParagraph()
        this.emit({ kind: 'rule' })
        break
      case 'br':
        this.newLine()
        break
      case 'b': case 'strong': this.bold += 1; break
      case 'i': case 'em': this.italic += 1; break
      case 's': case 'del': this.strike += 1; break
      case 'code': case 'kbd': this.code += 1; break
      case 'a': this.links.push(linkURL(attrs.href)); break
      default: break // abbr, span, small, sub, sup, tbody, tfoot, figure: no styling of their own.
    }
  }

  private close(name: string) {
    switch (name) {
      case 'p':
      case 'div':
        if (this.items.length === 0 && !this.row) this.finishParagraph()
        break
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        this.finishParagraph()
        this.heading = null
        break
      case 'blockquote':
        this.finishParagraph()
        this.quoteDepth = Math.max(0, this.quoteDepth - 1)
        break
      case 'pre': {
        const text = plainText(this.inline)
        this.inline = []
        if (text.trim()) this.emit({ kind: 'code', text: text.replace(/^\n+|\n+$/g, '') })
        this.preDepth = Math.max(0, this.preDepth - 1)
        break
      }
      case 'li':
        this.finishParagraph()
        this.items.pop()
        break
      case 'ul':
      case 'ol':
        this.finishParagraph()
        this.lists.pop()
        if (this.lists.length === 0) this.finishList()
        break
      case 'td':
      case 'th':
        this.row?.push(trimmed(this.inline))
        this.inline = []
        break
      case 'tr':
        if (this.row && this.row.length > 0) {
          this.tableRows?.push({ cells: this.row, isHeader: this.inHead || this.rowIsHeader })
        }
        this.row = null
        break
      case 'thead':
        this.inHead = false
        break
      case 'table':
        if (this.tableRows && this.tableRows.length > 0) this.emit({ kind: 'table', rows: this.tableRows })
        this.tableRows = null
        break
      case 'caption':
      case 'figcaption':
        this.finishParagraph()
        this.inCaption = false
        break
      case 'b': case 'strong': this.bold = Math.max(0, this.bold - 1); break
      case 'i': case 'em': this.italic = Math.max(0, this.italic - 1); break
      case 's': case 'del': this.strike = Math.max(0, this.strike - 1); break
      case 'code': case 'kbd': this.code = Math.max(0, this.code - 1); break
      case 'a': this.links.pop(); break
      default: break
    }
  }

  private text(raw: string) {
    let value = decode(raw)
    if (this.preDepth === 0) {
      value = value.replace(SPACE, ' ')
      // Spaces collapse, as in a browser: none at the start of a line.
      const last = plainText(this.inline).slice(-1)
      if (last === '' || last === ' ' || last === '\n') value = value.replace(/^ +/, '')
    }
    if (!value) return
    const run: Run = { text: value }
    if (this.bold > 0) run.bold = true
    if (this.italic > 0) run.italic = true
    if (this.code > 0 && this.preDepth === 0) run.code = true
    if (this.strike > 0) run.strike = true
    const link = [...this.links].reverse().find((url) => url !== null)
    if (link) run.link = link
    this.inline.push(run)
  }

  private newLine() {
    const last = plainText(this.inline).slice(-1)
    if (last !== '' && last !== '\n') this.inline.push({ text: '\n' })
  }

  /** Send the text gathered so far where it belongs: a list line, a
   *  caption, a heading, a quote or a paragraph. */
  private finishParagraph() {
    const text = trimmed(this.inline)
    this.inline = []
    if (!plainText(text)) return
    if (this.lists.length > 0) {
      // In an item (or loose in the list): one line, marked the first time.
      const marker = this.items[this.items.length - 1] ?? ''
      this.listItems.push({ marker, text, depth: this.lists.length - 1 })
      if (this.items.length > 0) this.items[this.items.length - 1] = ''
    } else if (this.inCaption) {
      this.emit({ kind: 'caption', text })
    } else if (this.heading !== null) {
      this.emit({ kind: 'heading', level: this.heading, text })
    } else if (this.quoteDepth > 0) {
      this.emit({ kind: 'quote', text })
    } else {
      this.emit({ kind: 'paragraph', text })
    }
  }

  private finishList() {
    this.items = []
    if (this.listItems.length > 0) this.blocks.push({ kind: 'list', items: this.listItems })
    this.listItems = []
  }
}

/** Runs without spaces or line breaks at either end. */
function trimmed(runs: Run[]): Run[] {
  const out = runs.map((run) => ({ ...run }))
  while (out.length > 0) {
    const first = out[0]
    const text = first.text.replace(/^[ \n]+/, '')
    if (text) {
      first.text = text
      break
    }
    out.shift()
  }
  while (out.length > 0) {
    const last = out[out.length - 1]
    const text = last.text.replace(/[ \n]+$/, '')
    if (text) {
      last.text = text
      break
    }
    out.pop()
  }
  return out
}

/** Web, mail and phone links open from the app; a path or a #fragment of
 *  the website would go nowhere, so its text stays plain. */
function linkURL(href: string | undefined): string | null {
  if (!href) return null
  return /^(https?:\/\/|mailto:|tel:)/i.test(href) ? href : null
}

function attributes(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const match of raw.matchAll(ATTRIBUTE)) out[match[1]] = decode(match[2])
  return out
}

/** Character references: numeric ones, and the named ones posts use. An
 *  unknown name stays as written. */
export function decode(value: string): string {
  if (!value.includes('&')) return value
  return value.replace(ENTITY, (whole, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X'
      const n = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10)
      try {
        return n > 0 ? String.fromCodePoint(n) : '�'
      } catch {
        return '�'
      }
    }
    return NAMED[body] ?? whole
  })
}
