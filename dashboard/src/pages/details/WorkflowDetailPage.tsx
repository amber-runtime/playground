import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useWorkflows } from '../../lib/workflowContext'
import { fetchWorkflowDetail } from '../../lib/api'
import type { SelectedStepId } from '../../lib/types'
import { WorkflowHeader } from './components/WorkflowHeader'
import { StepList } from './components/StepList'
import { StepDetailPanel } from './components/right/StepDetailPanel'
import { WorkflowDefaultPanel } from './components/right/WorkflowDefaultPanel'

const DETAIL_POLL_DELAY_MS = 2000

export function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { workflowDetails, setDetail } = useWorkflows()
  const data = id ? workflowDetails[id] : null
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadPromiseRef = useRef<Promise<void> | null>(null)
  const loadWorkflowIdRef = useRef<string | null>(null)
  const [selectedStepId, setSelectedStepId] = useState<SelectedStepId>(null)

  const handleStepClick = (stepId: number) => {
    setSelectedStepId((prev) => (prev === stepId ? null : stepId))
  }

  const load = async () => {
    if (!id) return
    if (!loadPromiseRef.current || loadWorkflowIdRef.current !== id) {
      const workflowId = id
      loadWorkflowIdRef.current = workflowId
      let promise: Promise<void> | null = null
      promise = (async () => {
        try {
          const detail = await fetchWorkflowDetail(workflowId)
          setDetail(workflowId, detail)
        } catch {
          // keep stale data on error
        } finally {
          if (promise && loadPromiseRef.current === promise) {
            loadPromiseRef.current = null
            loadWorkflowIdRef.current = null
          }
        }
      })()
      loadPromiseRef.current = promise
    }
    await loadPromiseRef.current
  }

  useEffect(() => {
    let cancelled = false

    const clearPollingTimeout = () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current)
        pollingRef.current = null
      }
    }

    const shouldPoll = !data || data.workflow.status === 'PENDING'

    const poll = async () => {
      if (!id || cancelled) return
      await load()
      if (cancelled) return
      pollingRef.current = setTimeout(() => {
        void poll()
      }, DETAIL_POLL_DELAY_MS)
    }

    clearPollingTimeout()
    if (shouldPoll) void poll()

    return () => {
      cancelled = true
      clearPollingTimeout()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.workflow.status, id])

  const BackNav = () => (
    <div className="bg-slate-900 border-b border-slate-800 px-6 py-2">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft size={14} />
        Workflows
      </button>
    </div>
  )

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950">
        <BackNav />
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading workflow…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <BackNav />

      <WorkflowHeader workflow={data.workflow} steps={data.steps} />

      <main className="max-w-7xl mx-auto px-6 py-6">
        {(() => {
          const selectedStep =
            selectedStepId != null
              ? data.steps.find((s) => s.step_id === selectedStepId) ?? null
              : null

          return (
            <div className="grid grid-cols-5 gap-4 items-start">
              <div className="col-span-3 min-w-0">
                {data.steps.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-lg px-5 py-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-amber-400 mb-2">
                      <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Waiting for first step…</span>
                    </div>
                    <p className="text-xs text-slate-500">Polling every 2 seconds</p>
                  </div>
                ) : (
                  <StepList
                    workflow={data.workflow}
                    steps={data.steps}
                    selectedStepId={selectedStepId}
                    onStepClick={handleStepClick}
                  />
                )}
              </div>
              <aside className="col-span-2 sticky top-0 h-screen overflow-y-auto bg-slate-900 border border-slate-800 rounded-lg">
                {selectedStep != null ? (
                  <StepDetailPanel step={selectedStep} />
                ) : (
                  <WorkflowDefaultPanel workflow={data.workflow} steps={data.steps} />
                )}
              </aside>
            </div>
          )
        })()}
      </main>

      {data.workflow.status === 'PENDING' && (
        <div className="fixed bottom-4 right-4">
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-full hover:bg-slate-700 transition-colors"
          >
            <RefreshCw size={12} />
            Refresh now
          </button>
        </div>
      )}
    </div>
  )
}
