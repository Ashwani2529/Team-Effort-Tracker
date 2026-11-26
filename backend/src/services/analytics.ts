type Entity = Record<string, any>;

const dateAtUtc = (value: string) => new Date(`${value}T00:00:00.000Z`);
const dateString = (value: Date) => value.toISOString().slice(0, 10);
const addDays = (value: string, days: number) => { const date = dateAtUtc(value); date.setUTCDate(date.getUTCDate() + days); return dateString(date); };
const monthEnd = (month: string) => dateString(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)));
const round = (value: number) => Math.round(value * 100) / 100;
const isWorking = (status: string) => status === 'general' || status === 'night';

function rosterStatus(member: Entity, date: string, leaves: Entity[], overrides: Entity[]) {
  const ids = [String(member._id), member.legacyId].filter(Boolean);
  const leave = leaves.some((entry) => ids.includes(String(entry.memberId)) && entry.startDate <= date && entry.endDate >= date && !['cancelled', 'rejected'].includes(String(entry.status || '').toLowerCase()));
  if (leave) return 'leave';
  const override = overrides.find((entry) => String(entry.memberId) === String(member._id) && entry.date === date);
  if (override) return override.shiftId;
  const day = dateAtUtc(date).getUTCDay();
  return day === 0 || day === 6 ? 'off' : 'general';
}

export function calculateProjectAnalytics({ project, members, deliverables, worklogs, leaves, overrides, month, today }: { project: Entity; members: Entity[]; deliverables: Entity[]; worklogs: Entity[]; leaves: Entity[]; overrides: Entity[]; month: string; today: string }) {
  const monthStart = `${month}-01`, monthFinish = monthEnd(month);
  const memberById = new Map<string, Entity>();
  for (const member of members) { memberById.set(String(member._id), member); if (member.legacyId) memberById.set(String(member.legacyId), member); }
  const itemById = new Map(deliverables.map((item) => [String(item._id), item]));
  const attributedLogs: Array<Entity & { attributedMemberId: string; hours: number }> = worklogs.flatMap((entry): Array<Entity & { attributedMemberId: string; hours: number }> => {
    const item = itemById.get(String(entry.deliverableId));
    const member = item && memberById.get(String(item.primaryAssigneeId || ''));
    return member ? [{ ...entry, attributedMemberId: String(member._id), hours: Number(entry.minutes || 0) / 60 }] : [];
  });

  const capacityFor = (member: Entity, date: string) => isWorking(rosterStatus(member, date, leaves, overrides)) ? 8 * Number(member.allocationPercent || 100) / 100 : 0;
  const memberDay = (member: Entity, date: string) => {
    const capacity = capacityFor(member, date);
    const logged = attributedLogs.filter((entry) => entry.attributedMemberId === String(member._id) && entry.workDate === date).reduce((sum, entry) => sum + entry.hours, 0);
    return { capacity, logged, availability: Math.max(capacity - logged, 0), overtime: Math.max(logged - capacity, 0), adjustedEffort: Math.max(logged - 1, 0) };
  };
  const teamDay = (date: string) => {
    const values = members.map((member) => memberDay(member, date));
    return {
      date,
      capacity: round(values.reduce((sum, value) => sum + value.capacity, 0)),
      logged: round(values.reduce((sum, value) => sum + value.logged, 0)),
      availability: round(values.reduce((sum, value) => sum + value.availability, 0)),
      overtime: round(values.reduce((sum, value) => sum + value.overtime, 0)),
      adjustedEffort: round(values.reduce((sum, value) => sum + value.adjustedEffort, 0))
    };
  };

  const daily: Array<ReturnType<typeof teamDay>> = [];
  for (let date = monthStart; date <= monthFinish; date = addDays(date, 1)) daily.push(teamDay(date));
  const todayValues = teamDay(today);
  const availableMembers = members.filter((member) => capacityFor(member, today) > 0).length;
  const todaySummary = { ...todayValues, availableMembers, utilization: todayValues.capacity ? round(todayValues.logged / todayValues.capacity * 100) : 0 };
  const memberRows = members.map((member) => {
    const days = daily.map((entry) => memberDay(member, entry.date));
    const capacity = round(days.reduce((sum, value) => sum + value.capacity, 0));
    const logged = round(days.reduce((sum, value) => sum + value.logged, 0));
    const availability = round(days.reduce((sum, value) => sum + value.availability, 0));
    const overtime = round(days.reduce((sum, value) => sum + value.overtime, 0));
    const todayDay = memberDay(member, today);
    const assignedOpen = deliverables.filter((item) => String(item.primaryAssigneeId) === String(member._id) || String(item.primaryAssigneeId) === String(member.legacyId)).filter((item) => !['done', 'deployed'].includes(item.status));
    const planned = assignedOpen.reduce((sum, item) => sum + Math.max(Number(item.estimatedHours || 0) - Number(item.worklogMinutes || 0) / 60, 0), 0);
    return { memberId: String(member._id), name: member.name, capacity, logged, availability, overtime, todayCapacity: round(todayDay.capacity), todayLogged: round(todayDay.logged), todayAvailability: round(todayDay.availability), todayOvertime: round(todayDay.overtime), overPlanned: planned > todayDay.availability };
  });

  const relevant = deliverables.filter((item) => {
    const start = item.startDate || String(item.createdAt || '').slice(0, 10) || monthStart;
    const finish = item.deploymentDate || item.completionDate || item.dueDate || monthFinish;
    return start <= monthFinish && finish >= monthStart;
  });
  const totalPlanned = relevant.reduce((sum, item) => {
    const loggedBeforeMonth = attributedLogs.filter((entry) => String(entry.deliverableId) === String(item._id) && entry.workDate < monthStart).reduce((hours, entry) => hours + entry.hours, 0);
    return sum + Math.max(Number(item.estimatedHours || 0) - loggedBeforeMonth, 0);
  }, 0);
  const checkpoints = [monthStart, addDays(monthStart, 6), addDays(monthStart, 13), addDays(monthStart, 20), monthFinish].map((date) => date > monthFinish ? monthFinish : date).filter((date, index, all) => all.indexOf(date) === index);
  const burndown = checkpoints.map((date, index) => {
    const actual = relevant.reduce((sum, item) => {
      const finished = item.deploymentDate || item.completionDate;
      if (finished && finished <= date) return sum;
      const logged = attributedLogs.filter((entry) => String(entry.deliverableId) === String(item._id) && entry.workDate <= date).reduce((hours, entry) => hours + entry.hours, 0);
      return sum + Math.max(Number(item.estimatedHours || 0) - logged, 0);
    }, 0);
    const logged = attributedLogs.filter((entry) => entry.workDate >= monthStart && entry.workDate <= date).reduce((sum, entry) => sum + entry.hours, 0);
    const ideal = totalPlanned * (1 - index / Math.max(checkpoints.length - 1, 1));
    return { date, label: index === 0 ? 'Start' : index === checkpoints.length - 1 ? 'Month end' : `Week ${index}`, ideal: round(ideal), actual: round(actual), logged: round(logged), variance: round(actual - ideal) };
  });

  const totals = daily.reduce((value, entry) => ({ capacity: value.capacity + entry.capacity, logged: value.logged + entry.logged, availability: value.availability + entry.availability, overtime: value.overtime + entry.overtime, adjustedEffort: value.adjustedEffort + entry.adjustedEffort }), { capacity: 0, logged: 0, availability: 0, overtime: 0, adjustedEffort: 0 });
  const estimatedEfforts = relevant.reduce((sum, item) => sum + Number(item.estimatedHours || 0), 0);
  const remainingEffort = relevant.filter((item) => !['done', 'deployed'].includes(item.status)).reduce((sum, item) => sum + Math.max(Number(item.estimatedHours || 0) - Number(item.worklogMinutes || 0) / 60, 0), 0);
  const projectDate = new Date(project.createdAt || project.startDate || today);
  const projectCreated = Number.isNaN(projectDate.getTime()) ? today.slice(0, 7) : projectDate.toISOString().slice(0, 7);
  const maxMonth = today.slice(0, 7);
  return {
    month, minMonth: projectCreated, maxMonth, today: todaySummary,
    monthTotals: { ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, round(value)])), utilization: totals.capacity ? round(totals.logged / totals.capacity * 100) : 0, estimatedEfforts: round(estimatedEfforts), remainingEffort: round(remainingEffort) },
    daily, members: memberRows, burndown
  };
}
