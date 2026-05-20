import { useState } from 'react'
import type { Step, WorkflowInfo } from '../lib/types'
import { GanttStrip } from './GanttStrip'
import { StepCard } from './StepCard'

interface Props {
  workflow: WorkflowInfo
  steps: Step[]
}

export function StepTimeline({ workflow, steps }: Props) {
  const [activeStepId, setActiveStepId] = useState<number | null>(null)

  const workflowStart = workflow.created_at
  // For PENDING workflows, use the last known timestamp as the right edge
  const workflowEnd =
    workflow.updated_at > workflow.created_at
      ? workflow.updated_at
      : workflow.created_at +
        (steps[steps.length - 1]?.started_at_epoch_ms ?? workflow.created_at) -
        workflow.created_at +
        5000

  if (steps.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-5 py-8 text-center">
        <p className="text-sm text-gray-400">No steps recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <GanttStrip
        steps={steps}
        workflowStart={workflowStart}
        workflowEnd={workflowEnd}
        activeStepId={activeStepId}
        onStepClick={(id) => setActiveStepId((prev) => (prev === id ? null : id))}
      />

      <div className="space-y-2">
        {steps.map((step, idx) => (
          <StepCard
            key={step.function_id}
            step={step}
            index={idx}
            isActive={step.function_id === activeStepId}
          />
        ))}
      </div>
    </div>
  )
}
