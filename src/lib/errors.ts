/** Typed failures. Modules return these rather than throwing across boundaries. */

export type ErrorCode =
  | 'invalid_url'
  | 'blocked_url'
  | 'robots_disallowed'
  | 'fetch_failed'
  | 'not_html'
  | 'too_large'
  | 'decision_backend_unavailable'
  | 'decision_invalid_response'
  | 'internal'

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: redactSecrets(this.message),
        details: this.details === undefined ? undefined : redactSecrets(String(this.details)),
      },
    }
  }
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })
export const err = <T = never>(
  code: ErrorCode,
  message: string,
  details?: unknown,
): Result<T> => ({ ok: false, error: new AppError(code, message, details) })

/**
 * Strip anything that looks like a credential before it reaches a response or a log.
 *
 * A caller-supplied key travels through this process, so an upstream error that echoes
 * a request header would otherwise hand it straight back in the response body.
 */
export function redactSecrets(text: string): string {
  return text
    .replace(/\bBearer\s+[A-Za-z0-9._\-]{16,}/gi, 'Bearer [redacted]')
    .replace(/\b(sk|key|tok|jev)[-_][A-Za-z0-9._\-]{16,}/gi, '[redacted]')
    .replace(/([?&](?:api[-_]?key|key|token)=)[^&\s]+/gi, '$1[redacted]')
}

/** HTTP status for each error code. */
export function statusFor(code: ErrorCode): number {
  switch (code) {
    case 'invalid_url':
    case 'not_html':
      return 400
    case 'blocked_url':
    case 'robots_disallowed':
      return 403
    case 'too_large':
      return 413
    case 'fetch_failed':
      return 502
    case 'decision_backend_unavailable':
      return 503
    case 'decision_invalid_response':
    case 'internal':
      return 500
  }
}
