// src/tasks/TaskParser.ts
var TASK_LINE = /^[\s>]*[-*+]\s+\[(.)\]\s+(.*)$/;
var ISO_DATE = /(\d{4}-\d{2}-\d{2})/;
var EMOJI_FIELDS = [
  { key: "due", emoji: "\u{1F4C5}" },
  { key: "scheduled", emoji: "\u23F3" },
  { key: "start", emoji: "\u{1F6EB}" },
  { key: "done", emoji: "\u2705" },
  { key: "created", emoji: "\u2795" }
];
var DV_DATE_ALIASES = {
  due: "due",
  scheduled: "scheduled",
  start: "start",
  completion: "done",
  done: "done",
  created: "created"
};
var PRIORITY_EMOJI = [
  { emoji: "\u{1F53A}", priority: "highest" },
  { emoji: "\u23EB", priority: "high" },
  { emoji: "\u{1F53C}", priority: "low" },
  { emoji: "\u{1F53D}", priority: "low" },
  { emoji: "\u23EC", priority: "lowest" }
];
function statusFromChar(char) {
  switch (char) {
    case "x":
    case "X":
      return "done";
    case "/":
      return "inProgress";
    case "-":
      return "cancelled";
    case " ":
      return "open";
    default:
      return "other";
  }
}
function parseTaskLine(line, sourcePath, lineNumber, project) {
  const match = line.match(TASK_LINE);
  if (!match)
    return null;
  const statusChar = match[1];
  let body = match[2];
  const status = statusFromChar(statusChar);
  const checked = status === "done" || status === "cancelled";
  const task = {
    sourcePath,
    sourceLine: lineNumber,
    rawText: line,
    text: "",
    status,
    statusChar,
    checked,
    priority: "normal",
    tags: [],
    project
  };
  for (const { key, emoji } of EMOJI_FIELDS) {
    const re = new RegExp(`${emoji}\\s*${ISO_DATE.source}`);
    const m = body.match(re);
    if (m) {
      task[key] = m[1];
      body = body.replace(m[0], " ");
    }
  }
  for (const { emoji, priority } of PRIORITY_EMOJI) {
    if (body.includes(emoji)) {
      task.priority = priority;
      body = body.replace(emoji, " ");
    }
  }
  const recMatch = body.match(/🔁\s*([^📅⏳🛫✅➕🔺⏫🔼🔽⏬\n]+)/);
  if (recMatch) {
    task.recurrence = recMatch[1].trim();
    body = body.replace(recMatch[0], " ");
  }
  const dvRe = /[\[(]\s*([\w-]+)\s*::\s*([^\])]+?)\s*[\])]/g;
  let dvMatch;
  const dvToStrip = [];
  while ((dvMatch = dvRe.exec(body)) !== null) {
    const fieldKey = dvMatch[1].toLowerCase();
    const value = dvMatch[2].trim();
    const dateKey = DV_DATE_ALIASES[fieldKey];
    if (dateKey && !task[dateKey]) {
      const iso = value.match(ISO_DATE);
      if (iso)
        task[dateKey] = iso[1];
    } else if (fieldKey === "priority" && task.priority === "normal") {
      const p = value.toLowerCase();
      if (p === "highest" || p === "high" || p === "low" || p === "lowest")
        task.priority = p;
    } else if (fieldKey === "repeat" || fieldKey === "recurrence") {
      if (!task.recurrence)
        task.recurrence = value;
    }
    dvToStrip.push(dvMatch[0]);
  }
  for (const s of dvToStrip)
    body = body.replace(s, " ");
  const tagRe = /(^|\s)#([\w/-]+)/g;
  let tagMatch;
  while ((tagMatch = tagRe.exec(body)) !== null) {
    task.tags.push(tagMatch[2]);
  }
  body = body.replace(/(^|\s)#[\w/-]+/g, " ");
  task.text = body.replace(/\s+/g, " ").trim();
  return task;
}
function parseTasks(content, sourcePath, project) {
  const tasks = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const task = parseTaskLine(lines[i], sourcePath, i, project);
    if (task)
      tasks.push(task);
  }
  return tasks;
}

// src/tasks/Task.ts
var PRIORITY_ORDER = {
  highest: 0,
  high: 1,
  normal: 2,
  low: 3,
  lowest: 4
};
function isOpen(task) {
  return task.status === "open" || task.status === "inProgress";
}

// src/tasks/dates.ts
function getToday(dayStartHour) {
  const now = new Date();
  if (now.getHours() < dayStartHour) {
    now.setDate(now.getDate() - 1);
  }
  return toISO(now);
}
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function addDaysISO(iso, offset) {
  const date = fromISO(iso);
  date.setDate(date.getDate() + offset);
  return toISO(date);
}
function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// src/tasks/grouping.ts
function sortTasks(a, b) {
  var _a2, _b2, _c, _d;
  const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (p !== 0)
    return p;
  const ad = (_b2 = (_a2 = a.due) != null ? _a2 : a.scheduled) != null ? _b2 : "9999-99-99";
  const bd = (_d = (_c = b.due) != null ? _c : b.scheduled) != null ? _d : "9999-99-99";
  if (ad !== bd)
    return ad < bd ? -1 : 1;
  return a.text.localeCompare(b.text);
}
function effectiveDate(task) {
  var _a2;
  return (_a2 = task.due) != null ? _a2 : task.scheduled;
}
function buildDashboard(allTasks, todayISO, opts) {
  const tasks = opts.showCompleted ? allTasks : allTasks.filter((t) => !t.checked);
  const overdue = [];
  const dueToday = [];
  const scheduledToday = [];
  const inProgress = [];
  const tomorrow = [];
  const nextDays = [];
  const unscheduled = [];
  const tomorrowISO = addDaysISO(todayISO, 1);
  const windowEndISO = addDaysISO(todayISO, opts.upcomingDays);
  for (const task of tasks) {
    if (!isOpen(task))
      continue;
    if (task.due && task.due < todayISO) {
      overdue.push(task);
      continue;
    }
    if (task.due === todayISO) {
      dueToday.push(task);
      continue;
    }
    if (task.scheduled === todayISO) {
      scheduledToday.push(task);
      continue;
    }
    const eff = effectiveDate(task);
    if (eff === tomorrowISO) {
      tomorrow.push(task);
    } else if (eff && eff > tomorrowISO && eff <= windowEndISO) {
      nextDays.push(task);
    } else if (!eff) {
      if (task.status === "inProgress")
        inProgress.push(task);
      else
        unscheduled.push(task);
    }
  }
  const group = (key, title, list) => ({
    key,
    title,
    tasks: list.sort(sortTasks)
  });
  const today = [
    group("overdue", "Overdue", overdue),
    group("dueToday", "Due today", dueToday),
    group("scheduledToday", "Scheduled today", scheduledToday),
    group("inProgress", "In progress", inProgress)
  ].filter((g) => g.tasks.length > 0);
  const upcoming = [
    group("tomorrow", "Tomorrow", tomorrow),
    group("nextDays", `Next ${opts.upcomingDays} days`, nextDays),
    group("unscheduled", "Unscheduled", unscheduled)
  ].filter((g) => g.tasks.length > 0);
  const projectMap = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    if (!isOpen(task))
      continue;
    const existing = projectMap.get(task.sourcePath);
    if (existing)
      existing.openCount++;
    else
      projectMap.set(task.sourcePath, { project: task.project, sourcePath: task.sourcePath, openCount: 1 });
  }
  const projects = [...projectMap.values()].sort((a, b) => b.openCount - a.openCount || a.project.localeCompare(b.project));
  return { today, upcoming, projects };
}

// src/tasks/recurrence.ts
function computeNextDate(rule, fromISO_) {
  const r = rule.trim().toLowerCase();
  if (r === "daily" || r === "every day")
    return addDaysISO(fromISO_, 1);
  const daysMatch = r.match(/^every\s+(\d+)\s+days?$/);
  if (daysMatch)
    return addDaysISO(fromISO_, parseInt(daysMatch[1]));
  if (r === "weekly" || r === "every week")
    return addDaysISO(fromISO_, 7);
  const weeksMatch = r.match(/^every\s+(\d+)\s+weeks?$/);
  if (weeksMatch)
    return addDaysISO(fromISO_, parseInt(weeksMatch[1]) * 7);
  if (r === "monthly" || r === "every month")
    return addMonths(fromISO_, 1);
  const monthsMatch = r.match(/^every\s+(\d+)\s+months?$/);
  if (monthsMatch)
    return addMonths(fromISO_, parseInt(monthsMatch[1]));
  if (r === "yearly" || r === "annually" || r === "every year")
    return addMonths(fromISO_, 12);
  const yearsMatch = r.match(/^every\s+(\d+)\s+years?$/);
  if (yearsMatch)
    return addMonths(fromISO_, parseInt(yearsMatch[1]) * 12);
  if (r === "every weekday")
    return nextWeekday(fromISO_);
  return void 0;
}
function addMonths(iso, n) {
  const d = fromISO(iso);
  const targetMonth = d.getMonth() + n;
  d.setMonth(targetMonth);
  const intendedMonth = (targetMonth % 12 + 12) % 12;
  if (d.getMonth() !== intendedMonth) {
    d.setDate(0);
  }
  return toISO(d);
}
function nextWeekday(iso) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return toISO(d);
}

// src/tasks/TaskWriter.ts
var CHECKBOX_RE = /^([\s>]*[-*+]\s+\[)(.)\](.*)$/;
var DONE_DATE_RE = /\s*✅\s*\d{4}-\d{2}-\d{2}/g;
function applyToggleToLine(line, toComplete, todayISO) {
  const m = line.match(CHECKBOX_RE);
  if (!m)
    return line;
  const prefix = m[1];
  const rest = m[3];
  if (toComplete) {
    const cleaned = rest.replace(DONE_DATE_RE, "").trimEnd();
    return `${prefix}x]${cleaned} \u2705 ${todayISO}`;
  } else {
    const cleaned = rest.replace(DONE_DATE_RE, "").trimEnd();
    return `${prefix} ]${cleaned}`;
  }
}
function buildNextRecurrence(line, task, todayISO) {
  var _a2, _b2;
  if (!task.recurrence)
    return void 0;
  const ref = (_b2 = (_a2 = task.due) != null ? _a2 : task.scheduled) != null ? _b2 : todayISO;
  const nextDate = computeNextDate(task.recurrence, ref);
  if (!nextDate)
    return void 0;
  let next = line.replace(DONE_DATE_RE, "").replace(/^([\s>]*[-*+]\s+\[)[^\]]\]/, "$1 ]");
  if (task.due) {
    next = next.replace(/📅\s*\d{4}-\d{2}-\d{2}/, `\u{1F4C5} ${nextDate}`);
  } else if (task.scheduled) {
    next = next.replace(/⏳\s*\d{4}-\d{2}-\d{2}/, `\u23F3 ${nextDate}`);
  } else {
    next = next.trimEnd() + ` \u{1F4C5} ${nextDate}`;
  }
  return next.trimEnd();
}

// scripts/logic-test.ts
var failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("  \u2717 " + msg);
    failures++;
  } else
    console.log("  \u2713 " + msg);
}
console.log("TaskParser:");
{
  const t = parseTaskLine("- [ ] Write report \u{1F4C5} 2026-06-01 \u23EB #work/q2", "Proj.md", 3, "Proj");
  assert(!!t, "parses a basic task line");
  assert(t.due === "2026-06-01", "extracts \u{1F4C5} due date");
  assert(t.priority === "high", "extracts \u23EB high priority");
  assert(t.tags.includes("work/q2"), "extracts nested tag");
  assert(t.status === "open", "open status for [ ]");
  assert(t.text === "Write report", "strips metadata from display text");
  assert(t.sourceLine === 3 && t.project === "Proj", "carries source location + project");
}
{
  const t = parseTaskLine("  - [x] done thing \u2705 2026-05-20 \u2795 2026-05-01", "P.md", 0, "P");
  assert(t.status === "done" && t.checked, "done status for [x]");
  assert(t.done === "2026-05-20", "extracts \u2705 completion date");
  assert(t.created === "2026-05-01", "extracts \u2795 created date");
}
{
  const t = parseTaskLine("- [/] in progress task", "P.md", 0, "P");
  assert(t.status === "inProgress", "[/] => inProgress");
}
{
  const t = parseTaskLine("- [ ] dv task [due:: 2026-07-04] [priority:: high]", "P.md", 0, "P");
  assert(t.due === "2026-07-04", "dataview [due::] fallback");
  assert(t.priority === "high", "dataview [priority::] fallback");
}
{
  const t = parseTaskLine("- [ ] recurring \u{1F501} every week \u{1F4C5} 2026-06-10", "P.md", 0, "P");
  assert(t.recurrence === "every week", "captures \u{1F501} recurrence text");
  assert(t.due === "2026-06-10", "still extracts due alongside recurrence");
}
{
  assert(parseTaskLine("Just a paragraph.", "P.md", 0, "P") === null, "non-task line returns null");
  assert(parseTaskLine("- a bullet, not a task", "P.md", 0, "P") === null, "plain bullet returns null");
  const multi = parseTasks("- [ ] a\nsome text\n- [x] b", "P.md", "P");
  assert(multi.length === 2, "parseTasks finds 2 tasks in mixed content");
}
console.log("\ndates:");
{
  assert(addDaysISO("2026-05-28", 1) === "2026-05-29", "addDaysISO +1");
  assert(addDaysISO("2026-03-01", -1) === "2026-02-28", "addDaysISO across month boundary");
  assert(typeof getToday(4) === "string" && getToday(4).length === 10, "getToday returns ISO string");
}
console.log("\ngrouping:");
{
  const today = "2026-05-28";
  const mk = (over, line = "- [ ] x") => {
    const base = parseTaskLine(line, "A.md", 0, "A");
    return { ...base, ...over };
  };
  const taskList = [
    mk({ due: addDaysISO(today, -2) }),
    mk({ due: today }),
    mk({ scheduled: today }),
    mk({ status: "inProgress" }),
    mk({ due: addDaysISO(today, 1) }),
    mk({ due: addDaysISO(today, 3) }),
    mk({}),
    mk({ due: addDaysISO(today, 60) })
  ];
  const d = buildDashboard(taskList, today, { upcomingDays: 7, showCompleted: false });
  const todayKeys = d.today.map((g) => g.key);
  assert(todayKeys.includes("overdue"), "today has overdue group");
  assert(todayKeys.includes("dueToday"), "today has dueToday group");
  assert(todayKeys.includes("scheduledToday"), "today has scheduledToday group");
  assert(todayKeys.includes("inProgress"), "today has inProgress group");
  const upKeys = d.upcoming.map((g) => g.key);
  assert(upKeys.includes("tomorrow"), "upcoming has tomorrow group");
  assert(upKeys.includes("nextDays"), "upcoming has nextDays group");
  assert(upKeys.includes("unscheduled"), "upcoming has unscheduled group");
  assert(d.projects.length === 1 && d.projects[0].project === "A", "projects rolled up by file");
  assert(d.projects[0].openCount === 8, "project open count includes all open tasks");
}
console.log("\nTaskWriter (applyToggleToLine):");
var _a, _b;
{
  const openLine = "- [ ] Buy groceries \u{1F4C5} 2026-06-01";
  const doneLine = "- [x] Buy groceries \u{1F4C5} 2026-06-01 \u2705 2026-05-28";
  const indented = "  - [ ] Indented task";
  const nocheckbox = "Just a paragraph.";
  const completed = applyToggleToLine(openLine, true, "2026-05-28");
  assert(completed.includes("[x]"), "toggle open\u2192done: status becomes [x]");
  assert(completed.includes("\u2705 2026-05-28"), "toggle open\u2192done: \u2705 date appended");
  assert(((_a = completed.match(/✅/g)) != null ? _a : []).length === 1, "toggle open\u2192done: only one \u2705 date");
  const reopened = applyToggleToLine(doneLine, false, "2026-05-28");
  assert(reopened.includes("[ ]"), "toggle done\u2192open: status becomes [ ]");
  assert(!reopened.includes("\u2705"), "toggle done\u2192open: \u2705 date stripped");
  const completedAgain = applyToggleToLine(doneLine, true, "2026-06-01");
  assert(((_b = completedAgain.match(/✅/g)) != null ? _b : []).length === 1, "completing already-done: exactly one \u2705");
  assert(applyToggleToLine(nocheckbox, true, "2026-05-28") === nocheckbox, "non-task line returned unchanged");
  assert(applyToggleToLine(indented, true, "2026-05-28").includes("[x]"), "indented task toggles correctly");
}
console.log("\nrecurrence (computeNextDate):");
{
  assert(computeNextDate("every day", "2026-05-28") === "2026-05-29", "every day +1");
  assert(computeNextDate("daily", "2026-05-28") === "2026-05-29", "daily +1");
  assert(computeNextDate("every 3 days", "2026-05-28") === "2026-05-31", "every 3 days");
  assert(computeNextDate("every week", "2026-05-28") === "2026-06-04", "every week");
  assert(computeNextDate("every 2 weeks", "2026-05-28") === "2026-06-11", "every 2 weeks");
  assert(computeNextDate("every month", "2026-01-31") === "2026-02-28", "every month: Jan 31 \u2192 Feb 28 (no overflow)");
  assert(computeNextDate("every month", "2026-05-01") === "2026-06-01", "every month: normal case");
  assert(computeNextDate("every 3 months", "2026-01-15") === "2026-04-15", "every 3 months");
  assert(computeNextDate("every year", "2026-05-28") === "2027-05-28", "every year");
  assert(computeNextDate("every weekday", "2026-05-28") === "2026-05-29", "every weekday: Thu\u2192Fri");
  assert(computeNextDate("every weekday", "2026-05-29") === "2026-06-01", "every weekday: Fri\u2192Mon (skips weekend)");
  assert(computeNextDate("banana", "2026-05-28") === void 0, "unknown rule returns undefined");
}
console.log("\nTaskWriter (buildNextRecurrence):");
{
  const base = {
    sourcePath: "P.md",
    sourceLine: 0,
    rawText: "- [ ] Stand-up \u{1F501} every day \u{1F4C5} 2026-05-28",
    text: "Stand-up",
    status: "open",
    statusChar: " ",
    checked: false,
    priority: "normal",
    tags: [],
    project: "P",
    recurrence: "every day",
    due: "2026-05-28"
  };
  const next = buildNextRecurrence(base.rawText, base, "2026-05-28");
  assert(!!next, "buildNextRecurrence returns a line");
  assert(next.includes("[ ]"), "next recurrence line is open");
  assert(next.includes("\u{1F4C5} 2026-05-29"), "next recurrence: due date advanced by 1 day");
  assert(!next.includes("\u2705"), "next recurrence: no completion stamp");
  const unknown = buildNextRecurrence("- [ ] x \u{1F501} banana", { ...base, recurrence: "banana" }, "2026-05-28");
  assert(unknown === void 0, "unknown recurrence rule: returns undefined gracefully");
}
console.log(`
${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
