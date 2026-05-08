import { Suspense } from 'react'
import SubscribeClientImpl from './subscribe-client-impl'

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <SubscribeClientImpl />
    </Suspense>
  )
}