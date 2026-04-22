import EstimateClient from './page.client'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function EstimatePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const resolvedSearchParams = await searchParams

  const bookingTotal = typeof resolvedSearchParams.total === 'string'
    ? resolvedSearchParams.total
    : 'N/A'

  const bookingDuration = typeof resolvedSearchParams.duration === 'string'
    ? resolvedSearchParams.duration
    : 'N/A'

  return (
    <EstimateClient
      bookingTotal={bookingTotal}
      bookingDuration={bookingDuration}
    />
  )
}

