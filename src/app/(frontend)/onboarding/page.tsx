import type { Metadata } from 'next/types'
import React from 'react'
import { ScriptVideoBackground } from '@/components/ScriptVideoBackground'

export const revalidate = 600

export default async function OnboardingPage() {
    return (
        <>
            <ScriptVideoBackground />
        </>
    )
}

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: 'House Manual | Simple Plek',
        description: 'Your guide to getting the most out of your stay.',
    }
}
