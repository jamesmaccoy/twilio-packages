import { Suspense } from 'react'
import LoginPage from './page.client'

// You can now add Next.js metadata here for SEO
export const metadata = {
  title: 'Login | SimplePlek',
  description: 'Login to your account to access bookings and more.',
}

export default function Page() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  )
}
