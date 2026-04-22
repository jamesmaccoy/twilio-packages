'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { cn } from '@/utilities/cn'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DateRangePickerProps {
  startDate?: Date
  endDate?: Date
  onSelect?: (range: { from: Date | undefined; to: Date | undefined }) => void
  disabled?: (date: Date) => boolean
  className?: string
  label?: string
  placeholder?: string
}

export function DateRangePicker({
  startDate,
  endDate,
  onSelect,
  disabled,
  className,
  label,
  placeholder = 'Pick a date range',
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => {
    if (startDate || endDate) {
      return {
        from: startDate,
        to: endDate,
      }
    }
    return undefined
  })

  // Update dateRange when props change
  React.useEffect(() => {
    if (startDate || endDate) {
      setDateRange({
        from: startDate,
        to: endDate,
      })
    } else {
      setDateRange(undefined)
    }
  }, [startDate, endDate])

  const handleSelect = (range: DateRange | undefined) => {
    setDateRange(range)
    
    if (onSelect) {
      onSelect({
        from: range?.from,
        to: range?.to,
      })
    }

    // Close popover when both dates are selected
    if (range?.from && range?.to) {
      setOpen(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <label className="text-xs text-muted-foreground font-medium px-1">{label}</label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            data-empty={!dateRange?.from || !dateRange?.to}
            className={cn(
              'w-full justify-start text-left font-normal h-9 text-xs',
              (!dateRange?.from || !dateRange?.to) && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="mr-2 h-3 w-3" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}
                </>
              ) : (
                format(dateRange.from, 'LLL dd, y')
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={handleSelect}
            numberOfMonths={2}
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

