import { useEffect, useRef, useState } from 'react'
import {
  Brain,
  Search,
  Clock,
  Wrench,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Step, LLMFunctionCallItem, LLMMessageItem } from '../lib/types'
import {
  getStepKind,
  humanizeStepName,
  formatDuration,
  parseSearchWebOutput,
  isLLMOutput,
  stepDurationMs,
} from '../lib/stepHelpers'

interface Props {
  step: Step
  index: number
  isActive: boolean
}

function CopyInline({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(text).catch(() => undefined)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="ml-1 inline-flex items-center p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}

function StepIcon({ functionName }: { functionName: string }) {
  const kind = getStepKind(functionName)
  const cls = 'shrink-0'
  if (kind === 'llm') return <Brain size={15} className={`${cls} text-slate-400`} />
  if (kind === 'sleep') return <Clock size={15} className={`${cls} text-slate-600`} />
  if (functionName === 'search_web') return <Search size={15} className={`${cls} text-emerald-400`} />
  return <Wrench size={15} className={`${cls} text-sky-400`} />
}

function StatusDot({ step }: { step: Step }) {
  if (step.error)
    return <XCircle size={14} className="text-red-400 shrink-0" />
  if (step.completed_at_epoch_ms == null)
    return <Loader2 size={14} className="text-amber-400 shrink-0 animate-spin" />
  return <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
}

function LLMStepBody({ step }: { step: Step }) {
  if (!isLLMOutput(step.output)) return null
  const { output: items, usage, response_id, model } = step.output

  return (
    <div className="space-y-3">
      {/* Metadata row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 font-mono bg-slate-800 rounded px-3 py-2">
        {model && <span className="text-slate-300">{model}</span>}
        <span>{usage.input_tokens.toLocaleString()} in</span>
        <span>{usage.output_tokens.toLocaleString()} out</span>
        <span className="text-slate-200 font-semibold">{usage.total_tokens.toLocaleString()} total</span>
        <span className="text-slate-500 ml-auto flex items-center">
          {response_id.slice(0, 28)}…
          <CopyInline text={response_id} />
        </span>
      </div>

      {/* Output items */}
      {items.map((item, i) => {
        if (item.type === 'function_call') {
          const fc = item as LLMFunctionCallItem
          let parsed: unknown = fc.arguments
          try {
            parsed = JSON.parse(fc.arguments)
          } catch {
            // leave as string
          }
          return (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-slate-500 mt-0.5 shrink-0">→</span>
              <span>
                <span className="text-slate-400">Requested </span>
                <code className="font-mono text-slate-300 text-xs bg-slate-800 px-1 py-0.5 rounded">
                  {fc.name}
                </code>
                <pre className="mt-1.5 text-xs bg-slate-800 rounded p-2 overflow-x-auto text-slate-300 font-mono leading-relaxed">
                  {typeof parsed === 'object'
                    ? JSON.stringify(parsed, null, 2)
                    : String(parsed)}
                </pre>
              </span>
            </div>
          )
        }

        if (item.type === 'message') {
          const msg = item as LLMMessageItem
          const text = msg.content?.[0]?.text
          if (!text) return null
          return (
            <div key={i}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Final Answer Generation
              </p>
              <div className="prose text-sm text-slate-300 max-w-none">
                <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
              </div>
            </div>
          )
        }

        return null
      })}
    </div>
  )
}

function SearchWebBody({ output }: { output: string }) {
  const results = parseSearchWebOutput(output)
  if (results.length === 0) {
    return <pre className="text-xs font-mono bg-slate-800 text-slate-300 rounded p-3 overflow-x-auto">{output}</pre>
  }
  return (
    <div className="space-y-3">
      {results.map((r, i) => (
        <div key={i} className="border border-slate-800 rounded-lg px-4 py-3 space-y-1">
          <p className="text-sm font-medium text-slate-200">{r.title}</p>
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-400 hover:text-amber-300 hover:underline block truncate"
          >
            {r.url}
          </a>
          <p className="text-xs text-slate-400 leading-relaxed">{r.summary}</p>
        </div>
      ))}
    </div>
  )
}

function OtherToolBody({ step }: { step: Step }) {
  const payload = {
    output: step.output,
    error: step.error,
  }
  return (
    <pre className="text-xs font-mono bg-slate-800 rounded p-3 overflow-x-auto text-slate-300 leading-relaxed">
      {JSON.stringify(payload, null, 2)}
    </pre>
  )
}

function SleepBody({ step }: { step: Step }) {
  const dur = stepDurationMs(step)
  return (
    <p className="text-sm text-slate-500 italic">
      Slept for {dur != null ? formatDuration(dur) : '…'}
    </p>
  )
}

function ExpandedBody({ step }: { step: Step }) {
  const kind = getStepKind(step.function_name)

  if (kind === 'llm') return <LLMStepBody step={step} />

  if (kind === 'sleep') return <SleepBody step={step} />

  if (step.function_name === 'search_web' && typeof step.output === 'string') {
    return <SearchWebBody output={step.output} />
  }

  return <OtherToolBody step={step} />
}

export function StepCard({ step, index, isActive }: Props) {
  const [expanded, setExpanded] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const prevActiveRef = useRef(false)

  useEffect(() => {
    if (isActive && !prevActiveRef.current) {
      setExpanded(true)
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    prevActiveRef.current = isActive
  }, [isActive])

  const dur = stepDurationMs(step)
  const kind = getStepKind(step.function_name)
  const isSleep = kind === 'sleep'
  const humanName = humanizeStepName(step.function_name)
  const hasError = !!step.error
  const inProgress = step.completed_at_epoch_ms == null

  return (
    <div
      ref={cardRef}
      className={`bg-slate-900 border rounded-lg overflow-hidden transition-shadow ${
        hasError
          ? 'border-red-500/50'
          : isActive
          ? 'border-slate-500 shadow-sm shadow-slate-700/50'
          : 'border-slate-800'
      }`}
    >
      {/* Header — always visible */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Step number */}
        <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 text-xs font-semibold flex items-center justify-center shrink-0">
          {index + 1}
        </span>

        <StepIcon functionName={step.function_name} />

        <span
          className={`flex-1 text-sm font-medium ${
            isSleep ? 'text-slate-500 text-xs' : 'text-slate-200'
          }`}
        >
          {humanName}
        </span>

        <StatusDot step={step} />

        {dur != null && (
          <span className="text-xs text-slate-500 font-mono shrink-0">{formatDuration(dur)}</span>
        )}
        {inProgress && (
          <span className="text-xs text-amber-400 font-mono shrink-0">running…</span>
        )}

        <span className="text-slate-600 shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {/* Error preview — visible when collapsed */}
      {hasError && !expanded && (
        <div className="px-4 pb-3 border-l-2 border-red-500/50 ml-4">
          <p className="text-xs text-red-400 font-mono leading-relaxed line-clamp-2">
            {step.error}
          </p>
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div
          className={`px-4 pb-4 border-t border-slate-800 pt-3 ${
            hasError ? 'border-l-2 border-l-red-500/50 ml-4' : ''
          }`}
        >
          {hasError && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-red-400 mb-1">Error</p>
              <pre className="text-xs font-mono text-red-300 bg-red-500/10 rounded p-2.5 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {step.error}
              </pre>
            </div>
          )}
          {!hasError && <ExpandedBody step={step} />}
        </div>
      )}
    </div>
  )
}
