// Vite's `?raw` imports — used to load frozen HTML fixtures into tests.
declare module '*.html?raw' {
  const content: string
  export default content
}
