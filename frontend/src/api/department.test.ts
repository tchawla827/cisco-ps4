import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, loadDepartment } from './department'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadDepartment', () => {
  it('posts the requested scenario and returns the department response', async () => {
    const department = { scenario: 'main-12', root_id: 'HOD' }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(department), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadDepartment('main-12')).resolves.toEqual(department)
    expect(fetchMock).toHaveBeenCalledWith('/api/department/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'main-12' }),
    })
  })

  it('throws the backend error as ApiError for a non-success response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: 'UNKNOWN_SCENARIO', message: 'Scenario does not exist' },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await expect(loadDepartment('missing')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'UNKNOWN_SCENARIO',
      message: 'Scenario does not exist',
    } satisfies Pick<ApiError, 'name' | 'code' | 'message'>)
  })
})
