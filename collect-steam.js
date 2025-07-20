const SteamClient = require("./lib/clients/steam-client.js");
const NotionClient = require("./lib/notion/steam-notion-client.js");
const {
  getWeekBoundaries,
  generateWeekOptions,
  parseDateDDMMYY,
  getSingleDayBoundaries,
} = require("./lib/utils/steam-week-utils.js");
const readline = require("readline");

// Create clients
const steam = new SteamClient();
const notion = new NotionClient();

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

async function main() {
  console.log("🎮 Steam Gaming Activity Collector 2025\n");

  // Test connections
  console.log("Testing connections...");
  const steamOk = await steam.testConnection();
  const notionOk = await notion.testConnection();

  if (!steamOk || !notionOk) {
    console.log("❌ Connection failed. Please check your .env file.");
    process.exit(1);
  }

  // Ask user for selection method
  console.log("\n📅 Choose your selection method:");
  console.log("  1. Enter a specific Date (DD-MM-YY format)");
  console.log("  2. Select by week number");

  const selectionMethod = await askQuestion("? Choose option (1 or 2): ");

  let weekStart, weekEnd;
  let selectedWeekNumber;

  if (selectionMethod === "1") {
    // Date-based selection
    const dateInput = await askQuestion(
      "? Enter Date in DD-MM-YY format (e.g., 15-03-25): "
    );

    try {
      const selectedDate = parseDateDDMMYY(dateInput);
      const boundaries = getSingleDayBoundaries(selectedDate);
      weekStart = boundaries.dayStart;
      weekEnd = boundaries.dayEnd;

      console.log(
        `\n📊 Collecting gaming data for ${selectedDate.toDateString()}`
      );
      console.log(`🎮 Date: ${selectedDate.toDateString()}\n`);
    } catch (error) {
      console.log(`❌ ${error.message}`);
      process.exit(1);
    }
  } else if (selectionMethod === "2") {
    // Week-based selection
    console.log("\n📅 Available weeks:");
    const weeks = generateWeekOptions(2025);

    // Show first few weeks as examples
    weeks.slice(0, 5).forEach((week) => {
      console.log(`  ${week.value} - ${week.label}`);
    });
    console.log("  ...");
    console.log(`  52 - ${weeks[51].label}\n`);

    const weekInput = await askQuestion(
      "? Which week to collect? (enter week number): "
    );
    const weekNumber = parseInt(weekInput);

    if (weekNumber < 1 || weekNumber > 52) {
      console.log("❌ Invalid week number");
      process.exit(1);
    }

    selectedWeekNumber = weekNumber;
    const boundaries = getWeekBoundaries(2025, weekNumber);
    weekStart = boundaries.weekStart;
    weekEnd = boundaries.weekEnd;

    console.log(`\n📊 Week ${weekNumber} Selected`);
    console.log(
      `🎮 Date range: ${weekStart.toDateString()} - ${weekEnd.toDateString()}\n`
    );
  } else {
    console.log("❌ Invalid option. Please choose 1 or 2.");
    process.exit(1);
  }

  // Confirmation step
  console.log("\n📋 Summary:");

  if (selectionMethod === "1") {
    console.log(`📊 Single day operation`);
    console.log(`🎮 Date: ${weekStart.toDateString()}`);
  } else {
    console.log(
      `📊 Total days: ${Math.ceil(
        (weekEnd - weekStart) / (1000 * 60 * 60 * 24)
      )} days`
    );
    console.log(
      `📅 Date range: ${weekStart.toDateString()} - ${weekEnd.toDateString()}`
    );
  }

  const confirm = await askQuestion(
    "\n? Proceed with collecting gaming data for this period? (y/n): "
  );

  if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
    console.log("❌ Operation cancelled.");
    rl.close();
    return;
  }

  rl.close();

  console.log(`\n🔄 Fetching from Steam API...`);
  console.log(
    `   Querying dates: ${weekStart.toISOString().split("T")[0]} to ${
      weekEnd.toISOString().split("T")[0]
    }\n`
  );

  // Fetch gaming activities from Steam
  const activities = await steam.getActivities(weekStart, weekEnd);

  if (activities.length === 0) {
    console.log("📭 No gaming sessions found for this period");
    return;
  }

  console.log("\n🎮 Processing gaming sessions:");
  let savedCount = 0;
  let skippedCount = 0;

  for (const activity of activities) {
    try {
      // Check if this activity already exists (deduplication)
      const exists = await notion.checkActivityExists(activity.id);
      if (exists) {
        console.log(
          `⏭️  Skipped ${activity.gameName} on ${activity.date}: Already exists`
        );
        skippedCount++;
        continue;
      }

      await notion.createGamingRecord(activity);
      savedCount++;

      const hours = activity.hoursPlayed.toFixed(1);
      const sessions = activity.sessionCount;

      console.log(
        `✅ Saved ${activity.date}: ${activity.gameName} | ${hours}hrs | ${sessions} ${
          sessions === 1 ? "session" : "sessions"
        }`
      );
    } catch (error) {
      console.error(
        `❌ Failed to save gaming data for ${activity.gameName} on ${activity.date}:`,
        error.message
      );
    }
  }

  console.log(
    `\n✅ Successfully saved ${savedCount} gaming activities to Notion!`
  );
  if (skippedCount > 0) {
    console.log(`ℹ️  Skipped ${skippedCount} duplicate activities`);
  }

  // Show summary of what was processed
  if (selectionMethod === "2") {
    console.log(
      `📅 Week ${selectedWeekNumber}: ${weekStart.toDateString()} - ${weekEnd.toDateString()}`
    );
  } else {
    console.log(`📅 Date: ${weekStart.toDateString()}`);
  }
}

main().catch(console.error);
