import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { AGENTS } from '../lib/agentRegistry'
import type { AgentDef } from '../lib/agentRegistry'

interface Props {
  onClose: () => void
  onSubmit: (agent: AgentDef, input: string) => void
}

export function NewWorkflowModal({ onClose, onSubmit }: Props) {
  const [selectedId, setSelectedId] = useState(AGENTS[0].id)
  const [input, setInput] = useState('')

  const agent = AGENTS.find((a) => a.id === selectedId) ?? AGENTS[0]

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = () => {
    if (!input.trim()) return
    onSubmit(agent, input.trim())
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-[480px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-50">New Workflow</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Agent dropdown */}
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1.5">Agent</label>
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value)
              setInput('')
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 cursor-pointer"
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic input — label and placeholder update when agent changes */}
        <div className="mb-6">
          <label className="block text-sm text-slate-400 mb-1.5">{agent.inputLabel}</label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
            placeholder={agent.inputPlaceholder}
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="px-4 py-2 text-sm bg-amber-500 text-slate-950 font-medium rounded-md hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Run
          </button>
        </div>
      </div>
    </div>
  )
}
