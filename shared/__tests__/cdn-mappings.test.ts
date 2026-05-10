import { describe, it, expect } from 'vitest'
import { extractVersion, extractFile, buildCDNUrl, CDN_SOURCES, CDN_BY_ID } from './cdn-mappings'

describe('cdn-mappings', () => {
  describe('CDN_SOURCES', () => {
    it('should be a non-empty array', () => {
      expect(Array.isArray(CDN_SOURCES)).toBe(true)
      expect(CDN_SOURCES.length).toBeGreaterThan(0)
    })

    it('should contain objects with required properties', () => {
      for (const source of CDN_SOURCES) {
        expect(source).toHaveProperty('id')
        expect(source).toHaveProperty('name')
        expect(source).toHaveProperty('baseUrl')
        expect(source).toHaveProperty('format')
      }
    })
  })

  describe('CDN_BY_ID', () => {
    it('should be an object', () => {
      expect(typeof CDN_BY_ID).toBe('object')
    })

    it('should map all CDN sources by their id', () => {
      for (const source of CDN_SOURCES) {
        expect(CDN_BY_ID[source.id]).toEqual(source)
      }
    })
  })

  describe('extractVersion', () => {
    it('should return null for empty URL', () => {
      expect(extractVersion('', [/v(\d+)/])).toBeNull()
    })

    it('should return null if no pattern matches', () => {
      expect(extractVersion('https://example.com/foo.js', [/v(\d+)/])).toBeNull()
    })

    it('should extract version using the first matching pattern', () => {
      const patterns = [
        /jquery[-.]?([\d.]+)?\.min\.js/i,
        /jquery\.js/i,
        /jquery-(\d+\.\d+\.\d+)\.js/i,
      ]
      expect(extractVersion('https://example.com/jquery-3.6.0.min.js', patterns)).toBe('3.6.0')
      expect(extractVersion('https://example.com/jquery-1.12.4.js', patterns)).toBe('1.12.4')
    })
  })

  describe('extractFile', () => {
    it('should extract the filename from a valid URL', () => {
      expect(extractFile('https://example.com/path/to/file.js')).toBe('file.js')
      expect(extractFile('https://example.com/jquery.min.js')).toBe('jquery.min.js')
    })

    it('should return empty string for invalid URL', () => {
      expect(extractFile('')).toBe('')
    })
  })

  describe('buildCDNUrl', () => {
    const bootcdn = CDN_SOURCES.find((s) => s.id === 'bootcdn')!
    const jsdelivr = CDN_SOURCES.find((s) => s.id === 'jsdelivr')!

    const libConfig = {
      name: 'jquery',
      file: 'jquery.min.js',
      defaultVersion: '3.6.0',
    }

    it('should build URL for bootcdn format', () => {
      const url = buildCDNUrl(bootcdn, libConfig, '3.6.0', 'jquery.min.js')
      expect(url).toBe('https://cdn.bootcdn.net/ajax/libs/jquery/3.6.0/jquery.min.js')
    })

    it('should build URL for npm format', () => {
      const url = buildCDNUrl(jsdelivr, libConfig, '3.6.0', 'jquery.min.js')
      expect(url).toBe('https://cdn.jsdelivr.net/npm/jquery@3.6.0/jquery.min.js')
    })

    it('should use defaultVersion if version is not provided', () => {
      const url = buildCDNUrl(bootcdn, libConfig, null, 'jquery.min.js')
      expect(url).toBe('https://cdn.bootcdn.net/ajax/libs/jquery/3.6.0/jquery.min.js')
    })

    it('should use libConfig.file if file is not provided', () => {
      const url = buildCDNUrl(bootcdn, libConfig, '3.6.0', null)
      expect(url).toBe('https://cdn.bootcdn.net/ajax/libs/jquery/3.6.0/jquery.min.js')
    })
  })
})
