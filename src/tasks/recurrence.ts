import { addDaysISO, fromISO, toISO } from './dates'

/**
 * Given a 🔁 rule string and the reference date (usually the task's due/scheduled
 * date, or today if there is none), return the ISO date for the next occurrence.
 *
 * Supported patterns (case-insensitive):
 *   every day | daily
 *   every N days
 *   every week | weekly
 *   every N weeks
 *   every month | monthly
 *   every N months
 *   every weekday
 *   every year | yearly | annually
 *   every N years
 *
 * Returns undefined if the rule can't be parsed.
 */
export function computeNextDate(rule: string, fromISO_: string): string | undefined {
    const r = rule.trim().toLowerCase()

    // --- daily / every N days ---
    if (r === 'daily' || r === 'every day') return addDaysISO(fromISO_, 1)
    const daysMatch = r.match(/^every\s+(\d+)\s+days?$/)
    if (daysMatch) return addDaysISO(fromISO_, parseInt(daysMatch[1]))

    // --- weekly / every N weeks ---
    if (r === 'weekly' || r === 'every week') return addDaysISO(fromISO_, 7)
    const weeksMatch = r.match(/^every\s+(\d+)\s+weeks?$/)
    if (weeksMatch) return addDaysISO(fromISO_, parseInt(weeksMatch[1]) * 7)

    // --- monthly / every N months ---
    if (r === 'monthly' || r === 'every month') return addMonths(fromISO_, 1)
    const monthsMatch = r.match(/^every\s+(\d+)\s+months?$/)
    if (monthsMatch) return addMonths(fromISO_, parseInt(monthsMatch[1]))

    // --- yearly / every N years ---
    if (r === 'yearly' || r === 'annually' || r === 'every year') return addMonths(fromISO_, 12)
    const yearsMatch = r.match(/^every\s+(\d+)\s+years?$/)
    if (yearsMatch) return addMonths(fromISO_, parseInt(yearsMatch[1]) * 12)

    // --- every weekday (Mon-Fri) ---
    if (r === 'every weekday') return nextWeekday(fromISO_)

    return undefined
}

function addMonths(iso: string, n: number): string {
    const d = fromISO(iso)
    const targetMonth = d.getMonth() + n
    d.setMonth(targetMonth)
    // setMonth handles year rollovers, but can overflow into the next month
    // when the original day doesn't exist (e.g. Jan 31 + 1 month → Mar 3).
    // Clamp back to last day of the intended month.
    const intendedMonth = ((targetMonth % 12) + 12) % 12
    if (d.getMonth() !== intendedMonth) {
        d.setDate(0) // last day of the previous (intended) month
    }
    return toISO(d)
}

function nextWeekday(iso: string): string {
    const d = fromISO(iso)
    d.setDate(d.getDate() + 1)
    // 0 = Sunday, 6 = Saturday
    while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1)
    }
    return toISO(d)
}
