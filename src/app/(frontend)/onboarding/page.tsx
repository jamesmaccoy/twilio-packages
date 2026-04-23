import type { Metadata } from 'next/types'
import React from 'react'

export const revalidate = 600

export default async function OnboardingPage() {
    return (
        <>
            <div className="pt-24 pb-24">
              <div className="container">
                <h1 className="font-serif-display text-4xl md:text-5xl text-[#0a0a0a] mb-4">
                  House Manual
                </h1>
                <p className="font-serif-text text-lg text-[#666] max-w-2xl">
                  Your guide to getting the most out of your stay.
                </p>
              </div>
            </div>
        </>
    )
}

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: 'House Manual | Simple Plek',
        description: 'Your guide to getting the most out of your stay.',
    }
}
