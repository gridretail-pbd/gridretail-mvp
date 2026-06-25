// ═══════════════════════════════════════════════════════════════════════
// AI Service Layer — Cost Tracker
// Aggregates ai_tasks costs for the current month
// ═══════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────

export interface CostSummary {
  totalUsd: number
  budgetUsd: number
  usagePercent: number
  byModule: Record<string, number>
  byModel: Record<string, number>
  taskCount: number
  alertThresholdReached: boolean
}

// ─── Main Function ───────────────────────────────────────────────────

export async function getMonthlyCostSummary(
  supabase: SupabaseClient,
): Promise<CostSummary> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  // Get completed tasks this month
  const { data: tasks } = await supabase
    .from('ai_tasks')
    .select('modulo, modelo, costo_estimado_usd')
    .eq('status', 'COMPLETED')
    .gte('created_at', startOfMonth.toISOString())

  // Get budget config
  const { data: configRows } = await supabase
    .from('system_config')
    .select('key, value')
    .in('key', ['AI_MONTHLY_BUDGET_USD', 'AI_ALERT_THRESHOLD_PCT'])

  const config = Object.fromEntries(
    (configRows || []).map((r: { key: string; value: string }) => [r.key, r.value]),
  )

  const budgetUsd = parseFloat(config.AI_MONTHLY_BUDGET_USD || '25')
  const alertThreshold = parseInt(config.AI_ALERT_THRESHOLD_PCT || '80')

  const byModule: Record<string, number> = {}
  const byModel: Record<string, number> = {}
  let totalUsd = 0

  for (const task of tasks || []) {
    const cost = task.costo_estimado_usd || 0
    totalUsd += cost
    byModule[task.modulo] = (byModule[task.modulo] || 0) + cost
    byModel[task.modelo] = (byModel[task.modelo] || 0) + cost
  }

  const usagePercent = budgetUsd > 0 ? (totalUsd / budgetUsd) * 100 : 0

  return {
    totalUsd,
    budgetUsd,
    usagePercent,
    byModule,
    byModel,
    taskCount: tasks?.length || 0,
    alertThresholdReached: usagePercent >= alertThreshold,
  }
}
