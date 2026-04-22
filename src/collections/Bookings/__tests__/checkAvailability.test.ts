import { describe, it, expect, vi, afterEach } from 'vitest'

import { checkAvailability } from '../endpoints/check-availability'
import { checkAvailabilityHook } from '../hooks/checkAvailability'

afterEach(() => {
  vi.restoreAllMocks()
})

const defaultQuery = {
  postId: 'post-123',
  startDate: '2025-09-04T13:34:24.736Z',
  endDate: '2025-09-06T13:34:24.736Z',
}

const buildEndpointReq = (
  overrides: Partial<typeof defaultQuery & { bookingId?: string; packageId?: string }> = {},
  docs: unknown[] = [],
  packageConfig?: Record<string, unknown>,
) => {
  const find = vi.fn().mockResolvedValue({ docs })
  const findByID = vi.fn()

  if (overrides.packageId && packageConfig) {
    findByID.mockResolvedValue(packageConfig)
  } else {
    findByID.mockResolvedValue(undefined)
  }

  return {
    query: { ...defaultQuery, ...overrides },
    payload: {
      find,
      findByID,
    },
  } as unknown as Parameters<typeof checkAvailability.handler>[0]
}

describe('checkAvailability endpoint', () => {
  it('queries bookings using strict date overlap guards so back-to-back stays remain available', async () => {
    const req = buildEndpointReq()
    const response = await checkAvailability.handler(req)

    expect(req.payload.find).toHaveBeenCalledWith({
      collection: 'bookings',
      where: {
        and: [
          { post: { equals: defaultQuery.postId } },
          { fromDate: { less_than: '2025-09-06' } },
          { toDate: { greater_than: '2025-09-04' } },
        ],
      },
      limit: 1,
      select: {
        slug: true,
        selectedPackage: true,
      },
      depth: 0,
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.isAvailable).toBe(true)
  })

  it('excludes the current booking when bookingId is provided', async () => {
    const bookingId = 'booking-1'
    const req = buildEndpointReq({ bookingId }, [])
    const response = await checkAvailability.handler(req)

    expect(req.payload.find).toHaveBeenCalledWith({
      collection: 'bookings',
      where: {
        and: [
          { post: { equals: defaultQuery.postId } },
          { fromDate: { less_than: '2025-09-06' } },
          { toDate: { greater_than: '2025-09-04' } },
          { id: { not_equals: bookingId } },
        ],
      },
      limit: 1,
      select: {
        slug: true,
        selectedPackage: true,
      },
      depth: 0,
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.isAvailable).toBe(true)
  })

  it('respects package concurrency limits when packageId is provided', async () => {
    const packageId = 'pkg-1'
    const req = buildEndpointReq(
      { packageId },
      [{ selectedPackage: { package: packageId } }],
      { id: packageId, maxConcurrentBookings: 2 },
    )

    const response = await checkAvailability.handler(req)

    expect(req.payload.findByID).toHaveBeenCalledWith({
      collection: 'packages',
      id: packageId,
      depth: 0,
    })

    const body = await response.json()
    expect(body.isAvailable).toBe(true)
    expect(body.metadata).toEqual({ concurrencyLimit: 2, conflictingCount: 1 })
  })
})

describe('checkAvailabilityHook', () => {
  const baseData = {
    fromDate: '2025-09-04',
    toDate: '2025-09-06',
    post: 'post-123',
  }

  const buildHookArgs = (
    docs: unknown[] = [],
    options?: {
      package?: Record<string, unknown>
      dataOverrides?: Record<string, unknown>
    },
  ) => {
    const find = vi.fn().mockResolvedValue({ docs })
    const findByID = vi.fn()

    if (options?.package?.id) {
      findByID.mockResolvedValue(options.package)
    } else {
      findByID.mockResolvedValue(undefined)
    }

    const data = {
      ...baseData,
      ...(options?.dataOverrides ?? {}),
    }

    return {
      data,
      req: {
        payload: {
          find,
          findByID,
        },
      },
      operation: 'create',
    } as Parameters<typeof checkAvailabilityHook>[0]
  }

  it('queries using strict inequality guards to allow adjacent bookings', async () => {
    const args = buildHookArgs()
    await expect(checkAvailabilityHook(args)).resolves.toEqual(baseData)

    expect(args.req.payload.find).toHaveBeenCalledWith({
      collection: 'bookings',
      where: {
        and: [
          { post: { equals: baseData.post } },
          { fromDate: { less_than: baseData.toDate } },
          { toDate: { greater_than: baseData.fromDate } },
        ],
      },
      limit: 10,
      select: {
        slug: true,
        fromDate: true,
        toDate: true,
        title: true,
        id: true,
        selectedPackage: true,
      },
      depth: 0,
      req: args.req,
    })

    expect(args.req.payload.findByID).not.toHaveBeenCalled()
  })

  it('throws when overlapping bookings are returned', async () => {
    const args = buildHookArgs([{ id: 'booking-1' }])
    await expect(checkAvailabilityHook(args)).rejects.toThrow('Booking dates are not available.')
  })

  it('allows overlapping bookings when package capacity is higher than conflicts', async () => {
    const packageId = 'pkg-1'
    const args = buildHookArgs(
      [{ id: 'booking-1', selectedPackage: { package: packageId } }],
      {
        package: { id: packageId, maxConcurrentBookings: 3 },
        dataOverrides: { selectedPackage: { package: packageId } },
      },
    )

    await expect(checkAvailabilityHook(args)).resolves.toEqual(args.data)
    expect(args.req.payload.findByID).toHaveBeenCalledWith({
      collection: 'packages',
      id: packageId,
      depth: 0,
      req: args.req,
    })
  })
})


