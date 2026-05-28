import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setPricing } from './pricingStore'
import {
  computeCostBreakdown,
  countLlmCalls,
  countToolCalls,
  findLargestRecoveryGap,
  formatCost,
  groupStepsByAgent,
  humanizeStepName,
  humanizeWorkflowName,
  sumTokens,
  sumTokensIn,
  sumTokensOut,
} from './stepHelpers'
import { makeStep, makeToolStep, makeWorkflow } from '../test/fixtures'

describe('stepHelpers', () => {
  beforeEach(() => {
    setPricing({}, null)
  })

  it('humanizes known and slugged names', () => {
    expect(humanizeStepName('_model_call_step')).toBe('Agent Turn')
    expect(humanizeStepName('search_public_sources')).toBe('Search Public Sources')
    expect(humanizeStepName(null)).toBe('Unknown')
    expect(humanizeWorkflowName('research-assistant')).toBe('Research Assistant')
    expect(humanizeWorkflowName('run_agent')).toBe('Research Agent')
  })

  it('sums tokens and counts llm/tool rows by event type', () => {
    const steps = [
      makeStep({ tokens_in: 10, tokens_out: 5 }),
      makeToolStep({ tokens_in: null, tokens_out: null }),
      makeStep({
        step_id: 3,
        event_type: 'step',
        function_name: 'search_web',
        tool_name: 'search_web',
        tokens_in: 7,
        tokens_out: null,
      }),
    ]

    expect(sumTokens(steps)).toBe(22)
    expect(sumTokensIn(steps)).toBe(17)
    expect(sumTokensOut(steps)).toBe(5)
    expect(countLlmCalls(steps)).toBe(1)
    expect(countToolCalls(steps)).toBe(1)
  })

  it('formats cost and includes unknown models in breakdown without pricing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    setPricing(
      {
        'gpt-4o-mini': {
          input: 0.00000015,
          output: 0.0000006,
          cache_read: null,
          cache_creation: null,
        },
      },
      null,
    )

    const breakdown = computeCostBreakdown([
      makeStep({ llm_model: 'gpt-4o-mini', tokens_in: 1_000, tokens_out: 500 }),
      makeStep({ step_id: 2, llm_model: 'unknown-model', tokens_in: 10, tokens_out: 10 }),
    ])

    expect(formatCost(null)).toBe('—')
    expect(formatCost(0.00045)).toBe('<$0.01')
    expect(formatCost(1.234)).toBe('$1.23')
    expect(breakdown).toEqual([
      expect.objectContaining({
        model: 'gpt-4o-mini',
        inputTokens: 1_000,
        outputTokens: 500,
        subtotal: 0.00045,
      }),
      expect.objectContaining({
        model: 'unknown-model',
        inputRate: null,
        subtotal: null,
      }),
    ])
    expect(warn).toHaveBeenCalledWith('No pricing entry for model: unknown-model')
  })

  it('groups steps by agent and attaches infrastructure after an agent starts', () => {
    const groups = groupStepsByAgent([
      makeStep({
        step_id: 1,
        agent_name: null,
        started_at_epoch_ms: 100,
        completed_at_epoch_ms: 200,
      }),
      makeStep({
        step_id: 2,
        agent_name: 'Planner',
        started_at_epoch_ms: 250,
        completed_at_epoch_ms: 300,
      }),
      makeStep({
        step_id: 3,
        agent_name: null,
        function_name: 'DBOS.sleep',
        started_at_epoch_ms: 325,
        completed_at_epoch_ms: 400,
      }),
      makeStep({
        step_id: 4,
        agent_name: 'Writer',
        started_at_epoch_ms: 500,
        completed_at_epoch_ms: 700,
      }),
    ])

    expect(groups).toHaveLength(3)
    expect(groups[0]).toEqual(expect.objectContaining({ agentName: null }))
    expect(groups[0].steps.map((s) => s.step_id)).toEqual([1])
    expect(groups[1]).toEqual(expect.objectContaining({ agentName: 'Planner' }))
    expect(groups[1].steps.map((s) => s.step_id)).toEqual([2, 3])
    expect(groups[2]).toEqual(expect.objectContaining({ agentName: 'Writer' }))
  })

  it('finds the largest recovery gap without treating overlapping work as idle', () => {
    const steps = [
      makeStep({ step_id: 1, started_at_epoch_ms: 0, completed_at_epoch_ms: 1_000 }),
      makeStep({ step_id: 2, started_at_epoch_ms: 500, completed_at_epoch_ms: 2_000 }),
      makeStep({ step_id: 3, started_at_epoch_ms: 3_500, completed_at_epoch_ms: 4_000 }),
      makeStep({ step_id: 4, started_at_epoch_ms: 6_500, completed_at_epoch_ms: 7_000 }),
    ]

    expect(findLargestRecoveryGap(steps)).toEqual({ start: 4_000, end: 6_500 })
  })

  it('accepts workflow fixtures with typed statuses', () => {
    expect(makeWorkflow({ status: 'ERROR' }).status).toBe('ERROR')
  })
})
