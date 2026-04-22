"use client"

import { useEffect, useMemo, useState } from "react"
import type { User } from "@/payload-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { formatAmountToZAR } from "@/lib/currency"
import { Loader2, AlertCircle, UserIcon, CopyIcon, FileText as FileTextIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useUserContext } from "@/context/UserContext"

type YocoTransactionRecord = {
  id: string
  status: "pending" | "completed" | "failed" | "cancelled"
  amount?: number
  currency?: string
  plan?: string
  entitlement?: string
  createdAt?: string
  completedAt?: string
  packageName?: string
  intent?: "booking" | "subscription" | "product"
  linkedBookings?: Array<{
    id: string
    title: string
    fromDate: string
    toDate: string
    post: {
      id: string
      title: string
      slug: string
    } | null
  }>
}

type PostSummary = {
  id: string
  title: string
  authors: string[]
  createdAt?: string
  updatedAt?: string
  authorRoles?: string[]
}

type MonthlySummary = {
  key: string
  label: string
  completedAmount: number
  pendingAmount: number
  failedAmount: number
  completedCount: number
  totalCount: number
}

type StatementPackage = {
  id: string
  name: string
  originalName?: string | null
  description?: string | null
  revenueCatId?: string | null
  yocoId?: string | null
}

type PackageIdentity = {
  key: string
  displayName: string
  pkg?: StatementPackage | null
}

interface AnnualStatementClientProps {
  postId: string | null
  year?: number
}

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
})

const formatDate = (value?: string) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

const buildAuthors = (rawAuthors: unknown): string[] => {
  if (!Array.isArray(rawAuthors)) return []

  return rawAuthors
    .map((author) => {
      if (!author) return null
      if (typeof author === "string") return author
      if (typeof author === "object" && "name" in author && typeof author.name === "string") {
        return author.name
      }
      if (typeof author === "object" && "title" in author && typeof author.title === "string") {
        return author.title
      }
      if (typeof author === "object" && "email" in author && typeof author.email === "string") {
        return author.email
      }
      return null
    })
    .filter((value): value is string => Boolean(value && value.trim()))
}

export default function AnnualStatementClient({ postId, year }: AnnualStatementClientProps) {
  const [postDetails, setPostDetails] = useState<PostSummary | null>(null)
  const [postError, setPostError] = useState<string | null>(null)
  const [postLoading, setPostLoading] = useState(false)

  const [transactions, setTransactions] = useState<YocoTransactionRecord[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(true)
  const [transactionsError, setTransactionsError] = useState<string | null>(null)

  const [beneficiaries, setBeneficiaries] = useState<User[]>([])
  const [beneficiariesLoading, setBeneficiariesLoading] = useState(true)
  const [beneficiariesError, setBeneficiariesError] = useState<string | null>(null)

  const [packages, setPackages] = useState<StatementPackage[]>([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [packagesError, setPackagesError] = useState<string | null>(null)

  const { currentUser } = useUserContext()
  const [shareCopied, setShareCopied] = useState(false)

  const effectiveYear = Number.isFinite(year) ? year : undefined

  useEffect(() => {
    if (!postId) {
      setPostDetails(null)
      setPostError("Provide a property reference (postId) to link this statement to a trust deed.")
      setPostLoading(false)
      return
    }

    let active = true

    const fetchPostDetails = async () => {
      setPostLoading(true)
      setPostError(null)
      try {
        const response = await fetch(`/api/posts/${postId}`)
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Trust deed record not found for this property.")
          }
          if (response.status === 401) {
            throw new Error("Sign in to review trust deed documentation for this property.")
          }
          throw new Error("Failed to load trust deed context.")
        }

        const data = await response.json()
        const doc = data?.doc
        if (!doc) {
          throw new Error("Trust deed data missing from response.")
        }

        if (!active) return

        const authors = buildAuthors(doc.populatedAuthors ?? doc.authors)

        setPostDetails({
          id: doc.id ?? postId,
          title: doc.title ?? "Untitled property",
          authors,
          authorRoles: authors.map(() => "Trustee (Pro host)"),
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        })
      } catch (error) {
        if (!active) return
        setPostDetails(null)
        setPostError(error instanceof Error ? error.message : "Failed to load trust deed context.")
      } finally {
        if (active) {
          setPostLoading(false)
        }
      }
    }

    fetchPostDetails()

    return () => {
      active = false
    }
  }, [postId])

  useEffect(() => {
    if (!postId) {
      setPackages([])
      setPackagesError(null)
      return
    }

    let active = true

    const fetchPackages = async () => {
      setPackagesLoading(true)
      setPackagesError(null)

      try {
        const response = await fetch(`/api/packages/post/${postId}`)
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Sign in to view package catalogue for this trust deed.")
          }
          throw new Error("Failed to load package catalogue.")
        }

        const data = await response.json()
        const docs = Array.isArray(data?.packages) ? data.packages : []
        if (!active) return

        const parsed: StatementPackage[] = docs.map((pkg: any) => {
          const rawRevenueCatId = typeof pkg?.revenueCatId === "string" ? pkg.revenueCatId : null
          const normalisedRevenueCatId =
            rawRevenueCatId && rawRevenueCatId.toLowerCase().includes("three_nights") ? "3nights" : rawRevenueCatId
          const rawYocoId = typeof pkg?.yocoId === "string" ? pkg.yocoId : null
          const normalisedYocoId =
            rawYocoId && rawYocoId.toLowerCase().includes("three_nights") ? "3nights" : rawYocoId

          return {
            id: typeof pkg?.id === "string" ? pkg.id : String(pkg?.id ?? ""),
            name: typeof pkg?.name === "string" ? pkg.name : "",
            originalName: typeof pkg?.originalName === "string" ? pkg.originalName : pkg?.name,
            description: typeof pkg?.description === "string" ? pkg.description : null,
            revenueCatId: normalisedRevenueCatId,
            yocoId: normalisedYocoId ?? normalisedRevenueCatId,
          }
        })

        setPackages(parsed)
      } catch (error) {
        if (!active) return
        console.error("Failed to fetch packages for annual statement:", error)
        setPackages([])
        setPackagesError(error instanceof Error ? error.message : "Unable to load package catalogue.")
      } finally {
        if (active) {
          setPackagesLoading(false)
        }
      }
    }

    fetchPackages()

    return () => {
      active = false
    }
  }, [postId])

  useEffect(() => {
    let active = true

    const fetchTransactions = async () => {
      setTransactionsLoading(true)
      setTransactionsError(null)
      try {
        const response = await fetch("/api/yoco/transactions?limit=365", {
          credentials: "include",
        })
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Sign in to review the annual statement of account.")
          }
          throw new Error("Failed to load transactions.")
        }

        const data = await response.json()
        if (!active) return

        const docs = Array.isArray(data?.transactions) ? data.transactions : []
        setTransactions(docs)
      } catch (error) {
        if (!active) return
        setTransactions([])
        setTransactionsError(error instanceof Error ? error.message : "Unable to load transactions.")
      } finally {
        if (active) {
          setTransactionsLoading(false)
        }
      }
    }

    fetchTransactions()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const fetchBeneficiaries = async () => {
      setBeneficiariesLoading(true)
      setBeneficiariesError(null)
      try {
        const response = await fetch("/api/guests", { credentials: "include" })
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Sign in to view beneficiary records.")
          }
          throw new Error("Failed to load beneficiaries.")
        }

        const data = await response.json()
        if (!active) return

        setBeneficiaries(Array.isArray(data) ? data : [])
      } catch (error) {
        if (!active) return
        setBeneficiaries([])
        setBeneficiariesError(error instanceof Error ? error.message : "Unable to load beneficiaries.")
      } finally {
        if (active) {
          setBeneficiariesLoading(false)
        }
      }
    }

    fetchBeneficiaries()

    return () => {
      active = false
    }
  }, [])

  const transactionsForPeriod = useMemo(() => {
    if (!transactions.length) return []

    if (effectiveYear !== undefined) {
      return transactions.filter((transaction) => {
        if (!transaction.createdAt) return false
        const date = new Date(transaction.createdAt)
        return !Number.isNaN(date.getTime()) && date.getFullYear() === effectiveYear
      })
    }

    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    return transactions.filter((transaction) => {
      if (!transaction.createdAt) return false
      const date = new Date(transaction.createdAt)
      if (Number.isNaN(date.getTime())) return false
      return date >= start && date <= now
    })
  }, [transactions, effectiveYear])

  const monthlySummary = useMemo(() => {
    const summaryMap = new Map<string, MonthlySummary>()

    const seedMonth = (date: Date) => {
      const key = `${date.getFullYear()}-${date.getMonth()}`
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          key,
          label: monthLabelFormatter.format(date),
          completedAmount: 0,
          pendingAmount: 0,
          failedAmount: 0,
          completedCount: 0,
          totalCount: 0,
        })
      }
    }

    if (effectiveYear !== undefined) {
      for (let month = 0; month < 12; month += 1) {
        seedMonth(new Date(effectiveYear, month, 1))
      }
    } else {
      const now = new Date()
      for (let offset = 11; offset >= 0; offset -= 1) {
        seedMonth(new Date(now.getFullYear(), now.getMonth() - offset, 1))
      }
    }

    transactionsForPeriod.forEach((transaction) => {
      if (!transaction.createdAt) return
      const date = new Date(transaction.createdAt)
      if (Number.isNaN(date.getTime())) return

      const key = `${date.getFullYear()}-${date.getMonth()}`
      const entry =
        summaryMap.get(key) ??
        {
          key,
          label: monthLabelFormatter.format(date),
          completedAmount: 0,
          pendingAmount: 0,
          failedAmount: 0,
          completedCount: 0,
          totalCount: 0,
        }

      const amount = transaction.amount ?? 0
      entry.totalCount += 1

      switch (transaction.status) {
        case "completed":
          entry.completedAmount += amount
          entry.completedCount += 1
          break
        case "pending":
          entry.pendingAmount += amount
          break
        case "failed":
        case "cancelled":
          entry.failedAmount += amount
          break
        default:
          break
      }

      summaryMap.set(key, entry)
    })

    return Array.from(summaryMap.values()).sort((a, b) => {
      const [aYearStr = "0", aMonthStr = "0"] = a.key.split("-")
      const [bYearStr = "0", bMonthStr = "0"] = b.key.split("-")
      const aYear = Number(aYearStr) || 0
      const aMonth = Number(aMonthStr) || 0
      const bYear = Number(bYearStr) || 0
      const bMonth = Number(bMonthStr) || 0

      if (aYear === bYear) return aMonth - bMonth
      return aYear - bYear
    })
  }, [transactionsForPeriod, effectiveYear])

  const statementTotals = useMemo(() => {
    const completedAmount = transactionsForPeriod.reduce(
      (sum, transaction) => (transaction.status === "completed" ? sum + (transaction.amount ?? 0) : sum),
      0,
    )

    const pendingAmount = transactionsForPeriod.reduce(
      (sum, transaction) => (transaction.status === "pending" ? sum + (transaction.amount ?? 0) : sum),
      0,
    )

    const failedAmount = transactionsForPeriod.reduce(
      (sum, transaction) =>
        transaction.status === "failed" || transaction.status === "cancelled" ? sum + (transaction.amount ?? 0) : sum,
      0,
    )

    const completedCount = transactionsForPeriod.filter((transaction) => transaction.status === "completed").length
    const pendingCount = transactionsForPeriod.filter((transaction) => transaction.status === "pending").length

    return {
      completedAmount,
      pendingAmount,
      failedAmount,
      completedCount,
      pendingCount,
      totalCount: transactionsForPeriod.length,
    }
  }, [transactionsForPeriod])

  const shareUrl = typeof window !== "undefined" ? window.location.href : ""

  const transactionTimeline = useMemo(() => {
    return [...transactionsForPeriod]
      .filter((transaction) => transaction.createdAt)
      .sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bDate - aDate
      })
      .slice(0, 12)
  }, [transactionsForPeriod])

  const packageAliasLookup = useMemo(() => {
    const map = new Map<string, StatementPackage>()
    packages.forEach((pkg) => {
      ;[pkg.name, pkg.originalName, pkg.revenueCatId, pkg.yocoId].forEach((value) => {
        if (typeof value === "string" && value.trim()) {
          map.set(value.toLowerCase(), pkg)
        }
      })
      if (pkg.revenueCatId && pkg.revenueCatId.toLowerCase().includes("three_nights")) {
        map.set("3nights", pkg)
      }
    })
    return map
  }, [packages])

  const derivePackageIdentity = (
    raw: string | null,
    status: YocoTransactionRecord["status"],
  ): PackageIdentity => {
    if (raw && raw.trim()) {
      const alias = packageAliasLookup.get(raw.toLowerCase())
      if (alias) {
        const displayName = alias.originalName || alias.name || alias.revenueCatId || raw
        const keyBase = alias.revenueCatId || alias.originalName || alias.name || raw
        return { key: keyBase.toLowerCase(), displayName, pkg: alias }
      }
      return { key: raw.toLowerCase(), displayName: raw, pkg: null }
    }

    const fallbackLabel = status ? `${status.charAt(0).toUpperCase()}${status.slice(1)} booking` : "Booking"
    const fallbackKey = status ? `status:${status}` : "status:general"
    return { key: fallbackKey, displayName: fallbackLabel, pkg: null }
  }

  const getTransactionIdentity = (transaction: YocoTransactionRecord) => {
    const raw =
      (typeof transaction.packageName === "string" && transaction.packageName) ||
      (typeof transaction.plan === "string" && transaction.plan) ||
      (typeof transaction.entitlement === "string" && transaction.entitlement) ||
      null
    return derivePackageIdentity(raw, transaction.status)
  }

  const mostPopularPackage = useMemo<{ name: string; count: number; completedRevenue: number } | null>(() => {
    if (!transactionsForPeriod.length) return null

    const counts = new Map<string, { name: string; count: number; completedRevenue: number }>()

    transactionsForPeriod.forEach((transaction) => {
      const identity = getTransactionIdentity(transaction)

      const current = counts.get(identity.key) ?? { name: identity.displayName, count: 0, completedRevenue: 0 }
      current.name = identity.displayName
      current.count += 1
      if (transaction.status === "completed") {
        current.completedRevenue += transaction.amount ?? 0
      }
      counts.set(identity.key, current)
    })

    let leader: { name: string; count: number; completedRevenue: number } | null = null
    counts.forEach((value) => {
      if (!leader || value.count > leader.count) {
        leader = { name: value.name, count: value.count, completedRevenue: value.completedRevenue }
      }
    })

    return leader
  }, [transactionsForPeriod, packageAliasLookup])

  useEffect(() => {
    if (!shareCopied) return
    const timer = setTimeout(() => setShareCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [shareCopied])

  const copyShareUrl = () => {
    if (!shareUrl) return
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => setShareCopied(true))
      .catch((error) => console.error("Failed to copy statement URL:", error))
  }

  const generateLeaseAgreement = () => {
    if (!postDetails || !currentUser) return

    // Calculate lease period (12 months from now)
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    const endDate = new Date(now.getFullYear() + 1, now.getMonth(), 0)
    
    const formatLeaseDate = (date: Date) => {
      const day = date.getDate()
      const month = date.toLocaleDateString('en-US', { month: 'long' })
      const year = date.getFullYear()
      const daySuffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'
      return `${day}${daySuffix} ${month} ${year}`
    }

    // Calculate average monthly rental from completed transactions
    const completedTransactions = transactionsForPeriod.filter(t => t.status === 'completed')
    const totalRevenue = completedTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)
    const monthlyRental = completedTransactions.length > 0 
      ? Math.round(totalRevenue / 12) 
      : 20000 // Default fallback
    
    const formatCurrency = (amount: number) => {
      return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    const formatCurrencyWords = (amount: number) => {
      // Simple number to words conversion for common amounts
      const thousands = Math.floor(amount / 1000)
      const remainder = amount % 1000
      let words = ''
      if (thousands > 0) {
        words += `${thousands} thousand`
      }
      if (remainder > 0) {
        if (words) words += ' '
        words += `${remainder} rand`
      }
      return words || 'zero rand'
    }

    // Extract data
    const postName = postDetails.title || 'SimplePlek'
    const landlordName = postDetails.authors?.[0] || 'LANDLORD NAME'
    const tenantName = currentUser.name || currentUser.email || 'LEASER NAME'
    const hostName = postDetails.authors?.[0] || 'HOST NAME'
    const hostContact = currentUser.email || 'hello@thanks.digital'
    const rentalAmount = monthlyRental
    const rentalAmountFormatted = formatCurrency(rentalAmount)
    const rentalAmountWords = formatCurrencyWords(rentalAmount)

    // Generate lease document
    const leaseDocument = `LEASE AGREEMENT

of premises known as

"${postName}"





${landlordName}



and



${tenantName}



1



TERMS AND CONDITIONS OF LEASE (7 pages)

For convenience sake the residence is regarded as "${postName}"

and the occupier "The tenant ${tenantName}"

PERIOD OF LEASE

The renewed lease period will be from ${formatLeaseDate(startDate)} to ${formatLeaseDate(endDate)}

i.e. a period of a full 12 months.

RENT

Rental will be

${rentalAmountFormatted} (${rentalAmountWords} only).

Rental is payable in advance on the first day of each and every month.

Rent should be paid by pre-arranged debit order, or by bank transfer into the account as

given below:-

${hostName} (RENT ${postName}) (Admin)

BANK NAME

Account no 

Branch Hout Bay

Please sent payment details to email: - ${hostContact}

Please pay the amount in full each month.

Please do not pay cash into this account.

DEPOSIT

There is no deposit required.

KEYS

ONE set of keys for the house and a remote for the gate will be given on payment of the

rental for the first month and these must be returned at the end of lease agreement.

In the event of loss or need to replace this will be at the tenant's expense.

An emergency 2nd set will be held by Chris Harding on 021 7902655 or cell no

0724089592. He lives at no 32 Llandudno Road.

Copies of keys and new remotes are for your account.

LIABILITY

"${postName}" will be occupied by TWO persons only.

${tenantName}, will be liable for any damage due to negligence, dog damage or

domestic violence in the event of his sub-letting the premises for short term rentals.

We will not accept liability in the case of persons falling through or off the deck

area.

See Repairs and Maintenance



2



NOTICE

TWO months notice is required on both sides after the initial 12 month lease term.

A new lease agreement must be drawn up at end of the initial term.

Please communicate wish to terminate or extend the lease agreement in writing to

${hostContact}

DEFAULT IN PAYMENT OF RENTAL

Failure to pay on the first day of each month or habitual late payment could be interpreted as

intentional break in lease agreement. We understand that debit orders get delayed over weekends and

holidays.

Please communicate should there be a problem, so that there is no misunderstanding.

INCREASE IN RENTAL

The rental will increase by about 5% percent per annum.

This is based on increase in insurance rates,PPS Security rates, City of CT rates and water accounts

or Llandudno local improvement group rates, which are difficult to estimate in advance.

SUBLETTING

There may be Short Term only Subletting of the above premises but you are responsible for all

repairs and damage.

You may also give SIMPLEPLEKs' name and number for any problems they may have with "${postName}" in your absence.

If the place is to be left unoccupied for a short period please advise us of this too.

This is for Insurance purposes.

REPAIRS AND MAINTENANCE , RE-DECORATING AND PAINTING

"${postName}" will be freshly painted inside periodically, in white.

Please consult the owners prior to any changes in paint finishes and fittings etc.

"${postName}" must be restored to its original colour and freshly painted in white on vacating.

Please let us know when things need repainting or fixing in between due to "wear and tear"

"Wear and tear" will be considered, but any damage will be for your account.

Please do not make any refurbishments or additions without consulting us first.

Please note that any other installations or modifications should remain on departure.

Please prevent damage where possible, especially to windows, which should not be left to bang in the

wind. You will be held liable for broken glass if latches are not used.

The front deck is flimsy so will not allow for many people on it at the same time.

The side deck is newer and stronger.

Best not use the heavy garden chairs on deck as the metal tears the wood.There is a camp chair in the

back room and the lighter basket chair can be used outside too.

Please do not leave chairs or cushions outside in the rain.

AREA OF RENTAL

"${postName}" consists of two rooms as well as kitchen and toilet/shower room.

The garden is for your use as well. Please park only on the paved driveway and not on the grass.

When entertaining, please ask guests to park outside in the parking area. Driveway takes a max of 3

cars.



3



DEFECTS/FAULTS

Please report any defects, or tap leaks etc immediately, preferably in writing to

${hostContact}.or by phone – SIMPLEPLEK or ${hostName} so that these

may be attended to ASAP.

"${postName}" is old so please respect the structure by living gently!

No large numbers of guests inside and entertaining is best done in the garden – weather dependent!

The roof was repaired recently so there should not be any leaks, but if so, these must be reported

immediately, so that they may be rectified. Water damage can be drastic!

The sewers were cleared recently. The manhole is in the pathway to the outside loo. There is another

one at the bottom of the garden with new brick surrounds, as the ground levels have been changed.

The geyser is in the cupboard outside but can be switched off on the electricity board inside if you go

away or water is off due to C of CT water problems.

Please advise us immediately should anything break.

Please consult with us first before calling in plumbers etc.

Any damage due to negligence or break in will be for your own account e.g. broken windows.

Please keep all doors and windows closed when not there, to prevent opportunistic theft.

Please also prevent windows from banging in wind, by latching or placing pillows on window sills

as you will be liable for new glass if it gets broken or cracked.

Please use the ALARM when going out or leaving.

Please advise guests to do this too. Could put in online notes.

NO SMOKING/FIRE RISK

"${postName}" is a NO smoking house as the wood absorbs the smell.

We understand you are a non-smoker.

Please ask visitors to smoke outside and to use an ashtray.

Please do not throw cigarette butts into the bush, as these may cause bush fire.

Candles too are a problem. Please do not use.

Rather use the rechargeable lamps provided.

Candles left unattended or put too close to curtains or walls which too may catch alight, or cause

oily smoke marks up walls that are difficult to paint over.

When braai-ing please use a garden hose to water the surrounding bush to prevent sparks igniting

the whole area. No fires on really windy days! Rather use the gas braai on wooden deck.

You will be held liable in case of fire and subsequent call-out of the fire brigade etc.

GARDEN MAINTENANCE

It is your responsibility to keep the garden neat and tidy. Please cut the grass regularly and give

grass is regular water especially in summer heat. It may require fertilizer every 6 months to keep

weeds down and encourage growth.

Please ask Chris to cut trees as they grow and in the event of no lawnmower he can cut

the grass too, for which he may ask you to pay towards his staff member. The larger timber in the

garden can preferably be used for landscaping and smaller branches be burned as braai-wood.

Leaves can make mulch/compost. This helps to reduce fire hazard as it dries out.

Please park only on the paving in the drive-way.



4



The top garden maintenance is your responsibility. The bottom garden looks a bit sad as it has been

so dry things have died. Please organize a clean up if it gets too overgrown in winter.

Please pick up any dog mess in the whole garden. All dogs prefer to go down there, so please clean

up their mess. There is poop scoop provided.

DOG/S

We understand you have ONE dog. These are important as added security.

Damage by friends/guests dogs is also for your liability.

Dogs are permitted on the beach in winter months but in summer only from 6pm to 9am.

Please pick up any dog poo and put it in a bag in the bins provided. There are sometimes bags

provided at the top of the middle stairs to the beach. Best have a key ring container for bags available

from vet shops.

Damage and fleas etc are covered under Liability etc.

The deposit may not cover any damage done by unruly dogs, left unattended.

Dog poo can be put in bins in parking areas as these are emptied daily.

WATER

Any excessive water accounts will be your responsibility.

We will cover that amount in rent, but any excess will be for your account.

There should be ample water for TWO persons especially if you take short showers.

City asking to limit showers to 5mins only but 2 mins shower is preferable.

Wet yourself, then switch off water while washing hair etc. switching taps on again to rinse off.

A hose is connected to the shower outlet pipe, which runs onto the grass area. Please check it has not

pulled out and vary hose position daily. Suggest use basin in shower

to catch water. This and dog water bowls can be put onto new plants in front of the house.

Remember water usage is charged again under sewerage, so please be aware of any leaks etc.

There is a dish washing machine in the kitchen. Please use rather than doing endless short washing

up sessions.

Please watch out for water leaks from this machine.! Dish washers use less water if only washed a

few times a week.

ELECTRICITY

This is your responsibility as it is supplied by pre pre-paid meter.

You have installed solar and an inverter to reduce high electricity rates.

Please be aware of flashing lights or loud beeps from the meter to warn if it is getting low.

Burglar Alarm and electronic gate needs power so best not run out!!!

Please reload prior to going away. Suggest you keep a R20.00 voucher on top in case of emergency

or for when there are guests, if run-out at night.

Please warn guests if Load shedding returns .

INTERNET and WIFI

These are for your own account.

Please liaise with us prior to cancellation on your departure.

ELECTRONIC GATE OPENER

The gate has an electronic motor opener and one remote will be supplied.

Please keep the metal track free of sand and leaves. If gate sluggish check track is clear!!!

Keep the gate closed at all times as a security measure.



5



Please advise guests that:-

If it is slow to react it usually means the electricity is off and that it is in battery mode.

Please limit using it in this mode. You may be liable for a new battery if it goes flat.

The solar electricity should prevent this happening.

There is an emergency override key to open the motor in emergency.

There are reflectors on gates and some trees to prevent people driving into them in the dark.

Please keep the bushes trimmed in the driveway so as to not damage cars reversing up driveway.

Please use your mirrors to reverse! Please replace reflectors from time to time.

BURGLAR ALARM/security

PPS is included in your rental

Please keep all doors and windows closed, and arm the alarm when not there, to prevent

opportunistic theft.

There are no burglar bars in the front room or kitchen doors and windows.

The bedroom and the high back two windows- bedroom and bathroom- do have burglar bars.

The bedroom has a bolt on the door should you or guests wish to lock themselves in further,

especially if nervous overnight.

There is a panic button under the bedroom window and on the alarm panel. It needs to be held down

for 5 seconds to longer to activate, not just a quick touch!

There is an alarmed response in place connected to PPS, the resident alarm company.

The monthly account is covered in your rental and is paid by debit order.

You are advised to check it monthly to see if it is working. Let it go off by not deactivating the alarm

on arrival and PPS should ring you to check if it is a false alarm. Please make note of their number to

phone in an emergency. The cars patrol and there are also foot patrols. Make yourself known to the

cars on patrol. They do sit in the parking area at times and sit in a hut at the top at the entrance.

They do not charge for calls for security matters however do charge for maintenance issues.

If nervous they can accompany you home. Please ring them if there is any suspicious behavior or

threat of intruders in the garden. Better safe than sorry.

There are three outside lights for checking movement in the garden or if going out at night.

Insurance of furniture and effects is covered by insurance, but not guests private belongings.



FLOORING

The wooden floors have been painted white, which does rather show the dirt if they have dogs inside.

It is best that these be protected by using rugs /mats which can be vacuumed or shaken outside.

Warmer rugs will be needed in winter months.

FURNITURE

"${postName}" is let furnished. A Double Bed and bedding is supplied but you may need to replace

from season to season. Same with Towels.

A list and photos will be taken of the furniture left.

There is a wooden slatted double bed and new mattress, wooden chest of drawers and cupboard in

the bedroom. Shelves in the bathroom for toiletries and towels etc.

Fridge, dish washer, washing machine, induction hot plate for cooking with correct saucepans,

microwave, crockery, cutlery, toaster, kettle and general household effects have been left.

We may replace broken or lost crockery and cutlery from time to time.



6



HEATING

Please do not leave Econoheat panels on when out all day nor cover with wet objects as these too

may cause fires.

A new one is supplied each winter as they seem to crack

PETS (see Animals above)

Pets are permitted but any damage done must be repaired at your cost.

Any damage done must be repaired to our agreed specifications

Please do not leave any dog unattended inside the house. Be aware that any barking carries around

the valley and that if irritating, neighbors will complain.

FENCING

The plot is fenced all round.

The wall and gates have been raised recently to prevent people and dogs jumping over as well as to

increase security. Please keep the electronic gate closed for your own protection.

Please keep the gate at the bottom of the garden locked at all times.

Please make sure branches dont bang or lean / fall on ${postName}, which will damage it.

REFUSE COLLECTION

Please place rubbish in bins in the parking area, which has regular collection.

There should be bin emptying on a weekly basis, usually on a Tuesday. There is a separate recycling

business who gives the clear plastic bags and collects them on Tuesday or Wednesdays. Please add

yours to the piles left in Llandudno Road as they don't seem to come to the ${postName} gate.

No bin has been supplied but we will look into getting one from the local council.

There are two gray bins in the kitchen. These must be left on departure.

INSPECTION OF PREMISES

There may be occasional inspection of premises by prior arrangement, but more likely by

way of telephone call to check if all in order, or occasional pop in for tea if in town.

OTHER

-Please ring us should there be water or electrical problems as the details have to match the

account name.

-Please use your home address for tax etc purposes.

Please discuss directly with us any issues you may have or amendments to the lease agreement.

We trust that the above meets with your approval..`

    // Create and download the file
    const blob = new Blob([leaseDocument], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Lease_Agreement_${postName.replace(/\s+/g, '_')}_${formatLeaseDate(startDate).replace(/\s+/g, '_')}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const formatRole = (role?: User["role"]) => {
    if (!role) return "Viewer"

    const normalise = (value: unknown): string | null => {
      if (!value) return null
      if (typeof value === "string") return value
      if (typeof value === "object") {
        if (Array.isArray(value)) {
          const first = value.find(Boolean)
          return typeof first === "string" ? first : null
        }
        const entries = Object.values(value as Record<string, unknown>).flat()
        const first = entries.find((item) => typeof item === "string") as string | undefined
        return first ?? null
      }
      return String(value)
    }

    const resolved = normalise(role) ?? "viewer"
    return resolved.charAt(0).toUpperCase() + resolved.slice(1)
  }

  const trustAuthors = postDetails?.authors?.length ? postDetails.authors.join(", ") : null
  const showGlobalSpinner = transactionsLoading && beneficiariesLoading && (postLoading || Boolean(postId))

  return (
    <div className="container py-10">
      <h1 className="mb-2 text-4xl font-bold tracking-tight text-foreground">
        {effectiveYear !== undefined ? `Annual booking statement ${effectiveYear}` : "12-month booking statement"}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Review the annual short-term rental income and supporting trust documentation for compliance purposes.
      </p>

      <Alert className="mb-6 border-amber-500/40 bg-amber-500/5">
        <AlertTitle>Adverse note on short-term rentals</AlertTitle>
        <AlertDescription>
          Sustained short-term letting can expose the trust to liquidity and compliance risk. Use this statement to
          demonstrate where income flowed and which beneficiaries received it over the past 12 months.
        </AlertDescription>
      </Alert>

      {postLoading && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading trust deed context...
        </div>
      )}

      {!postLoading && postError && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{postError}</span>
        </div>
      )}

      {!postLoading && !postError && postDetails && (
        <Card className="mb-6 border-primary/40 bg-primary/5">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{postDetails.title}</CardTitle>
              <CardDescription>
                {trustAuthors ? `Trust deed compiled by ${trustAuthors}` : "No author details recorded for this trust."}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Share statement</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Share annual booking statement</DialogTitle>
                    <DialogDescription>Copy the secure link below to share these figures with trustees and beneficiaries.</DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={shareUrl} readOnly className="flex-1" />
                      <Button size="sm" onClick={copyShareUrl}>
                        <CopyIcon className="mr-2 h-4 w-4" />
                        {shareCopied ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {currentUser
                        ? `Shared by ${currentUser.name || currentUser.email || "You"} (${formatRole(currentUser.role)})`
                        : "Share link generated for your current session."}
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
              <Button 
                variant="outline" 
                onClick={generateLeaseAgreement}
                disabled={!postDetails || !currentUser}
              >
                <FileTextIcon className="mr-2 h-4 w-4" />
                Lease Agreement
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium text-foreground">{formatDate(postDetails.createdAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last updated</p>
              <p className="font-medium text-foreground">{formatDate(postDetails.updatedAt)}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-muted-foreground">Trust reference</p>
              <p className="font-medium text-foreground">{postDetails.id}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!postLoading && !postError && postDetails?.authors?.length ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Trustees & pro hosts</CardTitle>
            <CardDescription>Trusted parties accountable for this trust deed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {postDetails.authors.map((author, index) => (
              <div key={`${author}-${index}`} className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
                <span className="text-sm font-medium text-foreground">{author}</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {postDetails.authorRoles?.[index] ?? "Trustee"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {transactionTimeline.length > 0 ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Board resolutions & minutes</CardTitle>
            <CardDescription>
              Snapshot of the latest transactions recorded against this trust—use as draft minutes when allocating income.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {packagesLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading package catalogue…
              </div>
            ) : null}
            {packagesError ? (
              <p className="text-xs text-destructive">Package catalogue unavailable: {packagesError}</p>
            ) : null}
            {transactionTimeline.map((transaction) => {
              const identity = getTransactionIdentity(transaction)
              const revenueCatProduct =
                identity.pkg?.revenueCatId || identity.pkg?.yocoId ? (identity.pkg?.revenueCatId ?? identity.pkg?.yocoId) : null

              return (
                <div key={transaction.id} className="rounded-md border border-border/70 px-3 py-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      {formatDate(transaction.createdAt)}
                    </span>
                    <Badge variant={transaction.status === "completed" ? "default" : "outline"}>
                      {transaction.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {identity.displayName} {identity.pkg?.id ? `(${identity.pkg.id})` : ""} • {formatAmountToZAR(transaction.amount ?? 0)}
                  </p>
                  {identity.pkg?.id ? (
                    <p className="text-xs text-muted-foreground">
                      Package ID: {identity.pkg.id}
                    </p>
                  ) : null}
                  {revenueCatProduct ? (
                    <p className="text-xs text-muted-foreground">
                      RevenueCat product: {revenueCatProduct}
                    </p>
                  ) : null}
                  {transaction.completedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Settled on {formatDate(transaction.completedAt)}
                    </p>
                  ) : null}
                  {transaction.intent === 'product' && transaction.linkedBookings && transaction.linkedBookings.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Linked to bookings:</p>
                      {transaction.linkedBookings.map((booking) => (
                        <div key={booking.id} className="text-xs text-muted-foreground ml-2">
                          • {booking.post?.title || booking.title} ({formatDate(booking.fromDate)} - {formatDate(booking.toDate)})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ) : null}

      {showGlobalSpinner && (
        <div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Compiling transactions and beneficiary records...
        </div>
      )}

      {transactionsError && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{transactionsError}</span>
        </div>
      )}

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed income</CardTitle>
            <Badge className="w-fit bg-green-100 text-green-800">Settled</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {formatAmountToZAR(statementTotals.completedAmount)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {statementTotals.completedCount} completed transaction
              {statementTotals.completedCount === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending clearance</CardTitle>
            <Badge className="w-fit bg-amber-100 text-amber-800">Outstanding</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {formatAmountToZAR(statementTotals.pendingAmount)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {statementTotals.pendingCount} pending transaction
              {statementTotals.pendingCount === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Most popular package</CardTitle>
            <Badge className="w-fit bg-primary/10 text-primary">Top booking</Badge>
          </CardHeader>
          <CardContent>
            {mostPopularPackage ? (
              <>
                <p className="text-2xl font-bold text-foreground">
                  {mostPopularPackage?.name ?? "Top package"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {mostPopularPackage.count} booking{mostPopularPackage.count === 1 ? "" : "s"} •{" "}
                  {formatAmountToZAR(mostPopularPackage.completedRevenue)} settled
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No package data for the selected period.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <p className="mb-8 text-right text-xs text-muted-foreground">
        Analysed {statementTotals.totalCount} transaction{statementTotals.totalCount === 1 ? "" : "s"} over the period.
      </p>

      <Card className="mb-8 border-border">
        <CardHeader>
          <CardTitle>12-month transaction summary</CardTitle>
          <CardDescription>
            Consolidated statement of account covering the last 12 months of short-term rental activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monthlySummary.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left">Month</th>
                    <th className="py-2 text-right">Completed</th>
                    <th className="py-2 text-right">Pending</th>
                    <th className="py-2 text-right">Failed / Cancelled</th>
                    <th className="py-2 text-right">Completed count</th>
                    <th className="py-2 text-right">Total count</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummary.map((month) => (
                    <tr key={month.key} className="border-t border-border/70">
                      <td className="py-2 font-medium text-foreground">{month.label}</td>
                      <td className="py-2 text-right text-foreground">{formatAmountToZAR(month.completedAmount)}</td>
                      <td className="py-2 text-right text-muted-foreground">{formatAmountToZAR(month.pendingAmount)}</td>
                      <td className="py-2 text-right text-muted-foreground">{formatAmountToZAR(month.failedAmount)}</td>
                      <td className="py-2 text-right text-foreground">{month.completedCount}</td>
                      <td className="py-2 text-right text-foreground">{month.totalCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No transaction history available for the selected period.
            </p>
          )}
        </CardContent>
      </Card>

      {beneficiariesError && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{beneficiariesError}</span>
        </div>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Beneficiary ledger</CardTitle>
          <CardDescription>
            Records which guests were linked to bookings that generated package money.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {beneficiariesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading guest records...
            </div>
          ) : beneficiaries.length > 0 ? (
            <div className="space-y-3">
              {beneficiaries.map((beneficiary) => (
                <div
                  key={beneficiary.id}
                  className="shadow-sm p-3 border border-border rounded-lg flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 border border-border rounded-full">
                      <UserIcon className="size-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {beneficiary.name || beneficiary.email || "Unnamed beneficiary"}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {formatRole(beneficiary.role)}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground sm:text-right">
                    <p>{beneficiary.email || "No email on record"}</p>
                    <p>Bank details: pending capture</p>
                    <p>Income allocation pending</p>
                    {beneficiary.createdAt ? (
                      <p>Joined {formatDate(beneficiary.createdAt)}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No guests recorded yet. Once bookings include guests, their details will appear here for allocation.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

