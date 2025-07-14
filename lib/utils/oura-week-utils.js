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

function parseDateDDMMYY(dateString) {
  // Parse DD-MM-YY format
  const parts = dateString.split("-");
  if (parts.length !== 3) {
    throw new Error(
      "Invalid date format. Please use DD-MM-YY (e.g., 15-03-25)"
    );
  }

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const year = 2000 + parseInt(parts[2], 10); // Assume 20xx for YY

  const date = new Date(year, month, day);

  // Validate the date
  if (
    date.getDate() !== day ||
    date.getMonth() !== month ||
    date.getFullYear() !== year
  ) {
    throw new Error("Invalid date. Please check your input.");
  }

  return date;
}

function getWeekBoundariesForDate(date) {
  // Find the Sunday that starts the week containing this date
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

function getSingleDayBoundaries(date) {
  // Set the start to the beginning of the specified day
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  // Set the end to the end of the specified day
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return { dayStart, dayEnd };
}

module.exports = {
  getWeekBoundaries,
  generateWeekOptions,
  parseDateDDMMYY,
  getWeekBoundariesForDate,
  getSingleDayBoundaries,
};
