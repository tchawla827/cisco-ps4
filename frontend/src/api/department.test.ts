import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ApiError,
  getDepartment,
  listScenarios,
  loadDepartment,
  previewTransfer,
  resetDepartment,
  transfer,
} from './department'

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

describe('department API route contracts', () => {
  it('maps each remaining client function to its backend route and request body', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ))
    vi.stubGlobal('fetch', fetchMock)

    await listScenarios()
    await getDepartment()
    await transfer('LEAD_A', 'MGR_C')
    await previewTransfer('LEAD_A', 'MGR_C')
    await resetDepartment()

    expect(fetchMock.mock.calls).toEqual([
      ['/api/scenarios', undefined],
      ['/api/department', undefined],
      ['/api/department/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: 'LEAD_A', new_manager_id: 'MGR_C' }),
      }],
      ['/api/department/transfer/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: 'LEAD_A', new_manager_id: 'MGR_C' }),
      }],
      ['/api/department/reset', { method: 'POST' }],
    ])
  })

  it.each([
    ['listScenarios', () => listScenarios()],
    ['getDepartment', () => getDepartment()],
    ['transfer', () => transfer('LEAD_A', 'MGR_C')],
    ['previewTransfer', () => previewTransfer('LEAD_A', 'MGR_C')],
    ['resetDepartment', () => resetDepartment()],
  ])('keeps the ApiError type for %s non-success responses', async (_name, request) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(
        new Response(
          JSON.stringify({ error: { code: 'REJECTED', message: 'The operation was rejected' } }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      )),
    )

    let failure: unknown
    try {
      await request()
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({
      code: 'REJECTED',
      message: 'The operation was rejected',
    })
  })
})
