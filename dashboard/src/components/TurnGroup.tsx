import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Turn } from '../lib/types'
import { formatDuration, humanizeStepName, isLLMOutput } from '../lib/stepHelpers'
import { StepCard } from './StepCard'

interface Props {
  turn: Turn
  activeStepId: number | null
}

function PreflightBadge() {
  return (
    <span className="shrink-0 px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-400 ring-1 ring-slate-700">
      Pre-flight
    </span>
  )
}

function AgentBadge({ number }: { number: number }) {
  return (
    <span className="shrink-0 px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300 ring-1 ring-slate-700">
      Turn {number}
    </span>
  )
}

function FinalBadge() {
  return (
    <span className="shrink-0 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
      Final Answer
    </span>
  )
}

function ToolSummary({ toolSteps }: { toolSteps: Turn['toolSteps'] }) {
  if (toolSteps.length === 0) return null
  const counts: Record<string, number> = {}
  for (const s of toolSteps) {
    counts[s.function_name] = (counts[s.function_name] ?? 0) + 1
  }
  const parts = Object.entries(counts).map(([name, n]) => {
    const label = humanizeStepName(name)
    return n > 1 ? `${label} ×${n}` : label
  })
  return (
    <span className="text-xs text-slate-500 truncate">
      {parts.join(', ')}
    </span>
  )
}

function LLMStats({ turn }: { turn: Turn }) {
  if (!turn.llmStep || !isLLMOutput(turn.llmStep.output)) return null
  const { usage, model } = turn.llmStep.output
  return (
    <>
      {model && (
        <span className="text-xs text-slate-500 font-mono hidden sm:inline">{model}</span>
      )}
      <span className="text-xs text-slate-400 font-mono shrink-0">
        {usage.input_tokens.toLocaleString()}
        <span className="text-slate-700 mx-0.5">→</span>
        {usage.output_tokens.toLocaleString()}
        <span className="text-slate-500 ml-0.5">tok</span>
      </span>
    </>
  )
}

function turnContainsStep(turn: Turn, stepId: number | null): boolean {
  if (stepId == null) return false
  if (turn.llmStep?.function_id === stepId) return true
  return turn.toolSteps.some((s) => s.function_id === stepId)
}

const BORDER: Record<Turn['kind'], string> = {
  preflight: 'border-l-slate-600',
  agent: 'border-l-slate-500',
  final: 'border-l-emerald-500',
}

export function TurnGroup({ turn, activeStepId }: Props) {
  const defaultExpanded = turn.kind !== 'preflight'
  const [expanded, setExpanded] = useState(defaultExpanded)
  const prevContainedRef = useRef(false)

  const containsActive = turnContainsStep(turn, activeStepId)

  useEffect(() => {
    if (containsActive && !prevContainedRef.current) {
      setExpanded(true)
    }
    prevContainedRef.current = containsActive
  }, [containsActive])

  const allSteps = turn.llmStep
    ? [turn.llmStep, ...turn.toolSteps]
    : turn.toolSteps
  const hasRunning = allSteps.some((s) => s.completed_at_epoch_ms == null)
  const borderWidth = turn.kind === 'preflight' ? 'border-l-2' : 'border-l-[3px]'

  return (
    <div
      className={`${borderWidth} ${BORDER[turn.kind]} bg-slate-900 border border-slate-800 rounded-lg overflow-hidden`}
    >
      {/* Header */}
      <button
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
          expanded ? 'bg-slate-800/50' : 'bg-slate-900 hover:bg-slate-800/50'
        }`}
        onClick={() => setExpanded((v) => !v)}
      >
        {turn.kind === 'preflight' && <PreflightBadge />}
        {turn.kind === 'agent' && <AgentBadge number={turn.turnNumber} />}
        {turn.kind === 'final' && <FinalBadge />}

        <div className="flex-1 flex items-center gap-3 min-w-0 overflow-hidden">
          <LLMStats turn={turn} />
          <ToolSummary toolSteps={turn.toolSteps} />
        </div>

        {/* Right-side stats */}
        <div className="flex items-center gap-2 shrink-0">
          {turn.kind === 'preflight' && (
            <span className="text-xs text-slate-500">
              {allSteps.length} step{allSteps.length !== 1 ? 's' : ''}
            </span>
          )}
          {hasRunning ? (
            <span className="text-xs text-amber-400 font-medium">running…</span>
          ) : turn.totalDurationMs != null ? (
            <span className="text-xs text-slate-500 font-mono">
              {formatDuration(turn.totalDurationMs)}
            </span>
          ) : null}
          <span className="text-slate-600">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-3 pt-2 space-y-2">
          {turn.llmStep && (
            <StepCard
              step={turn.llmStep}
              index={turn.llmStep.function_id - 1}
              isActive={turn.llmStep.function_id === activeStepId}
            />
          )}

          {turn.toolSteps.map((step) => (
            <div key={step.function_id} className="ml-8">
              <StepCard
                step={step}
                index={step.function_id - 1}
                isActive={step.function_id === activeStepId}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
