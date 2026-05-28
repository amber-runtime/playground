import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setPricing } from '../../lib/pricingStore'
import { makeDetail, makeWorkflow } from '../../test/fixtures'
import { renderWithRoute } from '../../test/render'
import { WorkflowDetailPage } from './WorkflowDetailPage'

const apiMocks = vi.hoisted(() => ({
  fetchWorkflowDetail: vi.fn(),
  resumeWorkflow: vi.fn(),
  cancelWorkflow: vi.fn(),
}))

const contextMocks = vi.hoisted(() => ({
  workflowDetails: {} as Record<string, ReturnType<typeof makeDetail>>,
  setDetail: vi.fn(),
}))

vi.mock('../../lib/api', () => apiMocks)
vi.mock('../../lib/workflowContext', () => ({
  useWorkflows: () => ({
    workflowDetails: contextMocks.workflowDetails,
    setDetail: contextMocks.setDetail,
  }),
}))

function renderDetailPage() {
  return renderWithRoute(<WorkflowDetailPage />, {
    route: '/workflows/wf-1',
    path: '/workflows/:id',
  })
}

describe('WorkflowDetailPage', () => {
  beforeEach(() => {
    setPricing({}, null)
    contextMocks.workflowDetails = {}
    contextMocks.setDetail.mockReset()
  })

  it('shows initial loading while the workflow detail request is in flight', () => {
    apiMocks.fetchWorkflowDetail.mockReturnValue(new Promise(() => undefined))

    renderDetailPage()

    expect(screen.getByText('Loading workflow…')).toBeInTheDocument()
    expect(apiMocks.fetchWorkflowDetail).toHaveBeenCalledWith('wf-1')
  })

  it('shows initial fetch failure and retries on request', async () => {
    const user = userEvent.setup()
    apiMocks.fetchWorkflowDetail
      .mockRejectedValueOnce(new Error('backend unavailable'))
      .mockResolvedValueOnce(makeDetail())

    renderDetailPage()

    expect(await screen.findByText('Failed to load workflow.')).toBeInTheDocument()
    expect(screen.getByText('backend unavailable')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => expect(apiMocks.fetchWorkflowDetail).toHaveBeenCalledTimes(2))
    expect(contextMocks.setDetail).toHaveBeenCalledWith('wf-1', expect.any(Object))
  })

  it('keeps stale data visible and shows a refresh failure banner', async () => {
    contextMocks.workflowDetails = {
      'wf-1': makeDetail({ workflow: { workflow_id: 'wf-1', status: 'PENDING' } }),
    }
    apiMocks.fetchWorkflowDetail.mockRejectedValue(new Error('timeout'))

    renderDetailPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Research Assistant' })).toBeInTheDocument()
    expect(await screen.findByText('Failed to refresh. Showing last known data.')).toBeInTheDocument()
    expect(screen.getByText('timeout')).toBeInTheDocument()
  })

  it('shows the waiting state and manual refresh for pending workflows with no steps', () => {
    contextMocks.workflowDetails = {
      'wf-1': makeDetail({
        workflow: { workflow_id: 'wf-1', status: 'PENDING' },
        steps: [],
      }),
    }
    apiMocks.fetchWorkflowDetail.mockResolvedValue(contextMocks.workflowDetails['wf-1'])

    renderDetailPage()

    expect(screen.getByText('Waiting for first step…')).toBeInTheDocument()
    expect(screen.getByText('Polling every 2 seconds')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh now/i })).toBeInTheDocument()
  })

  it('polls non-terminal workflows', async () => {
    vi.useFakeTimers()
    contextMocks.workflowDetails = {
      'wf-1': makeDetail({ workflow: { workflow_id: 'wf-1', status: 'PENDING' } }),
    }
    apiMocks.fetchWorkflowDetail.mockResolvedValue(contextMocks.workflowDetails['wf-1'])

    renderDetailPage()

    expect(apiMocks.fetchWorkflowDetail).toHaveBeenCalledTimes(1)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(2_000)
      await Promise.resolve()
    })

    expect(apiMocks.fetchWorkflowDetail).toHaveBeenCalledTimes(2)
  })

  it('does not poll terminal workflows after the initial load', async () => {
    vi.useFakeTimers()
    contextMocks.workflowDetails = {
      'wf-1': {
        workflow: makeWorkflow({ workflow_id: 'wf-1', status: 'SUCCESS' }),
        steps: [],
      },
    }
    apiMocks.fetchWorkflowDetail.mockResolvedValue(contextMocks.workflowDetails['wf-1'])

    renderDetailPage()

    expect(apiMocks.fetchWorkflowDetail).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(10_000)
      await Promise.resolve()
    })

    expect(apiMocks.fetchWorkflowDetail).toHaveBeenCalledTimes(1)
  })
})
