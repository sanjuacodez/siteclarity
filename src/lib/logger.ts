/** Structured logging. Never use bare console.log in committed code (see CONTRIBUTING.md). */
import { redactSecrets } from './errors'

type Level = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void
  info(msg: string, fields?: Record<string, unknown>): void
  warn(msg: string, fields?: Record<string, unknown>): void
  error(msg: string, fields?: Record<string, unknown>): void
}

/**
 * Every line goes through the same redaction the error responses use.
 *
 * Nothing logs a key today, and SECURITY.md says so. That was true only because no
 * call site happened to log one — an upstream failure whose message echoed a request
 * header would have put a visitor's key in the log with nobody noticing. Making the
 * claim structural costs one function call per line.
 */
function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  const line = redactSecrets(JSON.stringify({ level, msg, ts: Date.now(), ...fields }))
  if (level === 'error' || level === 'warn') console.error(line)
  else console.log(line)
}

export const logger: Logger = {
  debug: (m, f) => emit('debug', m, f),
  info: (m, f) => emit('info', m, f),
  warn: (m, f) => emit('warn', m, f),
  error: (m, f) => emit('error', m, f),
}
