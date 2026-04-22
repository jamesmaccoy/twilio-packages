'use client'

import React, { HTMLAttributes, useEffect, useState } from 'react'
import type {} from '@payloadcms/plugin-form-builder/types'
import { cn } from '@/utilities/cn'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { DateRange } from 'react-day-picker'
import { addDays, differenceInDays, format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { FieldErrorsImpl, FieldValues, useFormContext, UseFormRegister } from 'react-hook-form'
import { Error } from '../Error'

type DatePickerProps = HTMLAttributes<HTMLDivElement> & {
  required?: boolean
  maxDays?: number
  name: string
  label?: string
  width?: number
  errors: Partial<
    FieldErrorsImpl<{
      [x: string]: any
    }>
  >
  register: UseFormRegister<FieldValues>
}

export const DatePicker: React.FC<DatePickerProps> = ({
  required: requiredFromProps,
  name,
  label,
  width,
  className,
  maxDays,
  errors,
  register,
}) => {
  const { setValue, setError } = useFormContext()

  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 5),
  })

  useEffect(() => {
    register(name, {
      required: requiredFromProps,
      validate: () => {
        if (!date?.from || !date?.to) return true

        if (maxDays) {
          const daysDifference = differenceInDays(date.to, date.from)
          return daysDifference <= maxDays || `Date range must be ${maxDays} days or less`
        }
      },
    })
  }, [register, name, requiredFromProps, date, maxDays])

  useEffect(() => {
    if (date?.from && date?.to) {
      setValue(name, `${format(date.from, 'LLL dd, y')} - ${format(date.to, 'LLL dd, y')}`)
    }
  }, [date, name, setValue])

  const handleSelect = (range: DateRange | undefined) => {
    setDate(range)
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor="date" className="font-medium text-sm">
        {label} {requiredFromProps && <span className="text-red-500">*</span>}
      </label>
      <Popover>
        <PopoverTrigger asChild>
          <Button id="date" type="button" variant="outline" style={{ width: `${width}%` }}>
            <CalendarIcon className="size-4 mr-2" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'LLL dd, y')} - {format(date.to, 'LLL dd, y')}
                </>
              ) : (
                format(date.from, 'LLL dd, y')
              )
            ) : (
              <span>{label}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
      {requiredFromProps && errors[name] && <Error message={String(errors[name].message)} />}
    </div>
  )
}
