/**
 * Live doc statistics — word count, character count, reading time.
 *
 * All derived from the editor's current innerHTML via a light HTML
 * strip. Cheap enough to recompute on every keystroke.
 *
 * Reading time uses 220 words/min (average adult reading pace for
 * technical prose). Displayed as `~N min read` — rounded up so a
 * 3-word doc doesn't say "0 min read".
 */

const WORDS_PER_MIN = 220

export interface DocStats {
  words: number
  chars: number
  charsNoSpaces: number
  readingMin: number
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export function computeDocStats(html: string): DocStats {
  const text = stripHtml(html)
  const chars = text.length
  const charsNoSpaces = text.replace(/\s/g, '').length
  const words = text === '' ? 0 : text.split(/\s+/).length
  const readingMin = Math.max(1, Math.ceil(words / WORDS_PER_MIN))
  return { words, chars, charsNoSpaces, readingMin }
}
