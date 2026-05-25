import { parseSearchWebOutput } from '../../../../lib/stepHelpers'

interface Props {
  raw: string
}

// Renders search_web tool output as a list of {title, url, summary} cards.
// Falls back to the raw text when the output doesn't match the expected shape.
export function SearchWebResultsBlock({ raw }: Props) {
  const results = parseSearchWebOutput(raw)
  if (results.length === 0) {
    return (
      <pre className="bg-slate-950 border border-slate-800 rounded p-3 text-xs text-slate-300 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
        {raw}
      </pre>
    )
  }
  return (
    <div className="space-y-2">
      {results.map((r, i) => (
        <div key={i} className="bg-slate-950 border border-slate-800 rounded p-3 text-xs">
          <p className="text-slate-200 font-medium leading-snug">{r.title}</p>
          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:text-amber-300 underline break-all text-[11px] font-mono"
            >
              {r.url}
            </a>
          )}
          {r.summary && (
            <p className="text-slate-400 mt-1.5 leading-relaxed">{r.summary}</p>
          )}
        </div>
      ))}
    </div>
  )
}
