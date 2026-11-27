/* DeepSeek proposes steps; deterministic local scheduling owns dates. No writes. */
(function () {
  "use strict";
  const POS = window.POS, P = POS.planning, U = POS.util;
  async function breakdown(input, { signal } = {}) {
    const owner = POS.cloud.getStatus().user?.uid;
    if (!owner) throw new Error("Sign in before generating a plan.");
    const options = { start: input.startDate || U.todayISO(), deadline: input.targetDate, capacity: input.capacity, days: input.weekendsOff === false ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5] };
    P.preferences(options);
    if (!P.validDate(options.deadline) || options.deadline < options.start || options.deadline > P.add(options.start, 366)) throw new Error("Choose a target date within the next year.");
    const description = [input.title.trim(), input.description?.trim()].filter(Boolean).join("\n\n");
    if (description.length < 8 || description.length > 5000) throw new Error("Describe the goal in 8–5000 characters.");
    const token = await POS.cloud.token();
    if (POS.cloud.getStatus().user?.uid !== owner) throw new Error("Your account changed. Generate a new plan.");
    const response = await fetch("/api/plan", {
      method: "POST", signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(55000)]),
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ description, capacity: options.capacity }),
    });
    let result;
    try { result = await response.json(); }
    catch { throw new Error("The planning server returned an invalid response. Restart npm run dev and try again."); }
    if (!response.ok) throw new Error(result.error || "DeepSeek could not generate a plan. Try again or choose On-device templates.");
    if (POS.cloud.getStatus().user?.uid !== owner) throw new Error("Your account changed. Generate a new plan.");
    const scheduled = P.schedule(result.steps, options, POS.store.get().tasks);
    const milestones = [];
    scheduled.forEach((task, i) => {
      const title = result.steps[i].milestone || "Complete the goal";
      let milestone = milestones.at(-1);
      if (!milestone || milestone.title !== title) { milestone = { id: U.uid("m"), title, due: task.date, tasks: [] }; milestones.push(milestone); }
      milestone.due = task.date;
      milestone.tasks.push({ ...task, id: U.uid("draft"), milestoneId: milestone.id, priority: 2, depTitle: i ? scheduled[i - 1].title : null });
    });
    const totalMinutes = scheduled.reduce((sum, task) => sum + task.duration, 0);
    return {
      title: result.title, description: input.description || "", startDate: options.start, targetDate: options.deadline,
      capacity: options.capacity, workingDays: options.days, milestones, totalMinutes, endDate: scheduled.at(-1).date, overbooked: false,
      explanation: `DeepSeek proposed ${scheduled.length} tasks across ${milestones.length} milestones. Dates were checked locally against your existing work and daily capacity.`,
      warnings: [], note: "Estimates are suggestions. Review the scope, task order and dates before approving.", local: false,
    };
  }
  POS.goalAgent = { breakdown };
})();
