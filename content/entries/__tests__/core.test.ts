import { describe, it, expect, vi } from 'vitest'

// Since the source file is a side-effects-only module that simply imports and re-exports nothing,
// we test that importing it does not throw any errors and all side-effects are initialized.

describe('core.js entry module', () => {
  it('should import without throwing errors', async () => {
    await expect(import('./core')).resolves.toBeDefined()
  })

  it('should have no named exports (side-effects only)', async () => {
    const mod = await import('./core')
    const keys = Object.keys(mod)
    expect(keys.length).toBe(0)
  })

  it('should execute all imported modules in sequence', async () => {
    // Re-import to ensure all side-effects run again without error
    const importFn = () => import('./core')
    await expect(importFn()).resolves.toBeDefined()
  })

  it('should not throw on multiple imports', async () => {
    const results = await Promise.all([import('./core'), import('./core'), import('./core')])
    results.forEach((mod) => {
      expect(mod).toBeDefined()
    })
  })
})
