/** Structured logging. Never use bare console.log in committed code (see CONTRIBUTING.md). */

type Level = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void
  info(msg: string, fields?: Record<string, unknown>): void
  warn(msg: string, fields?: Record<string, unknown>): void
  error(msg: string, fields?: Record<string, unknown>): void
}

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({ level, msg, ts: Date.now(), ...fields })
  if (level === 'error' || level === 'warn') console.error(line)
  else console.log(line)
}

export const logger: Logger = {
  debug: (m, f) => emit('debug', m, f),
  info: (m, f) => emit('info', m, f),
  warn: (m, f) => emit('warn', m, f),
  error: (m, f) => emit('error', m, f),
}
