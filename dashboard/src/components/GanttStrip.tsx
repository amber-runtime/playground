import type { Step } from '../lib/types'
import { getStepKind, humanizeStepName, formatDuration, stepDurationMs } from '../lib/stepHelpers'

interface Props {
  steps: Step[]
  workflowStart: number
  workflowEnd: number
  activeStepId: number | null
  onStepClick: (id: number) => void
}

const KIND_COLOR: Record<ReturnType<typeof getStepKind>, string> = {
  llm: 'bg-indigo-400 hover:bg-indigo-500',
  tool: 'bg-emerald-400 hover:bg-emerald-500',
  sleep: 'bg-gray-300 hover:bg-gray-400',
  other: 'bg-sky-400 hover:bg-sky-500',
}

const KIND_ACTIVE: Record<ReturnType<typeof getStepKind>, string> = {
  llm: 'bg-indigo-600',
  tool: 'bg-emerald-600',
  sleep: 'bg-gray-500',
  other: 'bg-sky-600',
}

const TICK_COUNT = 5

export function GanttStrip({ steps, workflowStart, workflowEnd, activeStepId, onStepClick }: Props) {
  const totalDuration = Math.max(workflowEnd - workflowStart, 1)

  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) =>
    Math.round((totalDuration * i) / TICK_COUNT),
  )

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Execution Timeline
        </h3>
      </div>

      <div className="px-4 pt-3 pb-4">
        {/* Tick labels */}
        <div className="relative h-4 mb-1">
          {ticks.map((ms) => {
            const pct = (ms / totalDuration) * 100
            return (
              <span
                key={ms}
                className="absolute text-[10px] text-gray-400 -translate-x-1/2"
                style={{ left: `${pct}%` }}
              >
                {ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`}
              </span>
            )
          })}
        </div>

        {/* Grid lines + bars */}
        <div className="relative" style={{ minHeight: `${steps.length * 36}px` }}>
          {/* Vertical grid lines */}
          {ticks.map((ms) => {
            const pct = (ms / totalDuration) * 100
            return (
              <div
                key={ms}
                className="absolute top-0 bottom-0 w-px bg-gray-100"
                style={{ left: `${pct}%` }}
              />
            )
          })}

          {/* Step rows */}
          {steps.map((step, idx) => {
            const kind = getStepKind(step.function_name)
            const isActive = step.function_id === activeStepId
            const hasError = !!step.error

            const leftPct =
              ((step.started_at_epoch_ms - workflowStart) / totalDuration) * 100

            const durMs =
              step.completed_at_epoch_ms != null
                ? step.completed_at_epoch_ms - step.started_at_epoch_ms
                : workflowEnd - step.started_at_epoch_ms

            const widthPct = Math.max((durMs / totalDuration) * 100, 0.5)

            const colorClass = hasError
              ? 'bg-red-400 hover:bg-red-500'
              : isActive
              ? KIND_ACTIVE[kind]
              : KIND_COLOR[kind]

            const label = humanizeStepName(step.function_name)
            const dur = stepDurationMs(step)
            const tooltip = `${label}${dur != null ? ` · ${formatDuration(dur)}` : ' · in progress'}`

            return (
              <div
                key={step.function_id}
                className="absolute flex items-center"
                style={{ top: `${idx * 36}px`, height: '28px', left: 0, right: 0 }}
              >
                <div
                  className="absolute group cursor-pointer rounded transition-colors"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%`, height: '100%' }}
                  onClick={() => onStepClick(step.function_id)}
                  title={tooltip}
                >
                  <div
                    className={`h-full w-full rounded transition-colors ${colorClass} ${
                      step.completed_at_epoch_ms == null ? 'opacity-60 animate-pulse' : ''
                    } ${isActive ? 'ring-2 ring-offset-1 ring-indigo-300' : ''}`}
                  />
                  {/* Tooltip on hover */}
                  <div className="hidden group-hover:block absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1.5 pointer-events-none">
                    <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                      {tooltip}
                    </div>
                    <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-2 border-t border-gray-100">
          {(['llm', 'tool', 'sleep'] as const).map((kind) => (
            <span key={kind} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-3 h-3 rounded ${KIND_COLOR[kind].split(' ')[0]}`} />
              {kind === 'llm' ? 'LLM call' : kind === 'tool' ? 'Tool call' : 'Sleep'}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-3 rounded bg-red-400" />
            Error
          </span>
        </div>
      </div>
    </div>
  )
}
