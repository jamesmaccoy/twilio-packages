'use client'

import React from 'react'

interface AddonToggleProps {
  label: string
  price: number
  isOn: boolean
  onToggle: () => void
  disabled?: boolean
}

export function AddonToggle({
  label,
  price,
  isOn,
  onToggle,
  disabled = false,
}: AddonToggleProps) {
  const formatPrice = (price: number) => {
    return `R${price.toLocaleString('en-ZA')}`
  }

  return (
    <div
      className={`flex items-center justify-between py-2 ${disabled ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">+{formatPrice(price)}</span>
      </div>

      <button
        onClick={onToggle}
        disabled={disabled}
        role="switch"
        aria-checked={isOn}
        className={`
          relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
          transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 
          focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
          disabled:cursor-not-allowed
          ${isOn ? 'bg-primary' : 'bg-input'}
        `}
      >
        <span className="sr-only">Toggle {label}</span>
        <span
          className={`
            pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 
            transition-transform duration-200 ease-in-out
            ${isOn ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  )
}

