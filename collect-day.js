#!/usr/bin/env node

const { spawn } = require("child_process");
const readline = require("readline");

// Configuration
const COLLECTORS = [
  { script: "collect-github.js", name: "GitHub", emoji: "🔨" },
  { script: "collect-oura.js", name: "Oura Sleep", emoji: "😴" },
  { script: "collect-steam.js", name: "Steam Gaming", emoji: "🎮" },
  { script: "collect-strava.js", name: "Strava Workouts", emoji: "🏃‍♂️" },
  { script: "collect-withings.js", name: "Withings Body Weight", emoji: "⚖️" },
];

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

// Convert date input to DD-MM-YY format
function convertDateInput(input) {
  const now = new Date();

  switch (input?.toLowerCase()) {
    case "yesterday":
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return formatDateDDMMYY(yesterday);

    case "today":
      return formatDateDDMMYY(now);

    case "tomorrow":
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      return formatDateDDMMYY(tomorrow);

    default:
      return input || formatDateDDMMYY(now);
  }
}

// Format date as DD-MM-YY
function formatDateDDMMYY(date) {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString().slice(-2);
  return `${day}-${month}-${year}`;
}

// Parse DD-MM-YY format and validate
function parseDateDDMMYY(dateString) {
  const regex = /^(\d{1,2})-(\d{1,2})-(\d{2})$/;
  const match = dateString.match(regex);

  if (!match) {
    throw new Error("Invalid format. Please use DD-MM-YY (e.g., 15-03-25)");
  }

  const [, day, month, year] = match;
  const fullYear = 2000 + parseInt(year, 10);
  const date = new Date(fullYear, parseInt(month, 10) - 1, parseInt(day, 10));

  // Validate the date
  if (
    date.getDate() !== parseInt(day, 10) ||
    date.getMonth() !== parseInt(month, 10) - 1 ||
    date.getFullYear() !== fullYear
  ) {
    throw new Error("Invalid date. Please check day, month, and year.");
  }

  return date;
}

// Get readable date with day of week
function getDateInfo(dateString) {
  try {
    const date = parseDateDDMMYY(dateString);
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });
    const readableDate = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return {
      valid: true,
      dayOfWeek,
      readableDate,
      date,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

// Run a single collector script
function runCollector(script, date) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [script, date], {
      stdio: "inherit", // Pass through all output
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

// Main function
async function main() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    let inputDate = args[0];

    // If no date provided via command line, prompt for one
    if (!inputDate) {
      console.log("🗓️  GitHub Activity & Health Data Collector");
      console.log("================================================");
      console.log("");
      console.log("📅 Date options:");
      console.log("   yesterday          Yesterday's date (default)");
      console.log("   today              Today's date");
      console.log("   tomorrow           Tomorrow's date");
      console.log("   DD-MM-YY           Specific date (e.g., 15-12-24)");
      console.log("");

      inputDate = await askQuestion(
        "? Enter date to collect data for (or enter for yesterday): "
      );

      if (!inputDate.trim()) {
        inputDate = "yesterday"; // Default to yesterday if nothing entered
      }
    }

    // Convert input to DD-MM-YY format
    const dateString = convertDateInput(inputDate);

    console.log(`🗓️ Collecting all data for ${dateString}`);

    // Validate and show date info
    const dateInfo = getDateInfo(dateString);
    if (!dateInfo.valid) {
      console.error(`❌ ${dateInfo.error}`);
      console.log("Please use DD-MM-YY format (e.g., 15-12-24)");
      process.exit(1);
    }

    console.log(`📅 That's ${dateInfo.dayOfWeek}, ${dateInfo.readableDate}`);
    console.log("");

    // Get confirmation
    const proceed = await askQuestion(
      "? Proceed with collecting all data for this date? (y/n): "
    );

    if (proceed.toLowerCase() !== "y" && proceed.toLowerCase() !== "yes") {
      console.log("❌ Collection cancelled");
      rl.close();
      process.exit(0);
    }

    rl.close();

    console.log("================================================");

    // Track results
    const results = [];

    // Run each collector
    for (const collector of COLLECTORS) {
      console.log("");
      console.log(
        `${collector.emoji} Starting ${collector.name} collection...`
      );

      try {
        await runCollector(collector.script, dateString);
        console.log(`✅ ${collector.name} collection completed successfully`);
        results.push({ ...collector, success: true });
      } catch (error) {
        console.log(`❌ ${collector.name} collection failed`);
        results.push({ ...collector, success: false, error: error.message });
      }
    }

    console.log("");
    console.log("================================================");

    // Final summary
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    if (failed.length === 0) {
      console.log(
        `✅ All collections completed successfully for ${dateString}!`
      );
    } else {
      const failedNames = failed.map((f) => f.name).join(", ");
      console.log(`⚠️  Some collections failed: ${failedNames}`);
      console.log(
        "   You may want to run them individually to see detailed errors."
      );
    }

    console.log("🎉 Collection session complete!");

    // Exit with error code if any failed
    process.exit(failed.length > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Unexpected error:", error.message);
    rl.close();
    process.exit(1);
  }
}

// Show usage if --help is provided
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
Usage: node collect-day.js [date]

Interactive mode (no arguments):
  node collect-day.js              # Prompts for date selection

Non-interactive mode:
  node collect-day.js yesterday    # Yesterday's date
  node collect-day.js today        # Today's date
  node collect-day.js tomorrow     # Tomorrow's date
  node collect-day.js 15-12-24    # Specific date

Date options:
  yesterday          Yesterday's date
  today              Today's date (default)
  tomorrow           Tomorrow's date
  DD-MM-YY           Specific date (e.g., 15-12-24)

Examples:
  node collect-day.js              # Interactive mode
  node collect-day.js yesterday    # Non-interactive mode
  node collect-day.js 15-12-24    # Non-interactive mode
`);
  process.exit(0);
}

// Run the main function
if (require.main === module) {
  main();
}
