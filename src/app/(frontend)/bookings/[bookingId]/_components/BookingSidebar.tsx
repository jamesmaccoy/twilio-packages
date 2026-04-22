'use client'

import { useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Clock } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

interface BookingSidebarProps {
  history?: {
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    threadId: number
  }[]
  onClearHistory?: () => void
  activity?: any[]
}

export function BookingSidebar({ history = [], onClearHistory, activity = [] }: BookingSidebarProps) {
  const trimmedHistory = useMemo(() => history.slice(-8), [history])
  const trimmedActivity = useMemo(() => {
    if (!activity || !Array.isArray(activity)) return []
    return activity.slice(-8)
  }, [activity])

  const sanitizeContent = useCallback((content: string) => {
    if (!content) return ''
    return content.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim()
  }, [])

  // Combine and sort all activity (AI history + estimate activity)
  const allActivity = useMemo(() => {
    const aiEntries = trimmedHistory.map((entry) => ({
      type: 'ai',
      role: entry.role,
      content: entry.content,
      timestamp: entry.timestamp,
      userName: entry.role === 'user' ? 'You' : 'Assistant',
    }))

    const estimateEntries = trimmedActivity.map((entry: any) => ({
      type: 'estimate',
      entryType: entry.type,
      content: entry.content,
      timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now(),
      userName: entry.userName || (typeof entry.user === 'object' ? entry.user?.name : 'User'),
    }))

    return [...aiEntries, ...estimateEntries]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 8)
  }, [trimmedHistory, trimmedActivity])

  return (
    <aside className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <p className="text-xs text-muted-foreground">AI conversations and estimate comments</p>
          </div>
          {trimmedHistory.length > 0 && onClearHistory ? (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearHistory}>
              Clear AI
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="text-xs">
          {allActivity.length > 0 ? (
            <ScrollArea className="max-h-48 pr-2">
              <div className="space-y-3">
                {allActivity.map((entry, index) => {
                  const entryDate = new Date(entry.timestamp)
                  const timeAgo = formatDistanceToNow(entryDate, { addSuffix: true })
                  
                  return (
                    <div key={`${entry.timestamp}-${index}`} className="space-y-1 rounded-md border border-dashed p-2">
                      <div className="flex items-center justify-between text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                        <span>
                          {entry.userName}
                          {entry.type === 'ai' && ` (${entry.role === 'user' ? 'You' : 'Assistant'})`}
                          {entry.type === 'estimate' && entry.entryType === 'comment' && ' commented'}
                          {entry.type === 'estimate' && entry.entryType === 'viewed' && ' viewed'}
                          {entry.type === 'estimate' && entry.entryType === 'declined' && ' declined'}
                          {entry.type === 'estimate' && entry.entryType === 'approved' && ' approved'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo}
                        </span>
                      </div>
                      {entry.content && (
                        <p className="whitespace-pre-wrap leading-snug text-foreground">
                          {entry.type === 'ai' ? sanitizeContent(entry.content) : entry.content || '…'}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
              {trimmedActivity.length > 0
                ? 'Start a conversation with the assistant to see your history here.'
                : 'No activity yet. Comments and conversations will appear here.'}
            </div>
          )}
        </CardContent>
      </Card>
    </aside>
  )
}

export default BookingSidebar

