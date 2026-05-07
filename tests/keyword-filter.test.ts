import { describe, it, expect } from 'vitest'

describe('KeywordFilter', () => {
  describe('createKeywordFilter', () => {
    it('should create a filter with default keywords', async () => {
      const { createKeywordFilter } = await import('../content/utils/keyword-filter.js')
      const filter = createKeywordFilter({
        domain: 'test.com',
        defaultKeywords: ['spam', 'ads'],
      })

      expect(filter.getKeywords()).toEqual(['spam', 'ads'])
    })

    it('should match keywords case-insensitively by default', async () => {
      const { createKeywordFilter } = await import('../content/utils/keyword-filter.js')
      const filter = createKeywordFilter({
        defaultKeywords: ['SPAM'],
      })

      expect(filter.match('This is spam content')).toBe(true)
      expect(filter.match('This is SPAM content')).toBe(true)
    })

    it('should find all matching keywords', async () => {
      const { createKeywordFilter } = await import('../content/utils/keyword-filter.js')
      const filter = createKeywordFilter({
        defaultKeywords: ['spam', 'ads', 'promo'],
      })

      const matches = filter.findMatches('Check out this spam and ads!')

      expect(matches).toContain('spam')
      expect(matches).toContain('ads')
      expect(matches).not.toContain('promo')
    })

    it('should add and remove keywords', async () => {
      const { createKeywordFilter } = await import('../content/utils/keyword-filter.js')
      const filter = createKeywordFilter({
        defaultKeywords: ['spam'],
      })

      filter.add(['ads', 'promo'])
      expect(filter.getKeywords()).toEqual(['spam', 'ads', 'promo'])

      filter.remove('ads')
      expect(filter.getKeywords()).toEqual(['spam', 'promo'])
    })

    it('should reset to default keywords', async () => {
      const { createKeywordFilter } = await import('../content/utils/keyword-filter.js')
      const filter = createKeywordFilter({
        defaultKeywords: ['spam'],
      })

      filter.add(['ads'])
      filter.setUserKeywords(['promo'])

      filter.reset()

      expect(filter.getKeywords()).toEqual(['spam'])
    })
  })
})
