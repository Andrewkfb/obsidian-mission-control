// Standalone smoke test for the Obsidian-free core logic.
// Run: node -e "..." (see package.json "test:logic").

import { parseTasks, parseTaskLine } from '../src/tasks/TaskParser'
import { buildDashboard } from '../src/tasks/grouping'
import { getToday, addDaysISO } from '../src/tasks/dates'
import { applyToggleToLine, buildNextRecurrence } from '../src/tasks/TaskWriter'
import { computeNextDate } from '../src/tasks/recurrence'
import type { Task } from '../src/tasks/Task'

let failures = 0
function assert(cond: boolean, msg: string) {
    if (!cond) { console.error('  ✗ ' + msg); failures++ }
    else console.log('  ✓ ' + msg)
}

// ─── TaskParser ──────────────────────────────────────────────────────────────
console.log('TaskParser:')
{
    const t = parseTaskLine('- [ ] Write report 📅 2026-06-01 ⏫ #work/q2', 'Proj.md', 3, 'Proj')!
    assert(!!t, 'parses a basic task line')
    assert(t.due === '2026-06-01', 'extracts 📅 due date')
    assert(t.priority === 'high', 'extracts ⏫ high priority')
    assert(t.tags.includes('work/q2'), 'extracts nested tag')
    assert(t.status === 'open', 'open status for [ ]')
    assert(t.text === 'Write report', 'strips metadata from display text')
    assert(t.sourceLine === 3 && t.project === 'Proj', 'carries source location + project')
}
{
    const t = parseTaskLine('  - [x] done thing ✅ 2026-05-20 ➕ 2026-05-01', 'P.md', 0, 'P')!
    assert(t.status === 'done' && t.checked, 'done status for [x]')
    assert(t.done === '2026-05-20', 'extracts ✅ completion date')
    assert(t.created === '2026-05-01', 'extracts ➕ created date')
}
{
    const t = parseTaskLine('- [/] in progress task', 'P.md', 0, 'P')!
    assert(t.status === 'inProgress', '[/] => inProgress')
}
{
    const t = parseTaskLine('- [ ] dv task [due:: 2026-07-04] [priority:: high]', 'P.md', 0, 'P')!
    assert(t.due === '2026-07-04', 'dataview [due::] fallback')
    assert(t.priority === 'high', 'dataview [priority::] fallback')
}
{
    const t = parseTaskLine('- [ ] recurring 🔁 every week 📅 2026-06-10', 'P.md', 0, 'P')!
    assert(t.recurrence === 'every week', 'captures 🔁 recurrence text')
    assert(t.due === '2026-06-10', 'still extracts due alongside recurrence')
}
{
    assert(parseTaskLine('Just a paragraph.', 'P.md', 0, 'P') === null, 'non-task line returns null')
    assert(parseTaskLine('- a bullet, not a task', 'P.md', 0, 'P') === null, 'plain bullet returns null')
    const multi = parseTasks('- [ ] a\nsome text\n- [x] b', 'P.md', 'P')
    assert(multi.length === 2, 'parseTasks finds 2 tasks in mixed content')
}

// ─── dates ───────────────────────────────────────────────────────────────────
console.log('\ndates:')
{
    assert(addDaysISO('2026-05-28', 1) === '2026-05-29', 'addDaysISO +1')
    assert(addDaysISO('2026-03-01', -1) === '2026-02-28', 'addDaysISO across month boundary')
    assert(typeof getToday(4) === 'string' && getToday(4).length === 10, 'getToday returns ISO string')
}

// ─── grouping ────────────────────────────────────────────────────────────────
console.log('\ngrouping:')
{
    const today = '2026-05-28'
    const mk = (over: Partial<Task>, line = '- [ ] x') => {
        const base = parseTaskLine(line, 'A.md', 0, 'A')!
        return { ...base, ...over } as Task
    }
    const taskList = [
        mk({ due: addDaysISO(today, -2) }),
        mk({ due: today }),
        mk({ scheduled: today }),
        mk({ status: 'inProgress' as const }),
        mk({ due: addDaysISO(today, 1) }),
        mk({ due: addDaysISO(today, 3) }),
        mk({}),
        mk({ due: addDaysISO(today, 60) }),
    ]
    const d = buildDashboard(taskList, today, { upcomingDays: 7, showCompleted: false })
    const todayKeys = d.today.map(g => g.key)
    assert(todayKeys.includes('overdue'), 'today has overdue group')
    assert(todayKeys.includes('dueToday'), 'today has dueToday group')
    assert(todayKeys.includes('scheduledToday'), 'today has scheduledToday group')
    assert(todayKeys.includes('inProgress'), 'today has inProgress group')
    const upKeys = d.upcoming.map(g => g.key)
    assert(upKeys.includes('tomorrow'), 'upcoming has tomorrow group')
    assert(upKeys.includes('nextDays'), 'upcoming has nextDays group')
    assert(upKeys.includes('unscheduled'), 'upcoming has unscheduled group')
    assert(d.projects.length === 1 && d.projects[0].project === 'A', 'projects rolled up by file')
    assert(d.projects[0].openCount === 8, 'project open count includes all open tasks')
}

// ─── TaskWriter: applyToggleToLine ───────────────────────────────────────────
console.log('\nTaskWriter (applyToggleToLine):')
{
    const openLine   = '- [ ] Buy groceries 📅 2026-06-01'
    const doneLine   = '- [x] Buy groceries 📅 2026-06-01 ✅ 2026-05-28'
    const indented   = '  - [ ] Indented task'
    const nocheckbox = 'Just a paragraph.'

    const completed = applyToggleToLine(openLine, true, '2026-05-28')
    assert(completed.includes('[x]'), 'toggle open→done: status becomes [x]')
    assert(completed.includes('✅ 2026-05-28'), 'toggle open→done: ✅ date appended')
    assert((completed.match(/✅/g) ?? []).length === 1, 'toggle open→done: only one ✅ date')

    const reopened = applyToggleToLine(doneLine, false, '2026-05-28')
    assert(reopened.includes('[ ]'), 'toggle done→open: status becomes [ ]')
    assert(!reopened.includes('✅'), 'toggle done→open: ✅ date stripped')

    const completedAgain = applyToggleToLine(doneLine, true, '2026-06-01')
    assert((completedAgain.match(/✅/g) ?? []).length === 1, 'completing already-done: exactly one ✅')

    assert(applyToggleToLine(nocheckbox, true, '2026-05-28') === nocheckbox, 'non-task line returned unchanged')
    assert(applyToggleToLine(indented, true, '2026-05-28').includes('[x]'), 'indented task toggles correctly')
}

// ─── recurrence: computeNextDate ─────────────────────────────────────────────
console.log('\nrecurrence (computeNextDate):')
{
    assert(computeNextDate('every day',    '2026-05-28') === '2026-05-29', 'every day +1')
    assert(computeNextDate('daily',        '2026-05-28') === '2026-05-29', 'daily +1')
    assert(computeNextDate('every 3 days', '2026-05-28') === '2026-05-31', 'every 3 days')
    assert(computeNextDate('every week',   '2026-05-28') === '2026-06-04', 'every week')
    assert(computeNextDate('every 2 weeks','2026-05-28') === '2026-06-11', 'every 2 weeks')
    assert(computeNextDate('every month',  '2026-01-31') === '2026-02-28', 'every month: Jan 31 → Feb 28 (no overflow)')
    assert(computeNextDate('every month',  '2026-05-01') === '2026-06-01', 'every month: normal case')
    assert(computeNextDate('every 3 months','2026-01-15') === '2026-04-15', 'every 3 months')
    assert(computeNextDate('every year',   '2026-05-28') === '2027-05-28', 'every year')
    assert(computeNextDate('every weekday','2026-05-28') === '2026-05-29', 'every weekday: Thu→Fri')
    assert(computeNextDate('every weekday','2026-05-29') === '2026-06-01', 'every weekday: Fri→Mon (skips weekend)')
    assert(computeNextDate('banana',       '2026-05-28') === undefined,    'unknown rule returns undefined')
}

// ─── TaskWriter: buildNextRecurrence ─────────────────────────────────────────
console.log('\nTaskWriter (buildNextRecurrence):')
{
    const base: Task = {
        sourcePath: 'P.md', sourceLine: 0,
        rawText: '- [ ] Stand-up 🔁 every day 📅 2026-05-28',
        text: 'Stand-up', status: 'open', statusChar: ' ', checked: false,
        priority: 'normal', tags: [], project: 'P',
        recurrence: 'every day', due: '2026-05-28',
    }
    const next = buildNextRecurrence(base.rawText, base, '2026-05-28')
    assert(!!next, 'buildNextRecurrence returns a line')
    assert(next!.includes('[ ]'), 'next recurrence line is open')
    assert(next!.includes('📅 2026-05-29'), 'next recurrence: due date advanced by 1 day')
    assert(!next!.includes('✅'), 'next recurrence: no completion stamp')

    const unknown = buildNextRecurrence('- [ ] x 🔁 banana', { ...base, recurrence: 'banana' }, '2026-05-28')
    assert(unknown === undefined, 'unknown recurrence rule: returns undefined gracefully')
}

console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
