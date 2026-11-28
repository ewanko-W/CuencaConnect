import { describe, expect, it } from 'vitest'

/**
 * CLAUDE.md: no emojis in the UI; use lucide-react icons with labels.
 * This scans every non-test source file for emoji and pictographic
 * symbols (including arrows, stars, dots, and check marks used as icons).
 */
const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const PICTOGRAPH = /[\p{Extended_Pictographic}←-⇿★☆○●✓✔✕✖✗✘]/u

describe('no emojis or pictographic symbols in the UI', () => {
  it('scans a meaningful number of source files', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50)
  })

  it('finds none', () => {
    const hits: string[] = []
    for (const [file, text] of Object.entries(sources)) {
      text.split('\n').forEach((line, index) => {
        const match = line.match(PICTOGRAPH)
        if (match) hits.push(`${file.replace('../', 'src/')}:${index + 1} "${match[0]}"`)
      })
    }
    expect(hits).toEqual([])
  })
})
