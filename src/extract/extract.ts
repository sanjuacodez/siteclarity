/**
 * SC-104 — HTML to an addressable document model.
 *
 * HTMLRewriter only (AGENTS.md §7): it streams inside the runtime and barely touches
 * the 10 ms CPU budget, where a DOM library would blow it outright.
 *
 * Passage IDs are the backbone of the evidence system — every finding in every future
 * module points at one — so they must be deterministic and stable across re-runs.
 */

import { decodeEntities } from './entities'

export interface Passage {
  id: string
  sectionId: string
  kind: 'paragraph' | 'listitem' | 'cell' | 'definition' | 'quote' | 'pre' | 'caption'
  text: string
}

export interface Section {
  id: string
  heading: string | null
  level: number
  passageIds: string[]
}

export interface ExtractedDoc {
  title: string | null
  metaDescription: string | null
  lang: string | null
  canonical: string | null
  metaRobots: string | null
  headings: { level: number; text: string; sectionId: string }[]
  sections: Section[]
  passages: Passage[]
  passagesById: Map<string, Passage>
  jsonLdRaw: string[]
  links: { href: string; text: string; rel: string | null }[]
  /** Passages whose text repeats across sections — bylines, teasers, card blurbs. */
  boilerplatePassageIds: Set<string>
  jsDependency: { scriptBytes: number; textBytes: number; hasNoscript: boolean; likely: boolean }
  textBytes: number
}

/** FNV-1a. Not cryptographic — this only needs determinism and cheap collision resistance. */
function hash8(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

const normalizeText = (s: string) => decodeEntities(s.replace(/\s+/g, ' ').trim())

const PASSAGE_TAGS: Record<string, Passage['kind']> = {
  p: 'paragraph',
  li: 'listitem',
  td: 'cell',
  th: 'cell',
  dd: 'definition',
  dt: 'definition',
  blockquote: 'quote',
  pre: 'pre',
  figcaption: 'caption',
}

export async function extract(html: string, baseUrl: string): Promise<ExtractedDoc> {
  const sections: Section[] = []
  const passages: Passage[] = []
  const headings: ExtractedDoc['headings'] = []
  const jsonLdRaw: string[] = []
  const links: ExtractedDoc['links'] = []

  let title: string | null = null
  let metaDescription: string | null = null
  let lang: string | null = null
  let canonical: string | null = null
  let metaRobots: string | null = null

  let scriptBytes = 0
  let textBytes = 0
  let hasNoscript = false

  // Content before the first heading still needs a home.
  let current: Section = { id: 's0', heading: null, level: 0, passageIds: [] }
  sections.push(current)

  // One buffer at a time: HTMLRewriter delivers text in document order, so a
  // simple current-target model is sufficient and avoids a stack.
  let buffer: string[] = []
  let capturing: 'heading' | 'passage' | 'title' | 'jsonld' | 'link' | null = null
  let pendingKind: Passage['kind'] = 'paragraph'
  let pendingLevel = 0
  let pendingLinkHref: string | null = null
  let pendingLinkRel: string | null = null
  let suppressed = 0

  const flushPassage = () => {
    const text = normalizeText(buffer.join(''))
    buffer = []
    if (text.length < 2) return
    const index = current.passageIds.length
    const id = `${current.id}:p${index}:${hash8(text)}`
    const passage: Passage = { id, sectionId: current.id, kind: pendingKind, text }
    passages.push(passage)
    current.passageIds.push(id)
  }

  const startSection = (level: number, headingText: string) => {
    const id = `s${sections.length}`
    current = { id, heading: headingText || null, level, passageIds: [] }
    sections.push(current)
    headings.push({ level, text: headingText, sectionId: id })
  }

  const rewriter = new HTMLRewriter()
    /**
     * Chrome: navigation, headers, footers and sidebars.
     *
     * These carry no page content but they wrecked extraction — sections run from one
     * heading to the next, and a footer has no headings, so every footer link was
     * absorbed into whatever the last heading happened to be. On one page that gave a
     * "related post" heading 22 passages of nav links, phone numbers and social handles,
     * which the decision model then judged as a section that promises and delivers
     * nothing (finding F12).
     *
     * Note `body > header` rather than bare `header`: an article title normally lives
     * in `<header><h1>…</h1></header>`, so suppressing every header deleted the page's
     * H1 and produced a false "this page has no H1".
     */
    .on('nav, footer, aside, body > header, [role="navigation"], [role="contentinfo"], [role="banner"], [role="complementary"]', {
      element(el) {
        suppressed++
        el.onEndTag(() => {
          suppressed = Math.max(0, suppressed - 1)
        })
      },
    })
    // Content we must never treat as page text.
    .on('script, style, template', {
      element(el) {
        const type = el.getAttribute('type') ?? ''
        if (type.toLowerCase() === 'application/ld+json') {
          capturing = 'jsonld'
          buffer = []
          el.onEndTag(() => {
            jsonLdRaw.push(buffer.join(''))
            buffer = []
            capturing = null
          })
          return
        }
        suppressed++
        el.onEndTag(() => {
          suppressed = Math.max(0, suppressed - 1)
        })
      },
      text(t) {
        if (capturing === 'jsonld') buffer.push(t.text)
        else scriptBytes += t.text.length
      },
    })
    .on('noscript', {
      element() {
        hasNoscript = true
      },
    })
    .on('html', {
      element(el) {
        lang = el.getAttribute('lang')
      },
    })
    .on('title', {
      element(el) {
        if (title !== null) return
        capturing = 'title'
        buffer = []
        el.onEndTag(() => {
          title = normalizeText(buffer.join('')) || null
          buffer = []
          capturing = null
        })
      },
      text(t) {
        if (capturing === 'title') buffer.push(t.text)
      },
    })
    .on('meta', {
      element(el) {
        const name = (el.getAttribute('name') ?? '').toLowerCase()
        if (name === 'description') metaDescription = el.getAttribute('content')
        if (name === 'robots') metaRobots = el.getAttribute('content')
      },
    })
    .on('link[rel="canonical"]', {
      element(el) {
        canonical = el.getAttribute('href')
      },
    })
    .on('h1, h2, h3, h4, h5, h6', {
      element(el) {
        if (suppressed > 0) return
        if (capturing === 'passage') flushPassage()
        pendingLevel = Number(el.tagName.slice(1)) || 1
        capturing = 'heading'
        buffer = []
        el.onEndTag(() => {
          startSection(pendingLevel, normalizeText(buffer.join('')))
          buffer = []
          capturing = null
        })
      },
      text(t) {
        if (suppressed > 0) return
        if (capturing === 'heading') {
          buffer.push(t.text)
          textBytes += t.text.length
        }
      },
    })
    .on(Object.keys(PASSAGE_TAGS).join(', '), {
      element(el) {
        if (suppressed > 0) return
        // A nested passage element (li > p) closes the outer buffer first.
        if (capturing === 'passage') flushPassage()
        pendingKind = PASSAGE_TAGS[el.tagName.toLowerCase()] ?? 'paragraph'
        capturing = 'passage'
        buffer = []
        el.onEndTag(() => {
          if (capturing === 'passage') flushPassage()
          capturing = null
        })
      },
      text(t) {
        if (suppressed > 0) return
        if (capturing === 'passage') {
          buffer.push(t.text)
          textBytes += t.text.length
        }
      },
    })
    .on('a[href]', {
      element(el) {
        const href = el.getAttribute('href')
        if (!href) return
        pendingLinkHref = href
        pendingLinkRel = el.getAttribute('rel')
        const linkBuf: string[] = []
        // Link text also belongs to whatever passage encloses it, so it is not
        // captured here — only the href inventory matters at this stage.
        links.push({
          href: resolve(href, baseUrl),
          text: normalizeText(linkBuf.join('')),
          rel: pendingLinkRel,
        })
        pendingLinkHref = null
      },
    })

  const response = rewriter.transform(
    new Response(html, { headers: { 'content-type': 'text/html' } }),
  )
  await response.arrayBuffer()

  // Trailing content with no closing tag.
  if (capturing === 'passage') flushPassage()

  // Boilerplate: the same text appearing under DIFFERENT headings is a byline, nav
  // item, teaser or card blurb — not section content (finding F12).
  //
  // Counting occurrences alone is wrong: a word like "Google" can legitimately appear
  // twice inside one section. What gives boilerplate away is crossing section
  // boundaries, which real prose does not do.
  const sectionsByText = new Map<string, Set<string>>()
  for (const passage of passages) {
    const key = passage.text.slice(0, 160)
    const set = sectionsByText.get(key) ?? new Set<string>()
    set.add(passage.sectionId)
    sectionsByText.set(key, set)
  }
  const boilerplate = new Set<string>()
  for (const passage of passages) {
    const spread = sectionsByText.get(passage.text.slice(0, 160))?.size ?? 0
    if (spread >= 2) boilerplate.add(passage.id)
  }

  const passagesById = new Map(passages.map((p) => [p.id, p]))
  const populated = sections.filter((s) => s.passageIds.length > 0 || s.heading !== null)

  return {
    title,
    metaDescription,
    lang,
    canonical,
    metaRobots,
    headings,
    sections: populated,
    passages,
    passagesById,
    jsonLdRaw,
    links,
    boilerplatePassageIds: boilerplate,
    jsDependency: {
      scriptBytes,
      textBytes,
      hasNoscript,
      // A page whose script vastly outweighs its text is probably rendered client-side,
      // meaning the served HTML is not what a reader — or an AI system — actually sees.
      likely: textBytes < 500 && scriptBytes > textBytes * 3,
    },
    textBytes,
  }
}

function resolve(href: string, base: string): string {
  try {
    return new URL(href, base).toString()
  } catch {
    return href
  }
}
