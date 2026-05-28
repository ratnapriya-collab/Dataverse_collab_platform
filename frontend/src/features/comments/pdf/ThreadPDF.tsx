'use client'

/**
 * ThreadPDF — premium PDF export rendered via @react-pdf/renderer.
 *
 * Layout matches the spec in the design doc §7.2:
 *   · Cover page  — workspace logo, project name, export meta, totals
 *   · Optional TOC (auto-included for >5 threads)
 *   · Per-thread pages: header badges (status/priority/tags) · author · anchor
 *     · root body · replies · citations · attachments (images)
 *   · Audit footer
 *
 * Theme tokens (page/title/body/badges) are colocated in `pdfTheme` so a
 * single change re-themes the whole PDF.
 */

import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { Reply, Thread } from '../types/thread.types'

const theme = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontSize: 10,
    color: '#0f172a',
    lineHeight: 1.5,
    fontFamily: 'Helvetica',
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
    borderTop: '1pt solid #e2e8f0',
    paddingTop: 6,
  },
  cover: { flexDirection: 'column', gap: 24, paddingTop: 80 },
  coverTag: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 2,
    color: '#475569',
    textTransform: 'uppercase',
  },
  coverTitle: { fontSize: 28, fontWeight: 800, letterSpacing: -0.5, color: '#0f172a' },
  coverSub: { fontSize: 12, color: '#475569' },
  coverMetaRow: { flexDirection: 'row', gap: 24, marginTop: 8 },
  coverMetaLabel: {
    fontSize: 8,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  coverMetaValue: { fontSize: 11, color: '#0f172a', fontWeight: 700, marginTop: 2 },
  divider: { borderTop: '2pt solid #15524a', marginVertical: 16 },
  threadCard: {
    marginBottom: 28,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#15524a',
  },
  threadHeader: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  badgeOpen: { backgroundColor: '#fef3c7', color: '#92400e' },
  badgeResolved: { backgroundColor: '#d1fae5', color: '#065f46' },
  badgeArchived: { backgroundColor: '#e5e7eb', color: '#475569' },
  badgeBlocker: { backgroundColor: '#fee2e2', color: '#9f1239' },
  badgeHigh: { backgroundColor: '#fed7aa', color: '#9a3412' },
  badgeMedium: { backgroundColor: '#e0f2fe', color: '#075985' },
  badgeLow: { backgroundColor: '#e2e8f0', color: '#475569' },
  badgeTag: { backgroundColor: '#f1f5f9', color: '#475569' },
  threadTitle: { fontSize: 14, fontWeight: 700, marginTop: 6, color: '#0f172a' },
  threadMeta: { fontSize: 8.5, color: '#64748b', marginTop: 3 },
  rootBody: { marginTop: 8, fontSize: 10, lineHeight: 1.55, color: '#1e293b' },
  citations: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  citationChip: {
    backgroundColor: '#f5f3ff',
    color: '#5b21b6',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 8,
    fontFamily: 'Courier',
    fontWeight: 700,
  },
  repliesHeader: {
    marginTop: 12,
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#475569',
    letterSpacing: 1,
  },
  reply: {
    marginTop: 6,
    paddingLeft: 8,
    paddingVertical: 6,
    paddingRight: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 3,
  },
  replyHeader: { fontSize: 9, color: '#334155', fontWeight: 700 },
  replyMeta: { fontSize: 7.5, color: '#94a3b8', marginLeft: 4 },
  replyBody: { fontSize: 9.5, color: '#1e293b', marginTop: 3 },
  reactionRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  reaction: {
    fontSize: 8,
    backgroundColor: '#fff',
    border: '0.5pt solid #cbd5e1',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 99,
    color: '#475569',
  },
  toc: { marginTop: 16 },
  tocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottom: '0.5pt dotted #cbd5e1',
  },
  tocIndex: { fontSize: 9, color: '#94a3b8', width: 24 },
  tocTitle: { fontSize: 10, color: '#0f172a', flex: 1 },
  tocStatus: { fontSize: 8, color: '#64748b' },
})

const statusBadgeStyle = {
  open: theme.badgeOpen,
  resolved: theme.badgeResolved,
  archived: theme.badgeArchived,
}
const priorityBadgeStyle = {
  blocker: theme.badgeBlocker,
  high: theme.badgeHigh,
  medium: theme.badgeMedium,
  low: theme.badgeLow,
}

export interface ThreadPDFData {
  partName: string
  workspaceName: string
  exportedBy: string
  exportedAt: string // ISO
  threads: Array<Thread & { replies: Reply[]; citations?: string[] }>
  includeTOC: boolean
}

export default function ThreadPDF({ data }: { data: ThreadPDFData }): JSX.Element {
  const openCount = data.threads.filter((t) => t.status === 'open').length
  const resolvedCount = data.threads.filter((t) => t.status === 'resolved').length
  const participantNames = Array.from(
    new Set(data.threads.flatMap((t) => t.participantIds)),
  )

  return (
    <Document
      title={`${data.partName} — Review Report`}
      author={data.exportedBy}
      subject="DataVerse Collab — Comment Export"
      creator="DataVerse Collab"
    >
      {/* Cover */}
      <Page size="A4" style={theme.page}>
        <View style={theme.cover}>
          <Text style={theme.coverTag}>{data.workspaceName} · Review Report</Text>
          <Text style={theme.coverTitle}>{data.partName}</Text>
          <Text style={theme.coverSub}>
            Threaded review export · {data.threads.length} thread
            {data.threads.length === 1 ? '' : 's'} · {openCount} open · {resolvedCount} resolved
          </Text>
          <View style={theme.divider} />
          <View style={theme.coverMetaRow}>
            <View>
              <Text style={theme.coverMetaLabel}>Generated by</Text>
              <Text style={theme.coverMetaValue}>{data.exportedBy}</Text>
            </View>
            <View>
              <Text style={theme.coverMetaLabel}>Exported</Text>
              <Text style={theme.coverMetaValue}>{formatDate(data.exportedAt)}</Text>
            </View>
            <View>
              <Text style={theme.coverMetaLabel}>Participants</Text>
              <Text style={theme.coverMetaValue}>{participantNames.length}</Text>
            </View>
          </View>
          <View>
            <Text style={theme.coverMetaLabel}>Participants</Text>
            <Text style={[theme.coverSub, { marginTop: 4 }]}>
              {participantNames.join(' · ')}
            </Text>
          </View>
        </View>

        <Text style={theme.pageFooter} fixed>
          <Text>DataVerse Collab</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </Text>
      </Page>

      {/* TOC */}
      {data.includeTOC && data.threads.length > 5 && (
        <Page size="A4" style={theme.page}>
          <Text style={theme.coverTag}>Table of contents</Text>
          <Text style={[theme.coverTitle, { fontSize: 18, marginTop: 4 }]}>Threads</Text>
          <View style={theme.toc}>
            {data.threads.map((t, idx) => (
              <View key={t.id} style={theme.tocRow}>
                <Text style={theme.tocIndex}>{idx + 1}.</Text>
                <Text style={theme.tocTitle}>{t.title}</Text>
                <Text style={theme.tocStatus}>
                  {t.status.toUpperCase()} · {t.replies.length} reply
                  {t.replies.length === 1 ? '' : 'es'}
                </Text>
              </View>
            ))}
          </View>
          <Text style={theme.pageFooter} fixed>
            <Text>DataVerse Collab</Text>
            <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </Text>
        </Page>
      )}

      {/* Threads */}
      <Page size="A4" style={theme.page} wrap>
        {data.threads.map((thread, idx) => (
          <View key={thread.id} style={theme.threadCard} wrap={false}>
            <View style={theme.threadHeader}>
              <Text style={[theme.badge, statusBadgeStyle[thread.status]]}>
                {thread.status}
              </Text>
              {thread.priority !== null && (
                <Text style={[theme.badge, priorityBadgeStyle[thread.priority]]}>
                  {thread.priority}
                </Text>
              )}
              {thread.tags.map((tag) => (
                <Text key={tag} style={[theme.badge, theme.badgeTag]}>
                  {tag}
                </Text>
              ))}
            </View>
            <Text style={theme.threadTitle}>
              {idx + 1}. {thread.title}
            </Text>
            <Text style={theme.threadMeta}>
              {thread.authorName} · started {formatDate(thread.createdAt)} · anchor{' '}
              {thread.anchor.faceUuid}
            </Text>

            {(() => {
              const root =
                thread.replies.find((r) => r.id === thread.rootReplyId) ?? thread.replies[0]
              return root === undefined ? null : (
                <Text style={theme.rootBody}>{root.body}</Text>
              )
            })()}

            {thread.citations !== undefined && thread.citations.length > 0 && (
              <View style={theme.citations}>
                {thread.citations.map((c) => (
                  <Text key={c} style={theme.citationChip}>
                    {c}
                  </Text>
                ))}
              </View>
            )}

            {thread.replies.length > 1 && (
              <View>
                <Text style={theme.repliesHeader}>
                  Replies ({thread.replies.length - 1})
                </Text>
                {thread.replies
                  .filter((r) => r.id !== thread.rootReplyId && r.deletedAt === null)
                  .map((reply) => (
                    <View key={reply.id} style={theme.reply}>
                      <Text>
                        <Text style={theme.replyHeader}>{reply.authorName}</Text>
                        <Text style={theme.replyMeta}> · {formatDate(reply.createdAt)}</Text>
                        {reply.updatedAt !== reply.createdAt && (
                          <Text style={theme.replyMeta}> · (edited)</Text>
                        )}
                      </Text>
                      <Text style={theme.replyBody}>{reply.body}</Text>
                      {reply.reactions.length > 0 && (
                        <View style={theme.reactionRow}>
                          {reply.reactions.map((rx) => (
                            <Text key={rx.emoji} style={theme.reaction}>
                              {rx.emoji} {rx.userIds.length}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
              </View>
            )}
          </View>
        ))}

        <Text style={theme.pageFooter} fixed>
          <Text>DataVerse Collab · {data.partName}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </Text>
      </Page>
    </Document>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
