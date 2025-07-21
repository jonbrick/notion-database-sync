const StravaClient = require("./lib/clients/strava-client.js");
const NotionClient = require("./lib/notion/strava-notion-client.js");
const {
  getWeekBoundaries,
  generateWeekOptions,
} = require("./lib/utils/strava-week-utils.js");
const readline = require("readline");

// Check for CLI arguments for non-interactive mode
const args = process.argv.slice(2);
const isNonInteractive = args.length > 0;
const cliDateInput = args[0];

// Create clients
const strava = new StravaClient();
const notion = new NotionClient();

// Create readline interface only if needed
let rl;
if (!isNonInteractive) {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

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

// Function to get week boundaries for a specific date
function getWeekBoundariesForDate(date) {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate Sunday (start of week)
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  // Calculate Saturday (end of week)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

async function main() {
  console.log("🏃‍♂️ Strava Workout Collector 2025\n");

  // Test connections
  console.log("Testing connections...");
  const stravaOk = await strava.testConnection();
  const notionOk = await notion.testConnection();

  if (!stravaOk || !notionOk) {
    console.log("❌ Connection failed. Please check your .env file.");
    process.exit(1);
  }

  let weekStart, weekEnd, dateRangeLabel, selectedDate, weekNumber, optionInput;

  if (isNonInteractive) {
    // Non-interactive mode with CLI argument
    try {
      const validation = validateDate(cliDateInput);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      selectedDate = validation.date;
      optionInput = "1"; // Force single day mode

      // Set start and end to the same day
      weekStart = new Date(selectedDate);
      weekStart.setHours(0, 0, 0, 0);

      weekEnd = new Date(selectedDate);
      weekEnd.setHours(23, 59, 59, 999);

      dateRangeLabel = `Date: ${selectedDate.toDateString()}`;

      console.log(
        `📊 Collecting Strava data for ${selectedDate.toDateString()}`
      );
    } catch (error) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  } else {
    // Interactive mode (original behavior)
    console.log(""); // Add spacing after connection messages

    console.log("📅 Choose your selection method:");
    console.log("  1. Enter a specific Date (DD-MM-YY format)");
    console.log("  2. Select by week number");

    optionInput = await askQuestion("? Choose option (1 or 2): ");

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
      // Week selection (current behavior)
      console.log("\n📅 Available weeks:");
      const weeks = generateWeekOptions(2025);

      // Show first few weeks as examples
      weeks.slice(0, 5).forEach((week, index) => {
        console.log(`  ${week.value} - ${week.label}`);
      });
      console.log("  ...");
      console.log(`  52 - ${weeks[51].label}\n`);

      const weekInput = await askQuestion(
        "? Which week to collect? (enter week number): "
      );
      weekNumber = parseInt(weekInput);

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

    if (optionInput === "1") {
      // Calculate which week this date falls into
      const weekBoundaries = getWeekBoundariesForDate(selectedDate);
      const weekStartForDate = weekBoundaries.weekStart;
      const weekEndForDate = weekBoundaries.weekEnd;

      // Find the week number by checking which week of 2025 this falls into
      weekNumber = 1;
      for (let i = 1; i <= 52; i++) {
        const { weekStart: testWeekStart, weekEnd: testWeekEnd } =
          getWeekBoundaries(2025, i);
        if (selectedDate >= testWeekStart && selectedDate <= testWeekEnd) {
          weekNumber = i;
          break;
        }
      }

      console.log(`\n📊 Week ${weekNumber}: ${selectedDate.toDateString()}`);
    } else {
      console.log(
        `\n📊 Week ${weekNumber}: ${weekStart.toDateString()} - ${weekEnd.toDateString()}`
      );
    }

    // Final confirmation
    const finalConfirm = await askQuestion("? Proceed? (y/n): ");
    if (finalConfirm.toLowerCase() !== "y") {
      console.log("❌ Cancelled");
      process.exit(0);
    }

    rl.close();
  }

  console.log("\n🚀 Collecting...\n");

  // Fetch workouts from Strava
  const activities = await strava.getActivities(weekStart, weekEnd);

  if (activities.length === 0) {
    console.log(`📭 Week ${weekNumber}: No activities found`);
    if (!isNonInteractive) {
      rl.close();
    }
    process.exit(0);
  }

  if (optionInput === "1") {
    console.log(
      `🔄 Fetching workout sessions from ${
        selectedDate.toISOString().split("T")[0]
      } to ${selectedDate.toISOString().split("T")[0]}`
    );
  }

  console.log(`🏃‍♂️ Found ${activities.length} workout sessions\n`);

  console.log("🏃‍♂️ Processing workout sessions:");
  let savedCount = 0;

  for (const activity of activities) {
    try {
      // Convert Strava's UTC time to EST/EDT local time with correct DST handling
      const utcTime = new Date(activity.start_date);

      // Create a date object in EST/EDT timezone to get the correct offset
      const estDate = new Date(
        utcTime.toLocaleString("en-US", {
          timeZone: "America/New_York",
        })
      );

      // Get the timezone offset (EST = -05:00, EDT = -04:00)
      const offset = estDate.getTimezoneOffset();
      const offsetHours = Math.abs(Math.floor(offset / 60));
      const offsetMinutes = Math.abs(offset % 60);
      const offsetString = `-${offsetHours
        .toString()
        .padStart(2, "0")}:${offsetMinutes.toString().padStart(2, "0")}`;

      // Format the time in EST/EDT
      const estTime = utcTime.toLocaleString("sv-SE", {
        timeZone: "America/New_York",
      });

      const estTimeString = estTime.replace(" ", "T") + offsetString;

      // Add the local time to the activity data
      const activityWithLocalTime = {
        ...activity,
        start_date_local: estTimeString,
      };

      await notion.createWorkoutRecord(activityWithLocalTime);
      savedCount++;

      if (optionInput === "1") {
        console.log(
          `✅ Saved ${selectedDate.toDateString()}: ${activity.name} | ${
            activity.type
          } | ${
            activity.distance
              ? (activity.distance / 1000).toFixed(2) + "km"
              : "N/A"
          }`
        );
      } else {
        console.log(
          `✅ Saved ${activity.name}: ${activity.type} | ${
            activity.distance
              ? (activity.distance / 1000).toFixed(2) + "km"
              : "N/A"
          }`
        );
      }
    } catch (error) {
      console.error(`❌ Failed to save ${activity.name}:`, error.message);
    }
  }

  console.log(`\n✅ Week ${weekNumber}: ${savedCount} workouts saved`);

  if (!isNonInteractive) {
    rl.close();
  }
}

main().catch(console.error);
