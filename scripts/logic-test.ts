// Standalone smoke test for the Obsidian-free core logic.
// Run: node -e "..." (see package.json "test:logic").

import { parseTasks, parseTaskLine } from '../src/tasks/TaskParser'
import { buildDashboard } from '../src/tasks/grouping'
import { getToday, addDaysISO, msUntilNextDayStart } from '../src/tasks/dates'
import { applyToggleToLine, buildNextRecurrence, resolveTaskLine, toggleComplete, buildTaskLine, appendTaskLine, createTask } from '../src/tasks/TaskWriter'
import { isInFolder, isDirectChildOf } from '../src/utils/paths'
import { tagMatches, taskMatchesTags } from '../src/tasks/tags'
import { mergeTabAdditions } from '../src/utils/tabs'
import type { Vault } from 'obsidian'
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
    const t = parseTaskLine('- [ ] medium priority 🔼', 'P.md', 0, 'P')!
    assert(t.priority === 'medium', 'extracts 🔼 medium priority')
}
{
    // Two markers on one line: the strongest wins, and both are stripped.
    const t = parseTaskLine('- [ ] conflicting 🔺 ⏬', 'P.md', 0, 'P')!
    assert(t.priority === 'highest', 'multiple priority markers: highest wins')
    assert(t.text === 'conflicting', 'multiple priority markers: all stripped from text')

    const reversed = parseTaskLine('- [ ] conflicting ⏬ 🔺', 'P.md', 0, 'P')!
    assert(reversed.priority === 'highest', 'multiple priority markers: order on the line is irrelevant')
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

// ─── utils/paths ─────────────────────────────────────────────────────────────
// These gate whether a vault event refreshes a pane, so a wrong answer means a
// pane silently stops updating.
console.log('\nutils/paths:')
{
    assert(isInFolder('Work/Tasks/a.md', 'Work') === true, 'isInFolder: nested file is in scope')
    assert(isInFolder('Work/a.md', 'Work') === true, 'isInFolder: direct child is in scope')
    assert(isInFolder('Work', 'Work') === true, 'isInFolder: the folder itself is in scope')
    assert(isInFolder('Personal/a.md', 'Work') === false, 'isInFolder: a sibling folder is out of scope')
    // The prefix bug: "Work" must not swallow "Workshop".
    assert(isInFolder('Workshop/a.md', 'Work') === false, 'isInFolder: a name-prefixed sibling is out of scope')
    assert(isInFolder('a.md', '') === false, 'isInFolder: an unconfigured folder matches nothing')

    assert(isDirectChildOf('Inbox/a.md', 'Inbox') === true, 'isDirectChildOf: direct child matches')
    assert(isDirectChildOf('Inbox/sub/a.md', 'Inbox') === false, 'isDirectChildOf: grandchild does not match')
    assert(isDirectChildOf('Inbox/sub/a.md', 'Inbox/sub') === true, 'isDirectChildOf: nested folder matches its own children')
    assert(isDirectChildOf('Inbox Archive/a.md', 'Inbox') === false, 'isDirectChildOf: a name-prefixed sibling does not match')
    assert(isDirectChildOf('a.md', 'Inbox') === false, 'isDirectChildOf: a vault-root file does not match')
    assert(isDirectChildOf('a.md', '') === false, 'isDirectChildOf: an unconfigured folder matches nothing')
}

// ─── dates ───────────────────────────────────────────────────────────────────
console.log('\ndates:')
{
    assert(addDaysISO('2026-05-28', 1) === '2026-05-29', 'addDaysISO +1')
    assert(addDaysISO('2026-03-01', -1) === '2026-02-28', 'addDaysISO across month boundary')
    assert(typeof getToday(4) === 'string' && getToday(4).length === 10, 'getToday returns ISO string')

    // Day-start boundary: 2am with a 4am start still counts as the previous day.
    const lateNight = new Date(2026, 4, 28, 2, 30)
    const morning = new Date(2026, 4, 28, 9, 0)
    assert(getToday(4, lateNight) === '2026-05-27', 'getToday: before dayStartHour => previous day')
    assert(getToday(4, morning) === '2026-05-28', 'getToday: after dayStartHour => current day')
    assert(getToday(0, lateNight) === '2026-05-28', 'getToday: dayStartHour 0 => calendar day')
}

// ─── dates: rollover scheduling ──────────────────────────────────────────────
console.log('\ndates (msUntilNextDayStart):')
{
    const HOUR = 3_600_000
    // 02:30 with a 4am start: the boundary is 90 minutes away, later today.
    assert(msUntilNextDayStart(4, new Date(2026, 4, 28, 2, 30)) === 1.5 * HOUR, 'boundary later today')
    // 09:00 with a 4am start: today's boundary has passed, so wait for tomorrow.
    assert(msUntilNextDayStart(4, new Date(2026, 4, 28, 9, 0)) === 19 * HOUR, 'boundary rolls to tomorrow')
    // Exactly on the boundary counts as passed — getToday already returns the new day.
    assert(msUntilNextDayStart(4, new Date(2026, 4, 28, 4, 0)) === 24 * HOUR, 'exactly on the boundary waits a full day')
    assert(msUntilNextDayStart(0, new Date(2026, 4, 28, 23, 0)) === 1 * HOUR, 'midnight start from 23:00')
    assert(msUntilNextDayStart(4, new Date(2026, 4, 28, 3, 59, 59)) === 1000, 'sub-minute delay stays positive')
}

// ─── grouping ────────────────────────────────────────────────────────────────
console.log('\ngrouping:')
{
    const today = '2026-05-28'
    const mk = (over: Partial<Task>, line = '- [ ] x') => {
        const base = parseTaskLine(line, 'A.md', 0, 'A')!
        return { ...base, ...over }
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
    const d = buildDashboard(taskList, today, { upcomingDays: 7, showCompleted: false, completedDays: 7 })
    const todayKeys = d.today.map(g => g.key)
    assert(todayKeys.includes('overdue'), 'today has overdue group')
    assert(todayKeys.includes('dueToday'), 'today has dueToday group')
    assert(todayKeys.includes('scheduled'), 'today has scheduled group')
    assert(todayKeys.includes('inProgress'), 'today has inProgress group')
    const upKeys = d.upcoming.map(g => g.key)
    assert(upKeys.includes('tomorrow'), 'upcoming has tomorrow group')
    assert(upKeys.includes('nextDays'), 'upcoming has nextDays group')
    assert(!upKeys.includes('unscheduled'), 'upcoming no longer surfaces dateless tasks')
    assert(d.projects.length === 1 && d.projects[0].project === 'A', 'projects rolled up by file')
    assert(d.projects[0].openCount === 8, 'project open count includes all open tasks')

    const completed = mk({ status: 'done', checked: true, due: today }, '- [x] done today')
    const withCompleted = buildDashboard([...taskList, completed], today, { upcomingDays: 7, showCompleted: true, completedDays: 7 })
    assert(withCompleted.today.find(g => g.key === 'dueToday')?.tasks.includes(completed) ?? false, 'show completed includes dated completed tasks')

    const recurring = mk({ recurrence: 'every week', due: today })
    const recurringDashboard = buildDashboard([recurring], today, { upcomingDays: 7, showCompleted: false, completedDays: 7 })
    assert(recurringDashboard.recurring[0]?.nextDate === addDaysISO(today, 7), 'recurring dashboard computes next occurrence')

    // --- backlog ---
    const backlogKeys = d.backlog.map(g => g.key)
    assert(backlogKeys.includes('noDate'), 'backlog has noDate group')
    assert(backlogKeys.includes('later'), 'backlog has later group')
    // Guarded lookups, not `!`: a missing group should fail its own assertion
    // rather than throw and take every later test down with it.
    const noDateGroup = d.backlog.find(g => g.key === 'noDate')
    assert(noDateGroup?.tasks.length === 1, 'backlog noDate holds the undated task')
    const laterGroup = d.backlog.find(g => g.key === 'later')
    assert(laterGroup?.tasks.length === 1, 'backlog later holds the task beyond the window')
    // An undated in-progress task belongs on Today, not in the backlog.
    assert(!(noDateGroup?.tasks ?? []).some(t => t.status === 'inProgress'), 'in-progress tasks stay on Today rather than the backlog')

    // A task scheduled in the past with no due date used to match no bucket at
    // all and disappear from every pane.
    {
        const pastScheduled = mk({ scheduled: addDaysISO(today, -5) })
        const dd = buildDashboard([pastScheduled], today, { upcomingDays: 7, showCompleted: false, completedDays: 7 })
        const scheduled = dd.today.find(g => g.key === 'scheduled')
        assert(scheduled?.tasks.includes(pastScheduled) ?? false, 'a past scheduled date surfaces on Today')
    }

    // The invariant the backlog exists to guarantee: every open task shows up in
    // exactly one place. Regression guard for any future bucketing change.
    {
        const everyShape = [
            mk({ due: addDaysISO(today, -2) }),
            mk({ due: today }),
            mk({ scheduled: today }),
            mk({ scheduled: addDaysISO(today, -9) }),
            mk({ status: 'inProgress' as const }),
            mk({ due: addDaysISO(today, 1) }),
            mk({ due: addDaysISO(today, 3) }),
            mk({ scheduled: addDaysISO(today, 4) }),
            mk({}),
            mk({ due: addDaysISO(today, 60) }),
            mk({ scheduled: addDaysISO(today, 400) }),
            mk({ due: addDaysISO(today, 2), scheduled: addDaysISO(today, -3) }),
        ]
        const full = buildDashboard(everyShape, today, { upcomingDays: 7, showCompleted: false, completedDays: 7 })
        const placements = new Map<Task, number>()
        for (const pane of [full.today, full.upcoming, full.backlog]) {
            for (const g of pane) for (const t of g.tasks) placements.set(t, (placements.get(t) ?? 0) + 1)
        }
        const missing = everyShape.filter(t => !placements.has(t))
        const duplicated = everyShape.filter(t => (placements.get(t) ?? 0) > 1)
        assert(missing.length === 0, `every open task lands in a pane (${missing.length} missing)`)
        assert(duplicated.length === 0, `no open task is double-counted (${duplicated.length} duplicated)`)
    }
}

// ─── grouping: completed ─────────────────────────────────────────────────────
console.log('\ngrouping (completed):')
{
    const today = '2026-05-28'
    const done = (doneISO: string | undefined, text = 'x') => {
        const t = parseTaskLine(`- [x] ${text}`, 'A.md', 0, 'A')!
        return { ...t, done: doneISO }
    }
    const list = [
        done(today, 'finished today'),
        done(addDaysISO(today, -1), 'finished yesterday'),
        done(addDaysISO(today, -3), 'finished earlier'),
        done(addDaysISO(today, -60), 'ancient history'),
        done(undefined, 'no completion stamp'),
        done(addDaysISO(today, 5), 'future stamp'),
    ]
    const d = buildDashboard(list, today, { upcomingDays: 7, showCompleted: false, completedDays: 7 })
    const keys = d.completed.map(g => g.key)
    assert(keys.includes('doneToday'), 'completed has a Today group')
    assert(keys.includes('doneYesterday'), 'completed has a Yesterday group')
    assert(keys.includes('doneEarlier'), 'completed has an Earlier group')

    const all = d.completed.flatMap(g => g.tasks.map(t => t.text))
    assert(all.includes('finished today'), 'completed includes work done today')
    assert(all.includes('finished earlier'), 'completed includes work inside the window')
    assert(!all.includes('ancient history'), 'completed drops work older than the window')
    assert(!all.includes('no completion stamp'), 'completed drops tasks with no ✅ date')
    assert(!all.includes('future stamp'), 'completed drops future-dated completions')

    // The Done tab is a review surface, so it must not depend on the setting that
    // controls whether completed work also shows in the Today/Upcoming panes.
    const hidden = buildDashboard(list, today, { upcomingDays: 7, showCompleted: false, completedDays: 7 })
    const shown = buildDashboard(list, today, { upcomingDays: 7, showCompleted: true, completedDays: 7 })
    assert(hidden.completed.length === shown.completed.length, 'completed ignores the showCompleted setting')

    const ordered = buildDashboard(
        [done(addDaysISO(today, -2), 'older'), done(today, 'newer')],
        today, { upcomingDays: 7, showCompleted: false, completedDays: 7 })
    // Guarded, not indexed blindly: a missing group should fail this assertion
    // rather than throw and hide every test that follows.
    assert(ordered.completed[0]?.tasks[0]?.text === 'newer', 'completed groups run newest first')
}

// ─── TaskWriter: creating tasks ──────────────────────────────────────────────
console.log('\nTaskWriter (buildTaskLine / appendTaskLine):')
{
    assert(buildTaskLine('Write notes') === '- [ ] Write notes', 'plain text becomes an open task')
    assert(buildTaskLine('  padded  ') === '- [ ] padded', 'surrounding whitespace is trimmed')
    assert(buildTaskLine('') === undefined, 'empty input produces nothing')
    assert(buildTaskLine('   ') === undefined, 'whitespace-only input produces nothing')
    // Metadata is carried verbatim, so whatever the parser reads, quick-add writes.
    const rich = buildTaskLine('Ship it 📅 2026-06-01 ⏫ #release')!
    assert(rich === '- [ ] Ship it 📅 2026-06-01 ⏫ #release', 'metadata is preserved verbatim')
    const round = parseTaskLine(rich, 'P.md', 0, 'P')!
    assert(round.due === '2026-06-01' && round.priority === 'high' && round.tags.includes('release'),
        'a created line round-trips through the parser')
    // Pasting a whole task line should not produce a double checkbox.
    assert(buildTaskLine('- [ ] Already a task') === '- [ ] Already a task', 'a pasted open task is accepted as-is')
    assert(buildTaskLine('- [x] Done elsewhere') === '- [ ] Done elsewhere', 'a pasted completed task is reopened')

    assert(appendTaskLine('', '- [ ] a') === '- [ ] a\n', 'appending to an empty note')
    assert(appendTaskLine('# Notes', '- [ ] a') === '# Notes\n- [ ] a\n', 'appending after content')
    assert(appendTaskLine('# Notes\n\n\n', '- [ ] a') === '# Notes\n- [ ] a\n', 'trailing blank lines are collapsed')
    assert(appendTaskLine('- [ ] first\n', '- [ ] b') === '- [ ] first\n- [ ] b\n', 'appending after an existing task')
}

// ─── tasks/tags ──────────────────────────────────────────────────────────────
console.log('\ntasks/tags:')
{
    const mkTagged = (tags: string[]): Task => ({ ...parseTaskLine('- [ ] x', 'A.md', 0, 'A')!, tags })

    assert(tagMatches('work', 'work') === true, 'tagMatches: exact')
    assert(tagMatches('work/q2', 'work') === true, 'tagMatches: nested child matches its parent')
    assert(tagMatches('work', 'work/q2') === false, 'tagMatches: parent does not match a child selection')
    assert(tagMatches('workshop', 'work') === false, 'tagMatches: a name-prefixed sibling does not match')

    assert(taskMatchesTags(mkTagged([]), [], undefined) === true, 'no selection matches everything')
    assert(taskMatchesTags(mkTagged(['errand']), ['errand'], undefined) === true, 'matches a tag on the task line')
    // The gap this closes: previously only note-level tags were consulted, so a
    // tag written on the task itself could never be filtered on.
    assert(taskMatchesTags(mkTagged(['errand']), ['errand'], new Set()) === true, 'task-line tag matches even when the note has no tags')
    assert(taskMatchesTags(mkTagged([]), ['proj'], new Set(['proj'])) === true, 'matches a note-level tag')
    assert(taskMatchesTags(mkTagged(['a']), ['b'], new Set(['c'])) === false, 'no overlap does not match')
    assert(taskMatchesTags(mkTagged(['work/q2']), ['work'], undefined) === true, 'selecting a parent tag matches a nested task tag')
    assert(taskMatchesTags(mkTagged(['a']), ['b', 'a'], undefined) === true, 'OR semantics across the selection')
}

// ─── settings: mergeTabAdditions ─────────────────────────────────────────────
console.log('\nsettings (mergeTabAdditions):')
{
    // Fresh install: take the defaults, and record the additions as handled.
    const DEFAULT_TABS = ['today', 'upcoming', 'backlog', 'projects']
    const fresh = mergeTabAdditions(undefined, undefined, DEFAULT_TABS, ['backlog'])
    assert(fresh.activeTabs.includes('backlog'), 'fresh install gets the new tab')
    assert(fresh.mergedTabAdditions.includes('backlog'), 'fresh install records the addition as merged')

    // Upgrade: a saved list predating the tab gets it appended.
    const upgraded = mergeTabAdditions(['today', 'upcoming'], undefined, DEFAULT_TABS, ['backlog'])
    assert(upgraded.activeTabs.join() === 'today,upcoming,backlog', 'upgrade appends the new tab to a saved list')
    assert(upgraded.mergedTabAdditions.includes('backlog'), 'upgrade records the merge')

    // Having merged once, a user turning the tab off must not have it re-added.
    const optedOut = mergeTabAdditions(['today', 'upcoming'], ['backlog'], DEFAULT_TABS, ['backlog'])
    assert(!optedOut.activeTabs.includes('backlog'), 'a deliberately disabled tab is not re-added')

    // A second addition must reach installs that already merged the first one.
    const twoAdditions = mergeTabAdditions(['today', 'backlog'], ['backlog'], DEFAULT_TABS, ['backlog', 'done'])
    assert(twoAdditions.activeTabs.includes('done'), 'a later addition is merged in on its own')
    assert(twoAdditions.activeTabs.filter(t => t === 'backlog').length === 1, 'an already-merged addition is not duplicated')
    assert(twoAdditions.mergedTabAdditions.includes('done'), 'the later addition is recorded as merged')

    // Re-running the merge without an intervening save is idempotent.
    const again = mergeTabAdditions(upgraded.activeTabs, upgraded.mergedTabAdditions, DEFAULT_TABS, ['backlog'])
    assert(again.activeTabs.filter(t => t === 'backlog').length === 1, 'merging twice does not duplicate the tab')
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

// ─── TaskWriter: resolveTaskLine ─────────────────────────────────────────────
console.log('\nTaskWriter (resolveTaskLine):')
{
    const mkTask = (raw: string, line: number): Task => ({
        ...parseTaskLine(raw, 'P.md', line, 'P')!,
        rawText: raw,
        sourceLine: line,
    })

    const alpha = '- [ ] Alpha 📅 2026-06-01'
    const beta  = '- [ ] Beta 📅 2026-06-02'
    const gamma = '- [ ] Gamma 📅 2026-06-03'

    {
        const lines = ['# Heading', alpha, beta, gamma]
        assert(resolveTaskLine(lines, mkTask(beta, 2)) === 2, 'exact hit at the recorded line')
    }
    {
        // A recurrence splice above Beta pushed everything below down by one.
        const lines = ['# Heading', alpha, '- [ ] Alpha 📅 2026-06-08', beta, gamma]
        assert(resolveTaskLine(lines, mkTask(beta, 2)) === 3, 'follows a task shifted down by an insert')
    }
    {
        const lines = ['# Heading', beta, gamma]
        assert(resolveTaskLine(lines, mkTask(beta, 2)) === 1, 'follows a task shifted up by a deletion')
    }
    {
        // The stale-index case that used to corrupt the wrong task: the recorded
        // line holds a *different* task, so there must be no match at all.
        const lines = ['# Heading', alpha, gamma]
        assert(resolveTaskLine(lines, mkTask(beta, 2)) === undefined, 'refuses when the task is gone, even though a task occupies the line')
    }
    {
        const lines = ['# Heading', alpha, '- [ ] Beta rewritten by the user', gamma]
        assert(resolveTaskLine(lines, mkTask(beta, 2)) === undefined, 'refuses when the line text was edited')
    }
    {
        const lines = [alpha, beta, gamma]
        assert(resolveTaskLine(lines, mkTask(beta, 99)) === undefined, 'refuses when the recorded line is far out of range')
    }
    {
        // Duplicate identical lines: pick the one nearest the recorded index.
        const lines = [beta, beta, beta]
        assert(resolveTaskLine(lines, mkTask(beta, 2)) === 2, 'duplicate lines: exact index wins')
        assert(resolveTaskLine(lines, mkTask(beta, 0)) === 0, 'duplicate lines: nearest match wins')
    }
    {
        const lines = ['', alpha]
        assert(resolveTaskLine(lines, mkTask(alpha, 0)) === 1, 'search does not run off the start of the file')
    }
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

// ─── TaskWriter: toggleComplete (integration, against a fake vault) ──────────
// Exercises the real write path — resolve, toggle, recurrence splice — because
// that is where a stale index used to corrupt the wrong line.
async function testToggleComplete(): Promise<void> {
    console.log('\nTaskWriter (toggleComplete):')

    const fakeVault = (files: Record<string, string>) => ({
        getFileByPath: (path: string) => (path in files ? { path } : null),
        process: async (file: { path: string }, fn: (content: string) => string) => {
            files[file.path] = fn(files[file.path])
            return files[file.path]
        },
    }) as unknown as Vault

    const alpha = '- [ ] Alpha 📅 2026-06-01'
    const beta  = '- [ ] Beta 📅 2026-06-02'
    const gamma = '- [ ] Gamma 📅 2026-06-03'

    // The task was indexed at line 2, but a line has since been inserted above
    // it — so line 2 now holds Alpha, and a naive write would complete Alpha.
    {
        const files = { 'P.md': ['# Tasks', '- [ ] Zero', alpha, beta].join('\n') }
        const staleTask: Task = { ...parseTaskLine(beta, 'P.md', 2, 'P')!, rawText: beta, sourceLine: 2 }
        await toggleComplete(staleTask, fakeVault(files), '2026-05-28')
        const lines = files['P.md'].split('\n')
        assert(lines[2] === alpha, 'stale index: the innocent neighbour is left alone')
        assert(lines[3].includes('[x]') && lines[3].includes('Beta'), 'stale index: the intended task is completed')
    }

    // The task is gone, but another task occupies its recorded line. The old
    // "is this still a task line?" guard passed here; this must not.
    {
        const original = ['# Tasks', alpha, gamma].join('\n')
        const files = { 'P.md': original }
        const goneTask: Task = { ...parseTaskLine(beta, 'P.md', 2, 'P')!, rawText: beta, sourceLine: 2 }
        let rejected = false
        try {
            await toggleComplete(goneTask, fakeVault(files), '2026-05-28')
        } catch {
            rejected = true
        }
        assert(rejected, 'vanished task: the write is refused')
        assert(files['P.md'] === original, 'vanished task: the file is left byte-identical')
    }

    // Completing a recurring task stamps the original done and splices the next
    // occurrence in above it.
    {
        const raw = '- [ ] Stand-up 🔁 every day 📅 2026-05-28'
        const files = { 'P.md': raw }
        const task: Task = { ...parseTaskLine(raw, 'P.md', 0, 'P')!, rawText: raw, sourceLine: 0 }
        await toggleComplete(task, fakeVault(files), '2026-05-28')
        const lines = files['P.md'].split('\n')
        assert(lines.length === 2, 'recurring: a line is added')
        assert(lines[0].includes('[ ]') && lines[0].includes('📅 2026-05-29'), 'recurring: next occurrence is open and advanced')
        assert(lines[1].includes('[x]') && lines[1].includes('✅ 2026-05-28'), 'recurring: original is completed and stamped')
    }

    // Creating a task lands in the target note and nowhere else.
    {
        const files = { 'Inbox.md': '# Inbox\n\n- [ ] existing' }
        await createTask('New thing 📅 2026-06-01', 'Inbox.md', fakeVault(files))
        const lines = files['Inbox.md'].split('\n')
        assert(lines[lines.length - 2] === '- [ ] New thing 📅 2026-06-01', 'createTask appends the new task last')
        assert(lines.includes('- [ ] existing'), 'createTask leaves existing content alone')
    }
    {
        let rejected = false
        try { await createTask('x', 'Missing.md', fakeVault({})) } catch { rejected = true }
        assert(rejected, 'createTask refuses when the target note is missing')
    }
    {
        const files = { 'Inbox.md': '# Inbox' }
        let rejected = false
        try { await createTask('   ', 'Inbox.md', fakeVault(files)) } catch { rejected = true }
        assert(rejected, 'createTask refuses empty input')
        assert(files['Inbox.md'] === '# Inbox', 'refused creation leaves the note untouched')
    }

    // A missing source file surfaces as a rejection rather than a silent no-op.
    {
        const task: Task = { ...parseTaskLine(beta, 'P.md', 0, 'P')!, rawText: beta, sourceLine: 0 }
        let rejected = false
        try {
            await toggleComplete(task, fakeVault({}), '2026-05-28')
        } catch {
            rejected = true
        }
        assert(rejected, 'missing source file: the write is refused')
    }
}

void testToggleComplete().then(() => {
    console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'}`)
    process.exit(failures === 0 ? 0 : 1)
})
