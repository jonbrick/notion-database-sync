const readline = require("readline");
const { getWeekBoundaries, generateWeekOptions } = require("./week-utils.js");

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

  // Convert EST to UTC (EST is UTC-5, so add 5 hours to get UTC)
  const startUTC = new Date(estStartOfDay.getTime() + 5 * 60 * 60 * 1000);
  const endUTC = new Date(estEndOfDay.getTime() + 5 * 60 * 60 * 1000);

  return {
    estStartOfDay,
    estEndOfDay,
    startUTC,
    endUTC,
  };
}

function calculateWeekSearchRange(weekStart, weekEnd) {
  // Convert local week boundaries to UTC for GitHub API search
  // Week boundaries are in EST, so we need to convert to UTC properly
  // EST is UTC-5, so we add 5 hours to get UTC
  // But we need to be careful about the end boundary to not include the next day

  // Start: Convert EST start of week to UTC
  const startUTC = new Date(weekStart.getTime() + 5 * 60 * 60 * 1000); // EST → UTC

  // End: Convert EST end of week to UTC, but ensure we don't go past the week boundary
  // weekEnd is already set to 23:59:59.999, so adding 5 hours gives us 04:59:59.999 the next day
  // We want to stop at the end of the week, so we need to be more precise
  const endUTC = new Date(weekEnd.getTime() + 5 * 60 * 60 * 1000); // EST → UTC

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
        "? Enter Date in DD-MM-YY format (e.g., 15-03-25) or shortcuts ('today', 'yesterday', 'tomorrow'): "
      );

      // Handle special date shortcuts
      const inputLower = dateInput.toLowerCase();
      if (inputLower === "yesterday") {
        selectedDate = new Date();
        selectedDate.setDate(selectedDate.getDate() - 1);
        validDate = true;
        console.log(
          `📅 Using yesterday's date: ${selectedDate.toDateString()}`
        );
      } else if (inputLower === "today") {
        selectedDate = new Date();
        validDate = true;
        console.log(`📅 Using today's date: ${selectedDate.toDateString()}`);
      } else if (inputLower === "tomorrow") {
        selectedDate = new Date();
        selectedDate.setDate(selectedDate.getDate() + 1);
        validDate = true;
        console.log(`📅 Using tomorrow's date: ${selectedDate.toDateString()}`);
      } else {
        const validation = validateDate(dateInput);
        if (validation.valid) {
          selectedDate = validation.date;
          validDate = true;
        } else {
          console.log(`❌ ${validation.error}`);
        }
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
      "? Which week(s) to process? (enter week number or comma-separated numbers like '1, 10, 11'): "
    );

    // Parse comma-separated week numbers
    const weekNumbers = weekInput
      .split(",")
      .map((w) => parseInt(w.trim()))
      .filter((w) => !isNaN(w));

    if (weekNumbers.length === 0) {
      console.log("❌ Invalid week number(s)");
      process.exit(1);
    }

    // Validate all week numbers
    for (const weekNumber of weekNumbers) {
      if (weekNumber < 1 || weekNumber > 52) {
        console.log(`❌ Invalid week number: ${weekNumber}`);
        process.exit(1);
      }
    }

    if (weekNumbers.length === 1) {
      // Single week - maintain existing behavior
      const weekNumber = weekNumbers[0];
      const weekData = getWeekBoundaries(2025, weekNumber);
      weekStart = weekData.weekStart;
      weekEnd = weekData.weekEnd;
      dateRangeLabel = `Week ${weekNumber}`;
    } else {
      // Multiple weeks - return array of week data
      const multipleWeeks = weekNumbers.map((weekNumber) => {
        const weekData = getWeekBoundaries(2025, weekNumber);
        return {
          weekNumber,
          weekStart: weekData.weekStart,
          weekEnd: weekData.weekEnd,
          dateRangeLabel: `Week ${weekNumber}`,
        };
      });

      return {
        multipleWeeks,
        optionInput,
        isMultipleWeeks: true,
        weekNumbers,
      };
    }
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

function generateWeekSummary(weekStart, weekEnd, dateRangeLabel, optionInput) {
  if (optionInput === "1") {
    // Single date - just return the date
    return `📅 Date: ${weekStart.toDateString()}`;
  } else {
    // Week selection - show week number and date range
    const weekNumber = dateRangeLabel.replace("Week ", "");
    return `📅 Week ${weekNumber} Summary: ${weekStart.toDateString()} - ${weekEnd.toDateString()}`;
  }
}

module.exports = {
  askQuestion,
  validateDate,
  calculateSearchRange,
  calculateWeekSearchRange,
  getDateSelection,
  testConnections,
  closeReadline,
  generateWeekSummary,
};
