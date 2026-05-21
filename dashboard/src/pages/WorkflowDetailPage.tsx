import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useWorkflows } from '../lib/workflowContext'
import { WorkflowHeader } from '../components/WorkflowHeader'
import { InputCard } from '../components/InputCard'
import { FinalAnswerCard } from '../components/FinalAnswerCard'
import { StepTimeline } from '../components/StepTimeline'

export function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { workflowDetails } = useWorkflows()
  const data = id ? workflowDetails[id] : null

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft size={14} />
            Workflows
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="text-sm text-slate-500">
            No detail data available for workflow{' '}
            <span className="font-mono text-slate-400">{id ?? '(unknown)'}</span>.
          </p>
          <button
            onClick={() => navigate('/')}
            className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to workflows
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Back nav */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={14} />
          Workflows
        </button>
      </div>

      <WorkflowHeader workflow={data.workflow} steps={data.steps} />

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        <InputCard input={data.workflow.input} />
        <FinalAnswerCard steps={data.steps} status={data.workflow.status} />
        <StepTimeline workflow={data.workflow} steps={data.steps} />
      </main>
    </div>
  )
}
