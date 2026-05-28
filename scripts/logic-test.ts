// Standalone smoke test for the Obsidian-free core logic.
// Run: node esbuild bundles this, then executes. See package.json "test:logic".
import { parseTasks, parseTaskLine } from '../src/tasks/TaskParser'
import { buildDashboard } from '../src/tasks/grouping'
import { getToday, addDaysISO } from '../src/tasks/dates'

let failures = 0
function assert(cond: boolean, msg: string) {
    if (!cond) { console.error('  ✗ ' + msg); failures++ }
    else console.log('  ✓ ' + msg)
}

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
    // Dataview inline fields fallback
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

console.log('\ndates:')
{
    // At 2am with dayStart=4, "today" should be yesterday — can't fake clock easily,
    // so just test the pure helpers.
    assert(addDaysISO('2026-05-28', 1) === '2026-05-29', 'addDaysISO +1')
    assert(addDaysISO('2026-03-01', -1) === '2026-02-28', 'addDaysISO across month boundary')
    assert(typeof getToday(4) === 'string' && getToday(4).length === 10, 'getToday returns ISO string')
}

console.log('\ngrouping:')
{
    const today = '2026-05-28'
    const mk = (over: Partial<ReturnType<typeof parseTaskLine>> & object, line = '- [ ] x') => {
        const base = parseTaskLine(line, 'A.md', 0, 'A')!
        return { ...base, ...over }
    }
    const tasks = [
        mk({ due: addDaysISO(today, -2) }),                       // overdue
        mk({ due: today }),                                       // due today
        mk({ scheduled: today }),                                 // scheduled today
        mk({ status: 'inProgress' as const }),                   // in progress, no date
        mk({ due: addDaysISO(today, 1) }),                       // tomorrow
        mk({ due: addDaysISO(today, 3) }),                       // next days
        mk({}),                                                   // unscheduled
        mk({ due: addDaysISO(today, 60) }),                      // beyond window -> dropped
    ]
    const d = buildDashboard(tasks as any, today, { upcomingDays: 7, showCompleted: false })
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
    // 7 in-scope tasks are open (the 60-day one is open but dropped from panes, still counts as project open)
    assert(d.projects[0].openCount === 8, 'project open count includes all open tasks')
}

console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
