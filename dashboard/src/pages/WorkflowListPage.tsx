import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import type { WorkflowSummary, WorkflowStatus, WorkflowDetail } from '../lib/types'
import { useWorkflows } from '../lib/workflowContext'
import { runMockWorkflow } from '../lib/mockWorkflowRunner'
import { NewWorkflowButton } from '../components/NewWorkflowButton'
import { NewWorkflowModal } from '../components/NewWorkflowModal'
import { showToast } from '../components/Toast'
import type { AgentDef } from '../lib/agentRegistry'
import {
  humanizeWorkflowName,
  formatRelativeTime,
  formatDuration,
  extractWorkflowInputArg,
} from '../lib/stepHelpers'

// Render guard: button is visible in dev mode or when explicitly opted in via env var.
// This flag is evaluated at module load time — no runtime cost in production.
const SHOW_RUN_BUTTON =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_RUN_BUTTON === 'true'

type Filter = 'all' | 'completed' | 'running' | 'errored'

const FILTER_STATUS: Record<Filter, WorkflowStatus | null> = {
  all: null,
  completed: 'SUCCESS',
  running: 'PENDING',
  errored: 'ERROR',
}

const EMPTY_MESSAGES: Record<Filter, string> = {
  all: 'No workflows yet.',
  completed: 'No completed workflows.',
  running: 'No running workflows.',
  errored: 'No errored workflows.',
}

function StatusIcon({ status }: { status: WorkflowStatus }) {
  if (status === 'SUCCESS')
    return <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
  if (status === 'PENDING')
    return (
      <span className="relative flex h-3 w-3 shrink-0 mt-0.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
      </span>
    )
  if (status === 'ERROR')
    return <XCircle size={15} className="text-red-400 shrink-0" />
  return <span className="w-3.5 h-3.5 rounded-full bg-slate-600 shrink-0" />
}

function RecoveryPill({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
      Recovered {count}×
    </span>
  )
}

function workflowDuration(w: WorkflowSummary): string {
  if (w.status === 'PENDING') return 'running…'
  const ms = w.updated_at - w.created_at
  if (ms <= 0) return '—'
  return formatDuration(ms)
}

export function WorkflowListPage() {
  const navigate = useNavigate()
  const { workflows, prependWorkflow, updateSummary, setDetail } = useWorkflows()
  const [filter, setFilter] = useState<Filter>('all')
  const [modalOpen, setModalOpen] = useState(false)

  const counts = {
    all: workflows.length,
    completed: workflows.filter((w) => w.status === 'SUCCESS').length,
    running: workflows.filter((w) => w.status === 'PENDING').length,
    errored: workflows.filter((w) => w.status === 'ERROR').length,
  }

  const FILTER_LABELS: Record<Filter, string> = {
    all: `All (${counts.all})`,
    completed: `Completed (${counts.completed})`,
    running: `Running (${counts.running})`,
    errored: `Errored (${counts.errored})`,
  }

  const filtered = workflows.filter((w) => {
    const target = FILTER_STATUS[filter]
    return target === null || w.status === target
  })

  const handleNewWorkflow = (agent: AgentDef, topic: string) => {
    const id =
      '019e3d' +
      Math.random().toString(16).slice(2, 8) +
      '...' +
      Math.random().toString(16).slice(2, 6)
    const now = Date.now()
    const input = `{'args': ('${topic}',), 'kwargs': {}}`

    const summary: WorkflowSummary = {
      workflow_id: id,
      name: agent.id,
      status: 'PENDING',
      created_at: now,
      updated_at: now,
      recovery_attempts: null,
      step_count: 0,
      input,
    }

    const detail: WorkflowDetail = {
      workflow: {
        workflow_id: id,
        name: agent.id,
        status: 'PENDING',
        created_at: now,
        updated_at: now,
        recovery_attempts: null,
        input,
      },
      steps: [],
    }

    prependWorkflow(summary, detail)
    setModalOpen(false)
    showToast('Workflow started', `${id.slice(0, 8)}…${id.slice(-4)}`)
    runMockWorkflow(id, agent, topic, { updateSummary, setDetail })
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-amber-500 font-semibold tracking-tight text-xl">Amber</span>
            <span className="text-slate-700 select-none">·</span>
            <h1 className="text-xl font-semibold text-slate-50 tracking-tight">
              Workflows
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs font-medium">
              {counts.all}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {SHOW_RUN_BUTTON && (
              <NewWorkflowButton onClick={() => setModalOpen(true)} />
            )}
            <button
              className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-5">
        {/* Filter chips */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-amber-500 text-slate-950 font-medium'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              {EMPTY_MESSAGES[filter]}
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="pl-4 pr-2 py-2.5 w-8" />
                  <th className="pr-4 py-2.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Workflow
                  </th>
                  <th className="pr-4 py-2.5 text-right text-xs font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap">
                    Started
                  </th>
                  <th className="pr-4 py-2.5 text-right text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Duration
                  </th>
                  <th className="pr-4 py-2.5 text-right text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Steps
                  </th>
                  <th className="pr-4 py-2.5 text-right text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Recovery
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr
                    key={w.workflow_id}
                    onClick={() => navigate(`/workflows/${w.workflow_id}`)}
                    className="border-b last:border-b-0 border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="pl-4 pr-2 py-3.5">
                      <StatusIcon status={w.status} />
                    </td>
                    <td className="pr-4 py-3.5 max-w-xs">
                      <p className="text-sm font-medium text-slate-50 truncate">
                        {humanizeWorkflowName(w.name)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                        <span className="text-xs font-mono text-slate-500 shrink-0">
                          {w.workflow_id.slice(0, 8)}…{w.workflow_id.slice(-4)}
                        </span>
                        {w.input && (
                          <span className="text-xs text-slate-500 truncate">
                            · {extractWorkflowInputArg(w.input)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="pr-4 py-3.5 text-xs text-slate-300 whitespace-nowrap text-right">
                      {formatRelativeTime(w.created_at)}
                    </td>
                    <td className="pr-4 py-3.5 text-xs font-mono text-slate-300 text-right whitespace-nowrap">
                      {workflowDuration(w)}
                    </td>
                    <td className="pr-4 py-3.5 text-xs text-slate-300 text-right">
                      {w.step_count}
                    </td>
                    <td className="pr-4 py-3.5 text-right">
                      <RecoveryPill count={w.recovery_attempts ?? 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <NewWorkflowModal
          onClose={() => setModalOpen(false)}
          onSubmit={handleNewWorkflow}
        />
      )}
    </div>
  )
}
