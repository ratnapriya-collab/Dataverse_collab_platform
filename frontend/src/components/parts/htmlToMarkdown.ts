/**
 * htmlToMarkdown — small, dependency-free HTML→MD converter for doc export.
 *
 * Deliberately covers only what our editor produces (headings, paragraphs,
 * bold/italic/underline/strike, ordered + unordered + checklist lists,
 * images, links, code blocks, blockquotes, our callout blocks, and the
 * inline chip elements we render for mentions/tags/parts). Anything
 * unknown falls back to its plain text content.
 *
 * Not a general-purpose HTML→MD library — keeps zero dependencies +
 * predictable output for our specific editor's markup.
 */

function textOf(node: Node): string {
  return (node.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function walk(nodes: NodeListOf<ChildNode> | ChildNode[]): string {
  let out = ''
  for (const n of Array.from(nodes)) {
    out += renderNode(n)
  }
  return out
}

function renderNode(n: ChildNode): string {
  if (n.nodeType === Node.TEXT_NODE) {
    return (n.textContent ?? '').replace(/\s+/g, ' ')
  }
  if (n.nodeType !== Node.ELEMENT_NODE) return ''
  const el = n as HTMLElement
  const tag = el.tagName.toLowerCase()

  // Our inline chip elements — render as plain markers so they read
  // sensibly in markdown.
  if (el.classList.contains('dv-mention')) return `**${textOf(el)}**`
  if (el.classList.contains('dv-tag-chip')) return `\`${textOf(el)}\``
  if (el.classList.contains('dv-part-chip')) return `\`${textOf(el)}\``

  switch (tag) {
    case 'h1':          return `\n\n# ${walk(el.childNodes).trim()}\n\n`
    case 'h2':          return `\n\n## ${walk(el.childNodes).trim()}\n\n`
    case 'h3':          return `\n\n### ${walk(el.childNodes).trim()}\n\n`
    case 'h4':          return `\n\n#### ${walk(el.childNodes).trim()}\n\n`
    case 'h5':          return `\n\n##### ${walk(el.childNodes).trim()}\n\n`
    case 'h6':          return `\n\n###### ${walk(el.childNodes).trim()}\n\n`
    case 'p':           return `\n\n${walk(el.childNodes).trim()}\n\n`
    case 'br':          return '  \n'
    case 'strong':
    case 'b':           return `**${walk(el.childNodes)}**`
    case 'em':
    case 'i':           return `*${walk(el.childNodes)}*`
    case 'u':           return `<u>${walk(el.childNodes)}</u>` // MD has no native underline
    case 'strike':
    case 's':
    case 'del':         return `~~${walk(el.childNodes)}~~`
    case 'a': {
      const href = el.getAttribute('href') ?? ''
      return `[${walk(el.childNodes)}](${href})`
    }
    case 'img': {
      const src = el.getAttribute('src') ?? ''
      const alt = el.getAttribute('alt') ?? ''
      return `![${alt}](${src})`
    }
    case 'code':        return `\`${textOf(el)}\``
    case 'pre':         return `\n\n\`\`\`\n${textOf(el)}\n\`\`\`\n\n`
    case 'blockquote':  return `\n\n> ${walk(el.childNodes).trim().replace(/\n/g, '\n> ')}\n\n`
    case 'hr':          return `\n\n---\n\n`
    case 'ul': {
      let out = '\n'
      for (const li of Array.from(el.children)) {
        if (li.tagName.toLowerCase() !== 'li') continue
        const prefix = el.classList.contains('checklist') ? '- [ ] ' : '- '
        out += `${prefix}${walk(li.childNodes).trim()}\n`
      }
      return out + '\n'
    }
    case 'ol': {
      let out = '\n'
      let i = 1
      for (const li of Array.from(el.children)) {
        if (li.tagName.toLowerCase() !== 'li') continue
        out += `${i}. ${walk(li.childNodes).trim()}\n`
        i++
      }
      return out + '\n'
    }
    case 'table': {
      // Very basic — first row is headers, rest are data.
      const rows: string[][] = []
      for (const tr of Array.from(el.querySelectorAll('tr'))) {
        const cells: string[] = []
        for (const c of Array.from(tr.querySelectorAll('td, th'))) {
          cells.push((c.textContent ?? '').replace(/\s+/g, ' ').trim())
        }
        if (cells.length > 0) rows.push(cells)
      }
      if (rows.length === 0) return ''
      const [header, ...body] = rows
      const separator = header!.map(() => '---')
      const line = (r: string[]): string => `| ${r.join(' | ')} |`
      return `\n\n${line(header!)}\n${line(separator)}\n${body.map(line).join('\n')}\n\n`
    }
    // Everything else — just walk the children.
    default:
      return walk(el.childNodes)
  }
}

/** Convert the editor's innerHTML to Markdown. */
export function htmlToMarkdown(html: string): string {
  if (typeof window === 'undefined') return html
  const div = document.createElement('div')
  div.innerHTML = html
  const md = walk(div.childNodes)
  // Collapse >2 newlines to exactly 2, trim edges.
  return md.replace(/\n{3,}/g, '\n\n').trim() + '\n'
}
