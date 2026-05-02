/**
 * Shared dial prefixes for phone inputs. Options use flag emoji + dial code
 * so the native <select> stays compact; full label is for accessibility only.
 */
export type DialCountryOption = {
  dial: string
  flag: string
  label: string
}

export const DIAL_COUNTRY_OPTIONS: readonly DialCountryOption[] = [
  { dial: '+27', flag: '🇿🇦', label: 'South Africa' },
  { dial: '+1', flag: '🇺🇸', label: 'United States / Canada' },
  { dial: '+44', flag: '🇬🇧', label: 'United Kingdom' },
  { dial: '+49', flag: '🇩🇪', label: 'Germany' },
  { dial: '+33', flag: '🇫🇷', label: 'France' },
  { dial: '+34', flag: '🇪🇸', label: 'Spain' },
  { dial: '+39', flag: '🇮🇹', label: 'Italy' },
  { dial: '+31', flag: '🇳🇱', label: 'Netherlands' },
  { dial: '+61', flag: '🇦🇺', label: 'Australia' },
  { dial: '+353', flag: '🇮🇪', label: 'Ireland' },
] as const

/** Narrow select: flag + dial; longest label is "+353". */
export const dialCountrySelectClassName =
  'h-10 w-[5.75rem] shrink-0 cursor-pointer rounded-md border border-zinc-200 bg-white px-1.5 text-center text-sm text-zinc-900 tabular-nums [color-scheme:light] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:border-border dark:bg-card dark:text-foreground dark:[color-scheme:dark] dark:focus-visible:ring-zinc-300'

/** Sits beside a compact country select; grows so it is never narrower than the dial control. */
export const phoneNumberFieldGrowClassName = 'min-w-[9rem] flex-1 basis-0 w-auto tabular-nums'
