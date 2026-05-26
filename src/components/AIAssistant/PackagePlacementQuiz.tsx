'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  PACKAGE_PLACEMENT_QUIZ_ITEMS,
  type PackagePlacementAnswers,
} from '@/lib/package-placement'
import { cn } from '@/lib/utils'
import { ChevronLeft } from 'lucide-react'

type AnswerKey = keyof PackagePlacementAnswers

type QuizState = Record<AnswerKey, boolean | null>

const STEP_COUNT = PACKAGE_PLACEMENT_QUIZ_ITEMS.length

function isComplete(state: QuizState): state is PackagePlacementAnswers {
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
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<QuizState>({
    hostInvolved: null,
    runSpecial: null,
    exclusive: null,
    onceOff: null,
  })

  const item = PACKAGE_PLACEMENT_QUIZ_ITEMS[step]
  const isLastStep = step === STEP_COUNT - 1

  const choose = (value: boolean) => {
    if (disabled) return
    const nextAnswers: QuizState = { ...answers, [item.id]: value }
    setAnswers(nextAnswers)

    if (isLastStep && isComplete(nextAnswers)) {
      onComplete(nextAnswers)
      return
    }
    if (!isLastStep) {
      setStep((s) => Math.min(s + 1, STEP_COUNT - 1))
    }
  }

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1)
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-teal-200 bg-teal-50/50 dark:bg-teal-950/20 dark:border-teal-900/50 p-4 text-sm space-y-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-teal-950 dark:text-teal-100">
            Quick question {step + 1} of {STEP_COUNT}
          </p>
          {propertyTitle ? (
            <p className="text-xs text-slate-600 dark:text-muted-foreground mt-0.5">
              For <span className="font-medium">{propertyTitle}</span>
            </p>
          ) : (
            <p className="text-xs text-slate-600 dark:text-muted-foreground mt-0.5">
              Tap Yes or No to continue.
            </p>
          )}
        </div>
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="shrink-0 h-8 px-2 text-slate-600"
            onClick={goBack}
          >
            <ChevronLeft className="h-4 w-4 mr-0.5" />
            Back
          </Button>
        ) : null}
      </div>

      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={STEP_COUNT}
        aria-label={`Question ${step + 1} of ${STEP_COUNT}`}
      >
        {PACKAGE_PLACEMENT_QUIZ_ITEMS.map((q, i) => (
          <div
            key={q.id}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i <= step ? 'bg-teal-600' : 'bg-teal-200/80 dark:bg-teal-900/60',
            )}
          />
        ))}
      </div>

      <div className="rounded-md border border-white/80 bg-white dark:bg-card dark:border-border p-4 shadow-sm">
        <p className="font-medium text-slate-900 dark:text-foreground text-base leading-snug">
          {item.question}
        </p>
        <p className="text-xs text-slate-500 dark:text-muted-foreground mt-2">{item.help}</p>
        <div className="flex flex-col gap-2 mt-4 w-full">
          <Button
            type="button"
            size="default"
            variant="outline"
            disabled={disabled}
            className="w-full h-auto min-h-11 py-2.5 px-4 rounded-lg whitespace-normal text-center leading-snug border-teal-200 hover:bg-teal-50 dark:hover:bg-teal-950/30"
            onClick={() => choose(true)}
          >
            {item.yesLabel}
          </Button>
          <Button
            type="button"
            size="default"
            variant="outline"
            disabled={disabled}
            className="w-full h-auto min-h-11 py-2.5 px-4 rounded-lg whitespace-normal text-center leading-snug"
            onClick={() => choose(false)}
          >
            {item.noLabel}
          </Button>
        </div>
      </div>

      {isLastStep ? (
        <p className="text-xs text-center text-slate-500 dark:text-muted-foreground">
          Your next tap will suggest packages for this listing.
        </p>
      ) : null}
    </div>
  )
}
