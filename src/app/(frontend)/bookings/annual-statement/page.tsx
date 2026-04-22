import AnnualStatementClient from "./page.client"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AnnualStatementPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const resolvedSearchParams = await searchParams

  const postIdParam = resolvedSearchParams.postId
  const yearParam = resolvedSearchParams.year

  const postId = typeof postIdParam === "string" ? postIdParam : null
  const parsedYear = typeof yearParam === "string" ? Number.parseInt(yearParam, 10) : undefined

  return <AnnualStatementClient postId={postId} year={Number.isFinite(parsedYear) ? parsedYear : undefined} />
}

