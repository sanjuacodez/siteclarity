import { describe, it, expect } from 'vitest'
import {
  TEMPLATE_GROUPS,
  QUESTION_GROUPS,
  REGISTERED_EXPORTS,
  MODULE_INFO,
  builtModules,
  plannedModules,
  allCheckIds,
  allQuestionIds,
  PROFILE_MODULES,
} from '../../src/checks/registry'
import { renderChecksPage } from '../../src/ui/checks'
import { ProfileDimension } from '../../src/contracts'

/**
 * The guard that makes the registry worth having.
 *
 * A registry on its own only relocates the mistake: you still have to remember to add
 * to it. This discovers every catalogue export that actually exists on disk and fails
 * if one is unregistered — so forgetting is caught by the suite, not by someone
 * noticing a missing section on the checks page.
 *
 * `import.meta.glob` is resolved by Vite at build time, so this sees real files rather
 * than a list someone maintained by hand.
 */
const MODULES = import.meta.glob('../../src/{static,semantic}/**/*.ts', { eager: true }) as Record<
  string,
  Record<string, unknown>
>

/** A catalogue is an object export whose values all look like templates or questions. */
function isCatalogue(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return false
  return entries.every(([, v]) => {
    if (!v || typeof v !== 'object') return false
    const o = v as Record<string, unknown>
    const isTemplate = 'observation' in o && 'whyItMatters' in o && 'recommendedAction' in o
    const isQuestion = 'type' in o && 'instructions' in o && 'criteria' in o
    return isTemplate || isQuestion
  })
}

function discoverCatalogues(): { file: string; name: string }[] {
  const found: { file: string; name: string }[] = []
  for (const [file, mod] of Object.entries(MODULES)) {
    for (const [name, value] of Object.entries(mod)) {
      if (name === 'default') continue
      if (isCatalogue(value)) found.push({ file, name })
    }
  }
  return found
}

describe('catalogue registry', () => {
  it('finds catalogues on disk at all', () => {
    // If discovery silently returned nothing, every assertion below would pass
    // vacuously — which is exactly how the original omission went unnoticed.
    const found = discoverCatalogues()
    expect(found.length).toBeGreaterThanOrEqual(REGISTERED_EXPORTS.length)
  })

  it('registers every catalogue that exists', () => {
    const missing = discoverCatalogues()
      .filter(({ name }) => !REGISTERED_EXPORTS.includes(name as never))
      .map(({ file, name }) => `${name} in ${file}`)

    expect(
      missing,
      `Unregistered catalogue(s). Add them to src/checks/registry.ts:\n  ${missing.join('\n  ')}`,
    ).toEqual([])
  })

  it('registers nothing that no longer exists', () => {
    const onDisk = new Set(discoverCatalogues().map((c) => c.name))
    const stale = REGISTERED_EXPORTS.filter((name) => !onDisk.has(name))
    expect(stale, `Registered but not found on disk: ${stale.join(', ')}`).toEqual([])
  })

  it('assigns every template group a module and a unique anchor', () => {
    const ids = TEMPLATE_GROUPS.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const g of TEMPLATE_GROUPS) {
      expect(g.module, `${g.id} has no module`).toBeTruthy()
      expect(Object.keys(g.templates).length, `${g.id} is empty`).toBeGreaterThan(0)
    }
  })

  it('has no duplicate check or question ids across catalogues', () => {
    // A duplicate id would make one catalogue's copy silently shadow another's.
    const checks = allCheckIds()
    expect(new Set(checks).size, `duplicate check ids: ${checks.join(', ')}`).toBe(checks.length)
    const questions = allQuestionIds()
    expect(new Set(questions).size).toBe(questions.length)
  })

  it('documents every registered check on the checks page', () => {
    const page = renderChecksPage()
    for (const id of allCheckIds()) {
      expect(page, `${id} is registered but not documented`).toContain(`Check: <code>${id}</code>`)
    }
  })

  it('documents every registered question on the checks page', () => {
    const page = renderChecksPage()
    for (const id of allQuestionIds()) {
      expect(page, `${id} is registered but not documented`).toContain(
        `Question: <code>${id}</code>`,
      )
    }
  })
})

describe('the modules section cannot go stale', () => {
  it('lists messaging as built, not planned', () => {
    // It shipped saying "Planned: messaging" after messaging was built, because the
    // section was hand-written prose.
    expect(builtModules()).toContain('messaging')
    expect(plannedModules()).not.toContain('messaging')
  })

  it('derives built state from real output, not a written list', () => {
    // Most modules are built by having a template catalogue. Module 4 emits no findings
    // at all — it produces a descriptive profile — so its evidence of existence is the
    // profile dimensions instead. Either counts; an empty claim does not.
    const withTemplates = new Set(TEMPLATE_GROUPS.map((g) => g.module))
    for (const m of builtModules()) {
      const hasTemplates = withTemplates.has(m)
      const isProfile = PROFILE_MODULES.includes(m)
      expect(
        hasTemplates || isProfile,
        `${m} is listed as built with neither a catalogue nor a profile behind it`,
      ).toBe(true)
    }
  })

  it('backs every profile module with actual dimensions', () => {
    for (const m of PROFILE_MODULES) {
      expect(builtModules(), `${m} claims a profile but is not built`).toContain(m)
    }
    expect(ProfileDimension.options.length).toBeGreaterThan(0)
  })

  it('accounts for every module exactly once', () => {
    const all = [...builtModules(), ...plannedModules()]
    expect(new Set(all).size).toBe(all.length)
    expect(all.length).toBe(Object.keys(MODULE_INFO).length)
  })

  it('shows the real counts and no planned module among the built ones', () => {
    const page = renderChecksPage()
    expect(page).toContain(`${builtModules().length} of ${Object.keys(MODULE_INFO).length} built`)
    const planned = page.slice(page.indexOf('Planned:'), page.indexOf('Planned:') + 400)
    for (const m of builtModules()) {
      expect(planned, `${m} is built but listed as planned`)
        .not.toContain(MODULE_INFO[m].label.toLowerCase())
    }
  })
})
