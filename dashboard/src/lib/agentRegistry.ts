export type AgentDef = {
  id: string
  displayName: string
  inputLabel: string
  inputPlaceholder: string
}

export const AGENTS: AgentDef[] = [
  {
    id: 'research_agent',
    displayName: 'Research Agent',
    inputLabel: 'Topic',
    inputPlaceholder: 'vector database comparison 2026',
  },
  {
    id: 'research_handoff_agent',
    displayName: 'Research Agent with Handoff',
    inputLabel: 'Topic',
    inputPlaceholder: 'distributed consensus algorithms',
  },
  {
    id: 'weather_agent',
    displayName: 'Weather Agent',
    inputLabel: 'Location',
    inputPlaceholder: 'New York',
  },
]
