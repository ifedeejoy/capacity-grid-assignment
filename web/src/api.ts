// The HTTP contract with api/. Shapes mirror capacityResponse and
// personResponse in the Go code; change both sides together.

export type Person = {
  id: number
  name: string
  weeklyHours: number
}

export type CapacityRow = Person & {
  /** Hours allocated per week, index-aligned with CapacityResponse.weeks. */
  allocated: number[]
}

export type CapacityResponse = {
  from: string
  to: string
  weeks: string[]
  people: CapacityRow[]
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function readError(res: Response, fallback: string): Promise<never> {
  let message = fallback
  try {
    const body = (await res.json()) as { error?: string }
    if (body?.error) message = body.error
  } catch {
    // body was not JSON; keep the fallback
  }
  throw new ApiError(message, res.status)
}

/** How long to wait on the API before treating a request as failed. */
const TIMEOUT_MS = 15_000

function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

/** fetch, but with failures a manager can read. Caller-initiated aborts pass through untouched. */
async function request(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ApiError('The server did not respond in time', 0)
    }
    throw new ApiError('Could not reach the server', 0)
  }
}

export async function fetchCapacity(from: string, to: string, signal?: AbortSignal): Promise<CapacityResponse> {
  const params = new URLSearchParams({ from, to })
  const res = await request(`/api/capacity?${params}`, { signal: withTimeout(signal) })
  if (!res.ok) await readError(res, `Could not load capacity (HTTP ${res.status})`)
  return (await res.json()) as CapacityResponse
}

export async function updateWeeklyHours(id: number, weeklyHours: number): Promise<Person> {
  const res = await request(`/api/people/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weeklyHours }),
    signal: withTimeout(),
  })
  if (!res.ok) await readError(res, `Could not save (HTTP ${res.status})`)
  return (await res.json()) as Person
}
