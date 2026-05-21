import { extractWorkflowInputArg } from '../lib/stepHelpers'

interface Props {
  input: string | undefined
}

export function InputCard({ input }: Props) {
  const topic = extractWorkflowInputArg(input)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg px-5 py-3.5 flex items-baseline gap-3">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider shrink-0">
        Topic
      </span>
      <span className="text-slate-300 text-sm">{topic}</span>
    </div>
  )
}
