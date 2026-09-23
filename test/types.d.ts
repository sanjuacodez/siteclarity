// Vite's `?raw` imports — used to load frozen HTML fixtures into tests.
declare module '*.html?raw' {
  const content: string
  export default content
}

// Vite resolves `import.meta.glob` at build time; the registry guard uses it to discover
// catalogue files on disk rather than trusting a hand-maintained list.
interface ImportMeta {
  glob<T = unknown>(pattern: string, options?: { eager?: boolean }): Record<string, T>
}

// Raw text imports used by tests that assert prose matches configuration.
declare module '*.md?raw' {
  const content: string
  export default content
}
declare module '*.jsonc?raw' {
  const content: string
  export default content
}
