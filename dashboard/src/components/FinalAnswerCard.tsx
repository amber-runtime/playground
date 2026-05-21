import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Step, WorkflowStatus } from '../lib/types'
import { extractFinalAnswer } from '../lib/stepHelpers'

interface Props {
  steps: Step[]
  status: WorkflowStatus
}

export function FinalAnswerCard({ steps, status }: Props) {
  const answer = extractFinalAnswer(steps)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Final Answer
        </h2>
        {status === 'SUCCESS' && answer && (
          <span className="text-xs text-slate-500">Rendered as Markdown</span>
        )}
      </div>

      <div className="px-5 py-4">
        {status === 'PENDING' && !answer && (
          <Skeleton />
        )}
        {status === 'ERROR' && !answer && (
          <p className="text-sm text-red-400">
            Workflow ended in an error before producing a final answer.
          </p>
        )}
        {answer && (
          <div className="prose text-sm text-slate-300 max-w-none">
            <Markdown remarkPlugins={[remarkGfm]}>{answer}</Markdown>
          </div>
        )}
        {!answer && status !== 'PENDING' && status !== 'ERROR' && (
          <p className="text-sm text-slate-500 italic">No final answer found.</p>
        )}
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-slate-800 rounded w-3/4" />
      <div className="h-4 bg-slate-800 rounded w-full" />
      <div className="h-4 bg-slate-800 rounded w-5/6" />
      <div className="h-4 bg-slate-800 rounded w-2/3" />
      <div className="h-4 bg-slate-800 rounded w-full" />
      <p className="text-xs text-amber-400 pt-1 not-italic font-normal">Still running…</p>
    </div>
  )
}
