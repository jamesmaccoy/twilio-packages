'use client'

import React from 'react'
import { cn } from '@/lib/utils'

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

function isBulletLine(line: string): boolean {
  return /^[-*•]\s+/.test(line.trim())
}

function stripBullet(line: string): string {
  return line.trim().replace(/^[-*•]\s+/, '')
}

function isTransactionLine(text: string): boolean {
  return (
    /\b(ZAR|R)\s*[\d,.]+/i.test(text) ||
    /\b(completed|pending|cancelled|failed)\b/i.test(text) ||
    /·|—/.test(text)
  )
}

type Block =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[]; transactionStyle?: boolean }
  | { type: 'p'; lines: string[] }

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = []
  const lines = content.split('\n')
  let paragraphLines: string[] = []
  let listItems: string[] = []

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({ type: 'p', lines: [...paragraphLines] })
      paragraphLines = []
    }
  }

  const flushList = () => {
    if (listItems.length > 0) {
      const transactionStyle = listItems.every(isTransactionLine)
      blocks.push({ type: 'ul', items: [...listItems], transactionStyle })
      listItems = []
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      flushParagraph()
      continue
    }

    const h2 = trimmed.match(/^##\s+(.+)$/)
    if (h2) {
      flushList()
      flushParagraph()
      blocks.push({ type: 'h2', text: h2[1].trim() })
      continue
    }

    const h3 = trimmed.match(/^###\s+(.+)$/)
    if (h3) {
      flushList()
      flushParagraph()
      blocks.push({ type: 'h3', text: h3[1].trim() })
      continue
    }

    if (isBulletLine(trimmed)) {
      flushParagraph()
      listItems.push(stripBullet(trimmed))
      continue
    }

    flushList()
    paragraphLines.push(trimmed)
  }

  flushList()
  flushParagraph()
  return blocks
}

export interface FormattedAssistantContentProps {
  content: string
  className?: string
}

export function FormattedAssistantContent({ content, className }: FormattedAssistantContentProps) {
  const blocks = parseBlocks(content.trim())

  if (blocks.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-4 text-sm leading-relaxed', className)}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'h2':
            return (
              <h3
                key={i}
                className="text-base font-semibold text-foreground pt-1 first:pt-0 border-b border-primary/20 pb-2"
              >
                {block.text}
              </h3>
            )
          case 'h3':
            return (
              <h4 key={i} className="text-sm font-semibold text-foreground tracking-tight">
                {block.text}
              </h4>
            )
          case 'ul':
            return (
              <ul
                key={i}
                className={cn(
                  'space-y-2',
                  block.transactionStyle ? 'list-none pl-0' : 'list-disc pl-5 marker:text-primary',
                )}
              >
                {block.items.map((item, j) => (
                  <li
                    key={j}
                    className={cn(
                      block.transactionStyle
                        ? 'list-none rounded-lg border border-primary/15 bg-muted/50 px-3 py-2.5 shadow-sm'
                        : 'text-foreground/90 pl-0.5',
                    )}
                  >
                    <span className={block.transactionStyle ? 'text-foreground' : 'text-foreground/90'}>
                      {renderInline(item)}
                    </span>
                  </li>
                ))}
              </ul>
            )
          case 'p':
            return (
              <p key={i} className="text-foreground/90 leading-relaxed">
                {block.lines.map((line, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <br />}
                    {renderInline(line)}
                  </React.Fragment>
                ))}
              </p>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
