'use client'

/**
 * CapturePdfDocument — the @react-pdf/renderer Document tree for the
 * Capture-View export.
 *
 * Pages:
 *   1. Cover           — project name, model name, date, author, capture count
 *   2. (optional) TOC  — when captures > 5, lists every capture title + page
 *   3. Per capture     — one A4 portrait page per image, properly fitted
 *                        with margins, caption underneath, page footer with
 *                        page number / total + part name.
 *
 * Image src strategy: we accept dataURL strings (sync, no fetch) — the
 * caller is expected to convert blobs to dataURLs before mounting this
 * document. @react-pdf/renderer's <Image> is happy with both src='data:…'
 * and src='blob:…' but blob URLs sometimes race the render in headless
 * builds, so dataURLs are safer.
 */

import {
  Document,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'

export interface PdfCaptureInput {
  /** dataURL — img-src safe; see file header. */
  dataUrl: string
  caption: string
  width: number
  height: number
  capturedAt: string
  index: number
}

export interface CapturePdfProps {
  documentTitle: string
  partName: string
  partVersion?: string
  author?: string
  generatedAt: string
  captures: PdfCaptureInput[]
  includeTOC?: boolean
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 48,
    fontSize: 10,
    color: '#0f172a',
    fontFamily: 'Helvetica',
  },
  coverHero: {
    marginBottom: 32,
  },
  coverTag: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#15524a',
    marginBottom: 8,
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: -0.4,
    color: '#0f172a',
    lineHeight: 1.15,
  },
  coverSubtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 8,
  },
  coverMetaBlock: {
    marginTop: 28,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderLeftWidth: 3,
    borderLeftColor: '#15524a',
    borderRadius: 2,
  },
  coverMetaRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  coverMetaLabel: {
    width: 90,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.6,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  coverMetaValue: {
    flex: 1,
    fontSize: 11,
    color: '#0f172a',
  },
  tocTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 16,
    color: '#0f172a',
  },
  tocRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  tocNum: {
    width: 28,
    fontSize: 10,
    fontFamily: 'Courier',
    color: '#94a3b8',
  },
  tocLabel: {
    flex: 1,
    fontSize: 11,
    color: '#0f172a',
  },
  tocPage: {
    width: 24,
    textAlign: 'right',
    fontSize: 10,
    color: '#64748b',
  },
  captureHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
  },
  captureHeaderTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0f172a',
  },
  captureHeaderMeta: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  captureImageBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    padding: 6,
  },
  captureImage: {
    maxWidth: '100%',
    maxHeight: 540,
    objectFit: 'contain',
  },
  captureCaption: {
    marginTop: 10,
    fontSize: 10,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 1.4,
    fontStyle: 'italic',
  },
  pageFooter: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#94a3b8',
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
  },
})

export default function CapturePdfDocument(props: CapturePdfProps): JSX.Element {
  const { documentTitle, partName, partVersion, author, generatedAt, captures, includeTOC } = props
  const showTOC = (includeTOC ?? captures.length > 5) && captures.length > 0
  const formattedDate = new Date(generatedAt).toLocaleString(undefined, {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  return (
    <Document title={documentTitle} author={author ?? 'DataVerse Collab'}>
      {/* ── Cover ──────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverHero}>
          <Text style={styles.coverTag}>DATAVERS.AI · CAPTURED VIEWS</Text>
          <Text style={styles.coverTitle}>{documentTitle}</Text>
          <Text style={styles.coverSubtitle}>
            A visual review-pack of {captures.length} captured view
            {captures.length === 1 ? '' : 's'} from the 3D model.
          </Text>
        </View>

        <View style={styles.coverMetaBlock}>
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>Model</Text>
            <Text style={styles.coverMetaValue}>{partName}</Text>
          </View>
          {partVersion !== undefined && partVersion !== '' && (
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>Version</Text>
              <Text style={styles.coverMetaValue}>{partVersion}</Text>
            </View>
          )}
          {author !== undefined && author !== '' && (
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>Author</Text>
              <Text style={styles.coverMetaValue}>{author}</Text>
            </View>
          )}
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>Generated</Text>
            <Text style={styles.coverMetaValue}>{formattedDate}</Text>
          </View>
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>Captures</Text>
            <Text style={styles.coverMetaValue}>
              {captures.length} · captured between{' '}
              {captures.length > 0
                ? new Date(captures[0]!.capturedAt).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}{' '}
              and{' '}
              {captures.length > 0
                ? new Date(captures[captures.length - 1]!.capturedAt).toLocaleTimeString(
                    undefined,
                    { hour: '2-digit', minute: '2-digit' },
                  )
                : '—'}
            </Text>
          </View>
        </View>
      </Page>

      {/* ── TOC (optional) ─────────────────────────────────────────────── */}
      {showTOC && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.tocTitle}>Table of contents</Text>
          {captures.map((c, i) => (
            <View key={`toc-${i}`} style={styles.tocRow}>
              <Text style={styles.tocNum}>#{String(i + 1).padStart(2, '0')}</Text>
              <Text style={styles.tocLabel}>
                {c.caption !== '' ? c.caption : `View ${i + 1}`}
              </Text>
              <Text style={styles.tocPage}>{showTOC ? i + 3 : i + 2}</Text>
            </View>
          ))}
          <View style={styles.pageFooter}>
            <Text>{partName}</Text>
            <Text>Page 2</Text>
          </View>
        </Page>
      )}

      {/* ── One page per capture ──────────────────────────────────────── */}
      {captures.map((c, i) => {
        const pageNum = (showTOC ? 3 : 2) + i
        const totalPages = (showTOC ? 2 : 1) + captures.length
        return (
          <Page key={`cap-${i}`} size="A4" style={styles.page}>
            <View style={styles.captureHeader}>
              <Text style={styles.captureHeaderTitle}>
                #{String(i + 1).padStart(2, '0')} ·{' '}
                {c.caption !== '' ? c.caption : `View ${i + 1}`}
              </Text>
              <Text style={styles.captureHeaderMeta}>
                Captured at{' '}
                {new Date(c.capturedAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}{' '}
                · {c.width} × {c.height} px
              </Text>
            </View>
            <View style={styles.captureImageBox}>
              <PdfImage src={c.dataUrl} style={styles.captureImage} />
            </View>
            {c.caption !== '' && <Text style={styles.captureCaption}>{c.caption}</Text>}
            <View style={styles.pageFooter}>
              <Text>{partName}</Text>
              <Text>
                Page {pageNum} of {totalPages}
              </Text>
            </View>
          </Page>
        )
      })}
    </Document>
  )
}
