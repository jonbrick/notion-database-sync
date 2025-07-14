const readline = require("readline");
const {
  getWeekBoundaries,
  generateWeekOptions,
} = require("./github-week-utils.js");

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to validate DD-MM-YY date format
function validateDate(dateString) {
  const dateRegex = /^(\d{1,2})-(\d{1,2})-(\d{2})$/;
  const match = dateString.match(dateRegex);

  if (!match) {
    return {
      valid: false,
      error: "Invalid format. Please use DD-MM-YY (e.g., 15-03-25)",
    };
  }

  const [, day, month, year] = match;
  const fullYear = 2000 + parseInt(year);
  const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));

  // Check if the date is valid
  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== parseInt(month) - 1 ||
    date.getDate() !== parseInt(day)
  ) {
    return {
      valid: false,
      error: "Invalid date. Please check day, month, and year.",
    };
  }

  return { valid: true, date };
}

function calculateSearchRange(selectedDate) {
  // Create EST day boundaries (local time)
  const estStartOfDay = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
    0,
    0,
    0
  );
  const estEndOfDay = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
    23,
    59,
    59
  );

  // Convert to UTC using JavaScript's timezone offset
  const startOffset = estStartOfDay.getTimezoneOffset() * 60 * 1000;
  const endOffset = estEndOfDay.getTimezoneOffset() * 60 * 1000;

  const startUTC = new Date(estStartOfDay.getTime() - startOffset);
  const endUTC = new Date(estEndOfDay.getTime() - endOffset);

  return {
    estStartOfDay,
    estEndOfDay,
    startUTC,
    endUTC,
  };
}

function calculateWeekSearchRange(weekStart, weekEnd) {
  // Convert local week boundaries to UTC for GitHub API search
  // Use JavaScript's built-in timezone offset instead of hardcoding
  // This handles EDT (UTC-4) vs EST (UTC-5) automatically

  // getTimezoneOffset returns minutes, positive for west of UTC
  // So for EDT it returns 240 (4 hours), for EST it returns 300 (5 hours)
  const startOffset = weekStart.getTimezoneOffset() * 60 * 1000;
  const endOffset = weekEnd.getTimezoneOffset() * 60 * 1000;

  // Convert to UTC by subtracting the offset
  const startUTC = new Date(weekStart.getTime() - startOffset);
  const endUTC = new Date(weekEnd.getTime() - endOffset);

  return {
    weekStart,
    weekEnd,
    startUTC,
    endUTC,
  };
}

async function getDateSelection() {
  console.log("📅 Choose your selection method:");
  console.log("  1. Enter a specific Date (DD-MM-YY format)");
  console.log("  2. Select by week number");

  const optionInput = await askQuestion("? Choose option (1 or 2): ");

  let weekStart, weekEnd, dateRangeLabel, selectedDate;

  if (optionInput === "1") {
    // Specific date input
    let validDate = false;

    while (!validDate) {
      const dateInput = await askQuestion(
        "? Enter Date in DD-MM-YY format (e.g., 15-03-25): "
      );

      const validation = validateDate(dateInput);
      if (validation.valid) {
        selectedDate = validation.date;
        validDate = true;
      } else {
        console.log(`❌ ${validation.error}`);
      }
    }

    // Set start and end to the same day
    weekStart = new Date(selectedDate);
    weekStart.setHours(0, 0, 0, 0);

    weekEnd = new Date(selectedDate);
    weekEnd.setHours(23, 59, 59, 999);

    dateRangeLabel = `Date: ${selectedDate.toDateString()}`;
  } else if (optionInput === "2") {
    // Week selection
    console.log("\n📅 Available weeks:");
    const weeks = generateWeekOptions(2025);

    // Show first few weeks as examples
    weeks.slice(0, 5).forEach((week, index) => {
      console.log(`  ${week.value} - ${week.label}`);
    });
    console.log("  ...");
    console.log(`  52 - ${weeks[51].label}\n`);

    const weekInput = await askQuestion(
      "? Which week to process? (enter week number): "
    );
    const weekNumber = parseInt(weekInput);

    if (weekNumber < 1 || weekNumber > 52) {
      console.log("❌ Invalid week number");
      process.exit(1);
    }

    const weekData = getWeekBoundaries(2025, weekNumber);
    weekStart = weekData.weekStart;
    weekEnd = weekData.weekEnd;
    dateRangeLabel = `Week ${weekNumber}`;
  } else {
    console.log("❌ Invalid option. Please choose 1 or 2.");
    process.exit(1);
  }

  return { weekStart, weekEnd, dateRangeLabel, selectedDate, optionInput };
}

async function testConnections(clients) {
  console.log("Testing connections...");

  const results = {};
  for (const [name, client] of Object.entries(clients)) {
    results[name] = await client.testConnection();
  }

  const allOk = Object.values(results).every((result) => result);
  if (!allOk) {
    console.log("❌ Connection failed. Please check your .env file.");
    process.exit(1);
  }

  return results;
}

function closeReadline() {
  rl.close();
}

module.exports = {
  askQuestion,
  validateDate,
  calculateSearchRange,
  calculateWeekSearchRange,
  getDateSelection,
  testConnections,
  closeReadline,
};
