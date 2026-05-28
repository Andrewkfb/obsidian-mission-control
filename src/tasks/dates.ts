// Date helpers. All task dates are ISO yyyy-mm-dd strings (no time component),
// matching the Obsidian Tasks / Dataview convention.

/**
 * Returns "today" as an ISO yyyy-mm-dd string, honouring a configurable day-start
 * hour. Before `dayStartHour`, the date still counts as the previous day, so
 * late-night work stays on the Today pane.
 */
export function getToday(dayStartHour: number): string {
    const now = new Date()
    if (now.getHours() < dayStartHour) {
        now.setDate(now.getDate() - 1)
    }
    return toISO(now)
}

/** Local-time yyyy-mm-dd (avoids the UTC shift of Date.toISOString). */
export function toISO(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/** ISO date `offset` days after `iso`. Negative offsets go backwards. */
export function addDaysISO(iso: string, offset: number): string {
    const date = fromISO(iso)
    date.setDate(date.getDate() + offset)
    return toISO(date)
}

export function fromISO(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d)
}

/** Whole-day difference b - a (both ISO). Positive => b is later. */
export function daysBetween(aISO: string, bISO: string): number {
    const a = fromISO(aISO).getTime()
    const b = fromISO(bISO).getTime()
    return Math.round((b - a) / 86_400_000)
}

/** Human label for an ISO date relative to today (e.g. "Today", "Tomorrow", "Mon 2 Jun"). */
export function relativeLabel(iso: string, todayISO: string): string {
    const diff = daysBetween(todayISO, iso)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    if (diff === -1) return 'Yesterday'
    const date = fromISO(iso)
    const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
    const day = date.getDate()
    const month = date.toLocaleDateString(undefined, { month: 'short' })
    return `${weekday} ${day} ${month}`
}
