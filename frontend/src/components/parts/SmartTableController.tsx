'use client'

/**
 * SmartTableController — invisible React component that hunts down every
 * `.dv-smart-table-wrap` inside the doc editor and installs:
 *
 *   1. A `+ column` button on the right edge (adds a header cell + one
 *      new <td> per row, auto-labelled Column D/E/F…).
 *   2. A `+ row` button along the bottom (adds a <tr> matching the
 *      current column count, cells prefilled with placeholders).
 *   3. Micro delete-buttons on hover of row / column headers (× marks).
 *   4. Keyboard navigation:
 *        · Tab / Shift+Tab moves to next / previous cell
 *        · Arrow keys move up / down / left / right
 *        · Enter moves down one row
 *        · Ctrl+Enter inserts a new row below the current one
 *
 * All mutations happen directly on the contentEditable DOM — no React
 * state — then call `onAfterChange()` so the parent's autosave persists.
 * A MutationObserver re-scans whenever tables are added/removed so
 * newly-inserted smart tables get wired without a page reload.
 */

import { useEffect } from 'react'

interface Props {
  /** The contentEditable editor element to scan for smart tables. */
  editorRef: React.RefObject<HTMLDivElement | null>
  /** Called after any table mutation so the parent can autosave. */
  onAfterChange: () => void
}

const AUTO_HEADER = (idx: number): string => {
  // Column A..Z, then AA, AB... for very wide tables.
  if (idx < 26) return `Column ${String.fromCharCode(65 + idx)}`
  return `Column ${String.fromCharCode(65 + Math.floor(idx / 26) - 1)}${String.fromCharCode(65 + (idx % 26))}`
}

const AUTO_CELL = (col: number, row: number): string => {
  // Row-first placeholder — reads like "R2 C3" so users see live coords
  // but can overwrite immediately (contentEditable + focused).
  return `R${row + 1} C${col + 1}`
}

export default function SmartTableController({
  editorRef,
  onAfterChange,
}: Props): null {
  useEffect(() => {
    const editor = editorRef.current
    if (editor === null) return

    // ── DOM helpers ───────────────────────────────────────────────────

    /** Ensure a smart-table wrapper has its +col / +row buttons + delete
     *  micro-buttons in row/col headers. Idempotent — running it twice
     *  on the same wrap is a no-op. */
    const hydrateWrap = (wrap: HTMLElement): void => {
      const table = wrap.querySelector<HTMLTableElement>('table.dv-smart-table')
      if (table === null) return

      // Row/column delete buttons on headers.
      const headerRow = table.querySelector<HTMLTableRowElement>('thead tr')
      if (headerRow !== null) {
        Array.from(headerRow.cells).forEach((th, colIdx) => {
          if (th.querySelector('.dv-smart-table-colbtn') !== null) return
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.className = 'dv-smart-table-colbtn'
          btn.contentEditable = 'false'
          btn.setAttribute('aria-label', `Delete column ${colIdx + 1}`)
          btn.title = 'Delete column'
          btn.textContent = '×'
          btn.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            deleteColumn(table, colIdx)
            onAfterChange()
          })
          th.appendChild(btn)
        })
      }
      Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr')).forEach(
        (tr, rowIdx) => {
          const firstCell = tr.cells[0]
          if (firstCell === undefined) return
          if (firstCell.querySelector('.dv-smart-table-rowbtn') !== null) return
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.className = 'dv-smart-table-rowbtn'
          btn.contentEditable = 'false'
          btn.setAttribute('aria-label', `Delete row ${rowIdx + 1}`)
          btn.title = 'Delete row'
          btn.textContent = '×'
          btn.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            deleteRow(table, rowIdx)
            onAfterChange()
          })
          firstCell.appendChild(btn)
        },
      )

      // + column button (right edge of wrapper).
      if (wrap.querySelector('.dv-smart-table-addcol') === null) {
        const addCol = document.createElement('button')
        addCol.type = 'button'
        addCol.className = 'dv-smart-table-addcol'
        addCol.contentEditable = 'false'
        addCol.setAttribute('aria-label', 'Add column')
        addCol.title = 'Add column'
        addCol.textContent = '+'
        addCol.addEventListener('click', (e) => {
          e.preventDefault()
          addColumn(table)
          hydrateWrap(wrap)  // re-wire the new column's delete button
          onAfterChange()
        })
        wrap.appendChild(addCol)
      }

      // + row button (bottom of wrapper).
      if (wrap.querySelector('.dv-smart-table-addrow') === null) {
        const addRow = document.createElement('button')
        addRow.type = 'button'
        addRow.className = 'dv-smart-table-addrow'
        addRow.contentEditable = 'false'
        addRow.setAttribute('aria-label', 'Add row')
        addRow.title = 'Add row'
        addRow.textContent = '+'
        addRow.addEventListener('click', (e) => {
          e.preventDefault()
          const newTr = addRow_(table)
          hydrateWrap(wrap)  // re-wire delete button on the new row
          // Focus the first cell of the new row so the user can type
          // straight away — matches the "smooth" flow they asked for.
          const firstCell = newTr.cells[0]
          if (firstCell !== undefined) placeCaretIn(firstCell)
          onAfterChange()
        })
        wrap.appendChild(addRow)
      }
    }

    const addColumn = (table: HTMLTableElement): void => {
      const headerRow = table.querySelector<HTMLTableRowElement>('thead tr')
      const bodyRows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr'))
      const nextColIdx = headerRow?.cells.length ?? 0

      if (headerRow !== null) {
        const th = document.createElement('th')
        th.textContent = AUTO_HEADER(nextColIdx)
        headerRow.appendChild(th)
      }
      bodyRows.forEach((tr, rowIdx) => {
        const td = document.createElement('td')
        td.textContent = AUTO_CELL(nextColIdx, rowIdx)
        tr.appendChild(td)
      })
    }

    const addRow_ = (table: HTMLTableElement): HTMLTableRowElement => {
      const tbody =
        table.querySelector<HTMLTableSectionElement>('tbody') ??
        table.appendChild(document.createElement('tbody'))
      const nCols =
        table.querySelector<HTMLTableRowElement>('thead tr')?.cells.length ?? 3
      const nRows = tbody.rows.length
      const tr = document.createElement('tr')
      for (let c = 0; c < nCols; c++) {
        const td = document.createElement('td')
        td.textContent = AUTO_CELL(c, nRows)
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
      return tr
    }

    const deleteColumn = (table: HTMLTableElement, colIdx: number): void => {
      const headerRow = table.querySelector<HTMLTableRowElement>('thead tr')
      if (headerRow !== null && headerRow.cells[colIdx] !== undefined) {
        headerRow.deleteCell(colIdx)
      }
      table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) => {
        if (tr.cells[colIdx] !== undefined) tr.deleteCell(colIdx)
      })
    }

    const deleteRow = (table: HTMLTableElement, rowIdx: number): void => {
      const tbody = table.querySelector<HTMLTableSectionElement>('tbody')
      if (tbody !== null && tbody.rows[rowIdx] !== undefined) {
        tbody.deleteRow(rowIdx)
      }
    }

    const placeCaretIn = (cell: HTMLElement): void => {
      const range = document.createRange()
      range.selectNodeContents(cell)
      range.collapse(false)  // end of text
      const sel = window.getSelection()
      if (sel !== null) {
        sel.removeAllRanges()
        sel.addRange(range)
      }
      ;(cell as HTMLElement).focus()
    }

    // ── Keyboard navigation ───────────────────────────────────────────

    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (target === null) return
      const cell = target.closest<HTMLTableCellElement>('td, th')
      if (cell === null) return
      const table = cell.closest<HTMLTableElement>('table.dv-smart-table')
      if (table === null) return

      const row = cell.closest<HTMLTableRowElement>('tr')
      if (row === null) return
      const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tr'))
      const rowIdx = rows.indexOf(row)
      const colIdx = Array.from(row.cells).indexOf(cell)

      const moveTo = (r: number, c: number): void => {
        const targetRow = rows[r]
        if (targetRow === undefined) return
        const targetCell = targetRow.cells[c]
        if (targetCell === undefined) return
        e.preventDefault()
        placeCaretIn(targetCell)
      }

      // Tab / Shift+Tab — walk row-major through all cells.
      if (e.key === 'Tab') {
        const flat = rows.flatMap((r) => Array.from(r.cells))
        const flatIdx = flat.indexOf(cell)
        const next = e.shiftKey ? flatIdx - 1 : flatIdx + 1
        if (next >= 0 && next < flat.length) {
          e.preventDefault()
          placeCaretIn(flat[next]!)
        } else if (!e.shiftKey && next === flat.length) {
          // Off the end — auto-add a new row and land in its first cell.
          e.preventDefault()
          const newTr = addRow_(table)
          const wrap = table.closest<HTMLElement>('.dv-smart-table-wrap')
          if (wrap !== null) hydrateWrap(wrap)
          placeCaretIn(newTr.cells[0]!)
          onAfterChange()
        }
        return
      }

      // Enter — down one row (or Ctrl+Enter to insert a fresh row).
      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.ctrlKey || e.metaKey) {
          const newTr = addRow_(table)
          const wrap = table.closest<HTMLElement>('.dv-smart-table-wrap')
          if (wrap !== null) hydrateWrap(wrap)
          placeCaretIn(newTr.cells[colIdx] ?? newTr.cells[0]!)
          onAfterChange()
        } else if (rows[rowIdx + 1] !== undefined) {
          moveTo(rowIdx + 1, colIdx)
        } else {
          // Last row + plain Enter — create one and jump into it.
          const newTr = addRow_(table)
          const wrap = table.closest<HTMLElement>('.dv-smart-table-wrap')
          if (wrap !== null) hydrateWrap(wrap)
          placeCaretIn(newTr.cells[colIdx] ?? newTr.cells[0]!)
          onAfterChange()
        }
        return
      }

      // Arrow keys — only navigate if the caret is at the edge of the
      // cell's text (otherwise let the browser move within the cell).
      const sel = window.getSelection()
      if (sel === null || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      const cellText = cell.textContent ?? ''

      if (e.key === 'ArrowUp' && rowIdx > 0) {
        moveTo(rowIdx - 1, colIdx)
      } else if (e.key === 'ArrowDown' && rows[rowIdx + 1] !== undefined) {
        moveTo(rowIdx + 1, colIdx)
      } else if (e.key === 'ArrowLeft' && range.startOffset === 0 && colIdx > 0) {
        moveTo(rowIdx, colIdx - 1)
      } else if (
        e.key === 'ArrowRight' &&
        range.endOffset === cellText.length &&
        row.cells[colIdx + 1] !== undefined
      ) {
        moveTo(rowIdx, colIdx + 1)
      }
    }

    // ── Initial hydration + observer ─────────────────────────────────

    const hydrateAll = (): void => {
      const wraps = editor.querySelectorAll<HTMLElement>('.dv-smart-table-wrap')
      wraps.forEach((w) => hydrateWrap(w))
      // Make sure every td/th is focusable via tabIndex so contentEditable
      // + arrow-nav both play nicely. tabIndex=-1 lets us focus() them
      // programmatically without breaking Tab-order everywhere else.
      editor.querySelectorAll('table.dv-smart-table td, table.dv-smart-table th').forEach(
        (c) => {
          const el = c as HTMLTableCellElement
          if (el.tabIndex === undefined || el.tabIndex >= 0) el.tabIndex = -1
        },
      )
    }
    hydrateAll()

    editor.addEventListener('keydown', onKeyDown as EventListener)
    const observer = new MutationObserver(() => hydrateAll())
    observer.observe(editor, { childList: true, subtree: true })

    return () => {
      editor.removeEventListener('keydown', onKeyDown as EventListener)
      observer.disconnect()
    }
  }, [editorRef, onAfterChange])

  return null
}
