import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Step, SelectedStepId, AgentGroup, WorkflowInfo } from '../../../lib/types'
import {
  computeWorkflowWindow,
  filterStepsBySearch,
  groupStepsByAgent,
} from '../../../lib/stepHelpers'
import { AgentGroupSection } from './AgentGroupSection'
import { RecoveryGapBand } from './RecoveryGapBand'
import { StepListToolbar } from './StepListToolbar'
import { TimeAxis } from './TimeAxis'

interface Props {
  workflow: WorkflowInfo
  steps: Step[]
  selectedStepId: SelectedStepId
  onStepClick: (id: number) => void
}

const PREFLIGHT_KEY = '__preflight__'

function groupKey(group: AgentGroup): string {
  return group.agentName ?? PREFLIGHT_KEY
}

export function StepList({ workflow, steps, selectedStepId, onStepClick }: Props) {
  const groups = useMemo(() => groupStepsByAgent(steps), [steps])
  const window = useMemo(
    () => computeWorkflowWindow(workflow, steps),
    [workflow, steps],
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [expansion, setExpansion] = useState<Map<string, boolean>>(() => {
    const m = new Map<string, boolean>()
    for (const g of groups) m.set(groupKey(g), true)
    return m
  })

  // Add expansion entries for groups that appear later (e.g. during polling).
  useEffect(() => {
    setExpansion((prev) => {
      const seen = new Set<string>()
      let changed = false
      const next = new Map(prev)
      for (const g of groups) {
        const k = groupKey(g)
        seen.add(k)
        if (!next.has(k)) {
          next.set(k, true)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [groups])

  const matchingStepIds = useMemo(
    () => filterStepsBySearch(steps, searchQuery),
    [steps, searchQuery],
  )
  const searching = searchQuery.trim() !== ''

  // During search: filter steps inside groups and drop empty groups.
  // When not searching: pass groups through unchanged.
  const renderedGroups: AgentGroup[] = useMemo(() => {
    if (!searching) return groups
    return groups
      .map((g) => ({
        ...g,
        steps: g.steps.filter(
          (s) => s.step_id != null && matchingStepIds.has(s.step_id),
        ),
      }))
      .filter((g) => g.steps.length > 0)
  }, [groups, searching, matchingStepIds])

  const handleExpandAll = useCallback(() => {
    setExpansion(() => {
      const m = new Map<string, boolean>()
      for (const g of groups) m.set(groupKey(g), true)
      return m
    })
  }, [groups])

  const handleCollapseAll = useCallback(() => {
    setExpansion(() => {
      const m = new Map<string, boolean>()
      for (const g of groups) m.set(groupKey(g), false)
      return m
    })
  }, [groups])

  const handleGroupExpandChange = useCallback(
    (key: string, expanded: boolean) => {
      setExpansion((prev) => {
        const next = new Map(prev)
        next.set(key, expanded)
        return next
      })
    },
    [],
  )

  if (steps.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg px-5 py-8 text-center">
        <p className="text-sm text-slate-500">No steps recorded yet.</p>
      </div>
    )
  }

  return (
    <div>
      <StepListToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
      />

      {steps.length > 1 && <TimeAxis start={window.start} end={window.end} />}

      {renderedGroups.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg px-5 py-8 text-center">
          <p className="text-sm text-slate-500">
            No steps match &ldquo;{searchQuery}&rdquo;
          </p>
        </div>
      ) : (
        <div className="relative space-y-2">
          <RecoveryGapBand
            workflow={workflow}
            steps={steps}
            windowStart={window.start}
            windowEnd={window.end}
          />
          {renderedGroups.map((group, i) => {
            const key = groupKey(group)
            // During search, force expansion so matches are visible without
            // permanently clobbering the user's preferred state.
            const effectiveExpanded = searching ? true : expansion.get(key) ?? true
            return (
              <AgentGroupSection
                key={`${key}-${i}`}
                group={group}
                selectedStepId={selectedStepId}
                onStepClick={onStepClick}
                isExpanded={effectiveExpanded}
                onExpandChange={(exp) => handleGroupExpandChange(key, exp)}
                workflowStart={window.start}
                workflowEnd={window.end}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
