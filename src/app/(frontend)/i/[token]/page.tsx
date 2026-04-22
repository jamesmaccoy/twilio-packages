import { redirect } from 'next/navigation'

type Params = Promise<{
  token: string
}>

export default async function ShortInvite({ params }: { params: Params }) {
  const { token } = await params
  
  // Redirect to the full invite page with the token as a query parameter
  redirect(`/guest/invite?token=${token}`)
}

