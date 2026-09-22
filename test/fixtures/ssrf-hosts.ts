/**
 * SC-103 — adversarial URL corpus.
 *
 * Every entry must be REJECTED. A single miss fails the task, because this is the
 * security boundary of the whole product: every byte analysed downstream enters here.
 *
 * Grouped by the trick being attempted, so a failure names the technique rather than
 * just an address.
 */
export const MUST_REJECT: { url: string; why: string }[] = [
  // Loopback, in every encoding a URL parser will accept.
  { url: 'http://127.0.0.1/', why: 'loopback dotted-quad' },
  { url: 'http://127.1/', why: 'loopback short form' },
  { url: 'http://2130706433/', why: 'loopback as a decimal integer' },
  { url: 'http://0x7f000001/', why: 'loopback as hex' },
  { url: 'http://0177.0.0.1/', why: 'loopback with an octal octet' },
  { url: 'http://0x7f.0x0.0x0.0x1/', why: 'loopback, hex per octet' },
  { url: 'http://[::1]/', why: 'IPv6 loopback' },
  { url: 'http://[::ffff:127.0.0.1]/', why: 'IPv4-mapped IPv6 loopback' },
  { url: 'http://localhost/', why: 'localhost by name' },
  { url: 'http://localhost./', why: 'localhost with a trailing dot' },
  { url: 'http://LOCALHOST/', why: 'localhost, uppercase' },
  { url: 'http://0.0.0.0/', why: 'unspecified address' },

  // Private ranges.
  { url: 'http://10.0.0.1/', why: 'RFC1918 10/8' },
  { url: 'http://172.16.0.1/', why: 'RFC1918 172.16/12 lower bound' },
  { url: 'http://172.31.255.254/', why: 'RFC1918 172.16/12 upper bound' },
  { url: 'http://192.168.1.1/', why: 'RFC1918 192.168/16' },
  { url: 'http://100.64.0.1/', why: 'CGNAT 100.64/10' },
  { url: 'http://[fd00::1]/', why: 'IPv6 unique local' },
  { url: 'http://[fe80::1]/', why: 'IPv6 link-local' },

  // Cloud metadata — the classic SSRF target.
  { url: 'http://169.254.169.254/latest/meta-data/', why: 'AWS/GCP metadata endpoint' },
  { url: 'http://169.254.170.2/', why: 'ECS task metadata' },
  { url: 'http://metadata.google.internal/', why: 'GCP metadata by name' },

  // Internal-only names.
  { url: 'http://foo.internal/', why: '.internal suffix' },
  { url: 'http://printer.local/', why: '.local suffix' },
  { url: 'http://thing.home.arpa/', why: '.home.arpa suffix' },
  { url: 'http://example.onion/', why: '.onion suffix' },

  // Authority confusion: the real host is after the @.
  { url: 'http://example.com@127.0.0.1/', why: 'credentials disguise the real host' },
  { url: 'http://user:pass@10.0.0.1/', why: 'credentials with a private host' },

  // Non-HTTP schemes.
  { url: 'file:///etc/passwd', why: 'file scheme' },
  { url: 'gopher://127.0.0.1:70/', why: 'gopher scheme' },
  { url: 'ftp://internal.example.com/', why: 'ftp scheme' },
  { url: 'data:text/html,<h1>x</h1>', why: 'data scheme' },
  { url: 'javascript:alert(1)', why: 'javascript scheme' },

  // Malformed.
  { url: '', why: 'empty' },
  { url: '   ', why: 'whitespace only' },
  { url: 'http://', why: 'no host' },
]

/** Public hosts that must be ACCEPTED — the guard must not be so broad it blocks real sites. */
export const MUST_ACCEPT: string[] = [
  'https://example.com/',
  'example.com',
  'https://sub.domain.example.co.uk/path?q=1#frag',
  'http://example.com:8080/',
  'https://xn--bcher-kva.example/',      // punycode IDN
  'https://192-168-1-1.example.com/',    // digits in a name, not an IP
  'https://1.example.com/',
  'https://internal-tools.example.com/', // "internal" as a label, not a TLD
]
