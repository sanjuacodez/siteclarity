/**
 * HTML entity decoding (finding F1).
 *
 * This is not cosmetic. Evidence quotes must be verbatim substrings of what a reader
 * actually sees, so an undecoded `&#8217;` both looks broken and breaks the premise of
 * the SC-110 verification gate.
 *
 * Deliberately a small table rather than a dependency: these cover essentially all of
 * what appears in page prose, and it stays inside the CPU budget.
 */
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', copy: '©', reg: '®', trade: '™',
  eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', uuml: 'ü', ouml: 'ö',
  auml: 'ä', szlig: 'ß', ntilde: 'ñ', deg: '°', euro: '€', pound: '£',
  yen: '¥', cent: '¢', sect: '§', para: '¶', middot: '·', bull: '•',
  dagger: '†', permil: '‰', prime: '′', laquo: '«', raquo: '»',
  times: '×', divide: '÷', plusmn: '±', frac12: '½', frac14: '¼', sup2: '²', sup3: '³',
}

export function decodeEntities(input: string): string {
  if (!input.includes('&')) return input
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (match, body: string) => {
    if (body.charCodeAt(0) === 35) {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10)
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match
      // Lone surrogates are not valid scalar values.
      if (code >= 0xd800 && code <= 0xdfff) return match
      try {
        return String.fromCodePoint(code)
      } catch {
        return match
      }
    }
    return NAMED[body] ?? NAMED[body.toLowerCase()] ?? match
  })
}
