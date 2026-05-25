'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  PACKAGE_PLACEMENT_QUIZ_ITEMS,
  type PackagePlacementAnswers,
} from '@/lib/package-placement'
import { cn } from '@/lib/utils'

type AnswerKey = keyof PackagePlacementAnswers

type QuizState = Record<AnswerKey, boolean | null>

function allAnswered(state: QuizState): state is PackagePlacementAnswers {
  return (
    state.hostInvolved !== null &&
    state.runSpecial !== null &&
    state.exclusive !== null &&
    state.onceOff !== null
  )
}

export function PackagePlacementQuiz({
  propertyTitle,
  onComplete,
  disabled,
  className,
}: {
  propertyTitle?: string
  onComplete: (answers: PackagePlacementAnswers) => void
  disabled?: boolean
  className?: string
}) {
  const [answers, setAnswers] = useState<QuizState>({
    hostInvolved: null,
    runSpecial: null,
    exclusive: null,
    onceOff: null,
  })

  const setAnswer = (key: AnswerKey, value: boolean) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-teal-200 bg-teal-50/50 dark:bg-teal-950/20 dark:border-teal-900/50 p-4 text-sm space-y-4',
        className,
      )}
    >
      <div>
        <p className="font-medium text-teal-950 dark:text-teal-100">
          A few quick questions
        </p>
        {propertyTitle ? (
          <p className="text-xs text-slate-600 dark:text-muted-foreground mt-0.5">
            For <span className="font-medium">{propertyTitle}</span> — tap Yes or No for each.
          </p>
        ) : (
          <p className="text-xs text-slate-600 dark:text-muted-foreground mt-0.5">
            Tap Yes or No for each so we can suggest the right packages.
          </p>
        )}
      </div>

      <ul className="space-y-4">
        {PACKAGE_PLACEMENT_QUIZ_ITEMS.map((item) => {
          const value = answers[item.id]
          return (
            <li key={item.id} className="rounded-md border border-white/80 bg-white dark:bg-card dark:border-border p-3 shadow-sm">
              <p className="font-medium text-slate-900 dark:text-foreground text-sm leading-snug">
                {item.question}
              </p>
              <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">{item.help}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant={value === true ? 'default' : 'outline'}
                  disabled={disabled}
                  className={cn(
                    'rounded-full min-w-[4.5rem]',
                    value === true && 'bg-teal-700 hover:bg-teal-800 text-white',
                  )}
                  onClick={() => setAnswer(item.id, true)}
                >
                  {item.yesLabel}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={value === false ? 'default' : 'outline'}
                  disabled={disabled}
                  className={cn(
                    'rounded-full min-w-[4.5rem]',
                    value === false && 'bg-slate-700 hover:bg-slate-800 text-white',
                  )}
                  onClick={() => setAnswer(item.id, false)}
                >
                  {item.noLabel}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      <Button
        type="button"
        className="w-full rounded-full bg-[#0f172a] hover:bg-[#1e293b] text-white"
        disabled={disabled || !allAnswered(answers)}
        onClick={() => {
          if (!allAnswered(answers)) return
          onComplete(answers)
        }}
      >
        Suggest packages
      </Button>
    </div>
  )
}
