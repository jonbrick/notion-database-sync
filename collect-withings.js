const WithingsClient = require("./lib/clients/withings-client.js");
const NotionClient = require("./lib/notion/withings-notion-client.js");
const {
  getWeekBoundaries,
  generateWeekOptions,
  parseDateDDMMYY,
  getSingleDayBoundaries,
} = require("./lib/utils/withings-week-utils.js");
const readline = require("readline");

// Create clients
const withings = new WithingsClient();
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
  console.log("⚖️ Withings Bodyweight Collector 2025\n");

  // Test connections
  console.log("Testing connections...");
  const withingsOk = await withings.testConnection();
  const notionOk = await notion.testConnection();

  if (!withingsOk || !notionOk) {
    console.log("❌ Connection failed. Please check your .env file.");
    process.exit(1);
  }

  // Ask user for selection method
  console.log("\n📅 Choose your selection method:");
  console.log("  1. Enter a specific Date (DD-MM-YY format)");
  console.log("  2. Select by week number (current behavior)");

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
        `\n📊 Collecting bodyweight data for ${selectedDate.toDateString()}`
      );
      console.log(`📅 Date: ${selectedDate.toDateString()}\n`);
    } catch (error) {
      console.log(`❌ ${error.message}`);
      process.exit(1);
    }
  } else if (selectionMethod === "2") {
    // Week-based selection (current behavior)
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
      `📅 Date range: ${weekStart.toDateString()} - ${weekEnd.toDateString()}\n`
    );
  } else {
    console.log("❌ Invalid option. Please choose 1 or 2.");
    process.exit(1);
  }

  // Confirmation step
  console.log("\n📋 Summary:");

  if (selectionMethod === "1") {
    console.log(`📊 Single day operation`);
    console.log(`📅 Date: ${weekStart.toDateString()}`);
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
    "\n? Proceed with collecting bodyweight data for this period? (y/n): "
  );

  if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
    console.log("❌ Operation cancelled.");
    rl.close();
    return;
  }

  rl.close();

  console.log(`\n🔄 Fetching from Withings API...`);

  // Fetch measurements from Withings
  const measurementGroups = await withings.getMeasurements(weekStart, weekEnd);

  if (measurementGroups.length === 0) {
    console.log("📭 No measurements found for this period");
    return;
  }

  console.log("\n⚖️ Processing measurements:");
  let savedCount = 0;
  let skippedCount = 0;

  for (const measurementGroup of measurementGroups) {
    try {
      // Parse the measurement group into structured data
      const measurementData = withings.parseMeasurementGroup(measurementGroup);

      // Check if this measurement already exists (deduplication)
      const exists = await notion.checkMeasurementExists(measurementData.id);
      if (exists) {
        console.log(
          `⏭️  Skipped ${measurementData.date.toDateString()}: Already exists (ID: ${measurementData.id})`
        );
        skippedCount++;
        continue;
      }

      await notion.createMeasurementRecord(measurementData);
      savedCount++;

      const weight = measurementData.weight
        ? `${measurementData.weight.toFixed(1)} lbs`
        : "N/A";
      const fatPct = measurementData.fatPercentage
        ? `${measurementData.fatPercentage.toFixed(1)}%`
        : "N/A";
      const muscleMass = measurementData.muscleMass
        ? `${measurementData.muscleMass.toFixed(1)} lbs`
        : "N/A";

      console.log(
        `✅ Saved ${measurementData.date.toDateString()}: ${weight} | ${fatPct} body fat | ${muscleMass} muscle`
      );
    } catch (error) {
      console.error(
        `❌ Failed to save measurement for ${new Date(measurementGroup.date * 1000).toDateString()}:`,
        error.message
      );
    }
  }

  console.log(`\n✅ Successfully saved ${savedCount} measurements to Notion!`);
  if (skippedCount > 0) {
    console.log(`ℹ️  Skipped ${skippedCount} duplicate measurements`);
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
