// Week calculation utilities for Sunday-Saturday weeks
function getWeekBoundaries(year, weekNumber) {
  // Week 1 starts January 1st, regardless of day of week
  const jan1 = new Date(year, 0, 1); // January 1st

  // Find the first Sunday of the year (or before Jan 1 if Jan 1 is not Sunday)
  const jan1DayOfWeek = jan1.getDay(); // 0 = Sunday, 1 = Monday, etc.

  let firstSunday;
  if (jan1DayOfWeek === 0) {
    // Jan 1 is Sunday - Week 1 starts Jan 1
    firstSunday = new Date(jan1);
  } else {
    // Jan 1 is not Sunday - Week 1 started the previous Sunday
    firstSunday = new Date(jan1);
    firstSunday.setDate(jan1.getDate() - jan1DayOfWeek);
  }

  // Calculate week start (Sunday)
  const weekStart = new Date(firstSunday);
  weekStart.setDate(firstSunday.getDate() + (weekNumber - 1) * 7);

  // Calculate week end (Saturday)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

function generateWeekOptions(year) {
  const weeks = [];
  for (let i = 1; i <= 52; i++) {
    const { weekStart, weekEnd } = getWeekBoundaries(year, i);
    const startStr = weekStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endStr = weekEnd.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    weeks.push({
      value: i,
      label: `Week ${i.toString().padStart(2, "0")} (${startStr} - ${endStr})`,
    });
  }
  return weeks;
}

module.exports = {
  getWeekBoundaries,
  generateWeekOptions,
};
