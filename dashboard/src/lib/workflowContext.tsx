import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { WorkflowSummary, WorkflowDetail } from './types'
import { mockWorkflowList } from './mockData'
import {
  mockWorkflowSuccess,
  mockWorkflowPending,
  mockWorkflowError,
} from './mockData'

interface WorkflowContextType {
  workflows: WorkflowSummary[]
  workflowDetails: Record<string, WorkflowDetail>
  prependWorkflow: (summary: WorkflowSummary, detail: WorkflowDetail) => void
  updateSummary: (id: string, patch: Partial<WorkflowSummary>) => void
  setDetail: (id: string, detail: WorkflowDetail) => void
}

const WorkflowContext = createContext<WorkflowContextType | null>(null)

const INITIAL_DETAILS: Record<string, WorkflowDetail> = {
  [mockWorkflowSuccess.workflow.workflow_id]: mockWorkflowSuccess,
  [mockWorkflowPending.workflow.workflow_id]: mockWorkflowPending,
  [mockWorkflowError.workflow.workflow_id]: mockWorkflowError,
}

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>(mockWorkflowList)
  const [workflowDetails, setWorkflowDetails] =
    useState<Record<string, WorkflowDetail>>(INITIAL_DETAILS)

  const prependWorkflow = (summary: WorkflowSummary, detail: WorkflowDetail) => {
    if (import.meta.env.DEV) {
      const id = summary.workflow_id
      const inList = workflows.some((w) => w.workflow_id === id)
      const inDetails = id in workflowDetails
      if (inList || inDetails) {
        console.warn(
          `[WorkflowContext] prependWorkflow: duplicate ID "${id}"` +
            ` (in list: ${inList}, in details: ${inDetails}) — skipping`,
        )
        return
      }
    }
    setWorkflows((prev) => [summary, ...prev])
    setWorkflowDetails((prev) => ({ ...prev, [summary.workflow_id]: detail }))
  }

  const updateSummary = (id: string, patch: Partial<WorkflowSummary>) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.workflow_id === id ? { ...w, ...patch } : w)),
    )
  }

  const setDetail = (id: string, detail: WorkflowDetail) => {
    setWorkflowDetails((prev) => ({ ...prev, [id]: detail }))
  }

  return (
    <WorkflowContext.Provider
      value={{ workflows, workflowDetails, prependWorkflow, updateSummary, setDetail }}
    >
      {children}
    </WorkflowContext.Provider>
  )
}

export function useWorkflows(): WorkflowContextType {
  const ctx = useContext(WorkflowContext)
  if (!ctx) throw new Error('useWorkflows must be used inside WorkflowProvider')
  return ctx
}
