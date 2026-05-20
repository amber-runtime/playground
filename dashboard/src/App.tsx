import { useState } from 'react'
import type { WorkflowDetail } from './lib/types'
import {
  mockWorkflowSuccess,
  mockWorkflowPending,
  mockWorkflowError,
} from './lib/mockData'
import { WorkflowHeader } from './components/WorkflowHeader'
import { InputCard } from './components/InputCard'
import { FinalAnswerCard } from './components/FinalAnswerCard'
import { StepTimeline } from './components/StepTimeline'

// Swap this to any mock variant, or later replace with a real fetch.
const WORKFLOW_ID = '019e3c95-08de-7451-af78-01a1f83c43bb'

type Variant = 'success' | 'pending' | 'error'

const VARIANTS: Record<Variant, WorkflowDetail> = {
  success: mockWorkflowSuccess,
  pending: mockWorkflowPending,
  error: mockWorkflowError,
}

export default function App() {
  const [variant, setVariant] = useState<Variant>('success')
  const data = VARIANTS[variant]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <WorkflowHeader workflow={data.workflow} steps={data.steps} />

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {/* Workflow ID context (hidden — used by future fetch logic) */}
        <p className="hidden">{WORKFLOW_ID}</p>

        <InputCard input={data.workflow.input} />
        <FinalAnswerCard steps={data.steps} status={data.workflow.status} />
        <StepTimeline workflow={data.workflow} steps={data.steps} />
      </main>

      {/* Dev fixture switcher — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2.5 flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">Fixture</span>
          <select
            value={variant}
            onChange={(e) => setVariant(e.target.value as Variant)}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300 cursor-pointer"
          >
            <option value="success">SUCCESS</option>
            <option value="pending">PENDING</option>
            <option value="error">ERROR</option>
          </select>
        </div>
      </div>
    </div>
  )
}
