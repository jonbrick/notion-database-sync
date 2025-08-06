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

// Run a single collector script and capture output for recap
function runCollector(script, date) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const child = spawn("node", [script, date], {
      stdio: ["inherit", "pipe", "pipe"], // Capture stdout/stderr but inherit stdin
    });

    // Forward stdout to console and capture for parsing
    child.stdout.on("data", (data) => {
      const output = data.toString();
      process.stdout.write(output);
      stdout += output;
    });

    // Forward stderr to console and capture
    child.stderr.on("data", (data) => {
      const output = data.toString();
      process.stderr.write(output);
      stderr += output;
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(parseCollectorOutput(stdout));
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

// Parse collector output to extract summary information
function parseCollectorOutput(output) {
  const summary = {
    activities: 0,
    workouts: 0,
    sleepRecords: 0,
    bodyWeightRecords: 0,
    gamesSessions: 0,
    commits: 0,
    repositories: 0,
  };

  const lines = output.split("\n");

  for (const line of lines) {
    // More flexible patterns - look for numbers followed by relevant keywords

    // GitHub patterns - look for various success indicators
    if (
      line.includes("✅") ||
      line.includes("Created") ||
      line.includes("Updated") ||
      line.includes("Added") ||
      line.includes("Saved")
    ) {
      // GitHub activities
      if (line.includes("activity") || line.includes("activities")) {
        const match = line.match(/(\d+)\s+activit(y|ies)/i);
        if (match) summary.activities += parseInt(match[1]);
      }
      if (line.includes("commit") || line.includes("commits")) {
        const match = line.match(/(\d+)\s+commits?/i);
        if (match) summary.commits += parseInt(match[1]);
      }
      if (line.includes("repo") || line.includes("repositories")) {
        const match = line.match(/(\d+)\s+repositor(y|ies)/i);
        if (match) summary.repositories += parseInt(match[1]);
      }

      // Strava patterns
      if (
        line.includes("workout") ||
        line.includes("workouts") ||
        line.includes("exercise")
      ) {
        const match = line.match(/(\d+)\s+(workouts?|exercises?)/i);
        if (match) summary.workouts += parseInt(match[1]);
      }

      // Oura patterns - only count new saves, not skipped
      if (line.includes("sleep") && !line.includes("Skipped")) {
        const match = line.match(
          /(\d+)\s+(new\s+)?sleep\s+(record|session|period)s?/i
        );
        if (match) summary.sleepRecords += parseInt(match[1]);
      }

      // Withings patterns
      if (line.includes("weight") || line.includes("body")) {
        const match = line.match(
          /(\d+)\s+(body\s+weight|weight)\s+(record|measurement)s?/i
        );
        if (match) summary.bodyWeightRecords += parseInt(match[1]);
      }

      // Steam patterns
      if (
        line.includes("game") ||
        line.includes("gaming") ||
        line.includes("session")
      ) {
        const match = line.match(
          /(\d+)\s+(gaming\s+sessions?|game\s+sessions?|sessions?)/i
        );
        if (match) summary.gamesSessions += parseInt(match[1]);
      }
    }

    // Look for "Successfully saved X new" pattern specifically
    if (line.includes("Successfully saved") && line.includes("new")) {
      if (line.includes("sleep")) {
        const match = line.match(/Successfully saved (\d+) new sleep/i);
        if (match) summary.sleepRecords += parseInt(match[1]);
      }
      if (line.includes("workout") || line.includes("workouts")) {
        const match = line.match(/Successfully saved (\d+) new.*workout/i);
        if (match) summary.workouts += parseInt(match[1]);
      }
      if (line.includes("weight") || line.includes("body")) {
        const match = line.match(/Successfully saved (\d+) new.*weight/i);
        if (match) summary.bodyWeightRecords += parseInt(match[1]);
      }
      if (line.includes("game") || line.includes("gaming")) {
        const match = line.match(/Successfully saved (\d+) new.*gam/i);
        if (match) summary.gamesSessions += parseInt(match[1]);
      }
      if (line.includes("activit")) {
        const match = line.match(/Successfully saved (\d+) new.*activit/i);
        if (match) summary.activities += parseInt(match[1]);
      }
    }

    // Also look for summary lines that might have different formats
    // Like "Found X items" or "Processing X records"
    if (
      line.includes("Found") ||
      line.includes("Processing") ||
      line.includes("Collected")
    ) {
      // Try to extract any numbers and context
      if (line.includes("activity") || line.includes("activities")) {
        const match = line.match(/(\d+)\s+activit(y|ies)/i);
        if (match) summary.activities += parseInt(match[1]);
      }
      // Only count from specific success patterns, not "Found" lines
      if (line.includes("workout") || line.includes("workouts")) {
        if (!line.includes("Found")) {
          const match = line.match(/(\d+)\s+workouts?/i);
          if (match) summary.workouts += parseInt(match[1]);
        }
      }
      if (
        line.includes("sleep") &&
        !line.includes("Skipped") &&
        !line.includes("Found")
      ) {
        const match = line.match(/(\d+)\s+(new\s+)?sleep/i);
        if (match) summary.sleepRecords += parseInt(match[1]);
      }
      if (line.includes("weight") && !line.includes("Found")) {
        const match = line.match(/(\d+)\s+weight/i);
        if (match) summary.bodyWeightRecords += parseInt(match[1]);
      }
      if (
        (line.includes("game") || line.includes("gaming")) &&
        !line.includes("Found")
      ) {
        const match = line.match(/(\d+)\s+(game|gaming)/i);
        if (match) summary.gamesSessions += parseInt(match[1]);
      }
    }
  }

  // Debug: uncomment the next line to see what output was captured
  // console.log("🔍 DEBUG - Captured output:", output.substring(0, 500));

  return summary;
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
    const overallSummary = {
      activities: 0,
      workouts: 0,
      sleepRecords: 0,
      bodyWeightRecords: 0,
      gamesSessions: 0,
      commits: 0,
      repositories: 0,
    };

    // Run each collector
    for (const collector of COLLECTORS) {
      console.log("");
      console.log(
        `${collector.emoji} Starting ${collector.name} collection...`
      );

      try {
        const summary = await runCollector(collector.script, dateString);
        console.log(`✅ ${collector.name} collection completed successfully`);
        results.push({ ...collector, success: true, summary });

        // Accumulate summary data
        Object.keys(overallSummary).forEach((key) => {
          overallSummary[key] += summary[key] || 0;
        });
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

    // Display comprehensive recap
    console.log("");
    console.log("📊 COLLECTION RECAP");
    console.log("===================");

    if (dateInfo.valid) {
      console.log(
        `📅 Collected data for ${dateInfo.dayOfWeek}, ${dateInfo.readableDate}`
      );
    } else {
      console.log(`📅 Collected data for ${dateString}`);
    }

    console.log("");

    // Show what was collected
    let hasData = false;

    if (overallSummary.activities > 0) {
      console.log(
        `🔨 Collected ${overallSummary.activities} GitHub ${overallSummary.activities === 1 ? "activity" : "activities"}`
      );
      hasData = true;
    }
    if (overallSummary.commits > 0) {
      console.log(`   └─ Total commits: ${overallSummary.commits}`);
    }
    if (overallSummary.repositories > 0) {
      console.log(`   └─ Repositories: ${overallSummary.repositories}`);
    }

    if (overallSummary.workouts > 0) {
      console.log(
        `🏃‍♂️ Collected ${overallSummary.workouts} ${overallSummary.workouts === 1 ? "workout" : "workouts"}`
      );
      hasData = true;
    }

    if (overallSummary.sleepRecords > 0) {
      console.log(
        `😴 Collected ${overallSummary.sleepRecords} sleep ${overallSummary.sleepRecords === 1 ? "record" : "records"}`
      );
      hasData = true;
    }

    if (overallSummary.bodyWeightRecords > 0) {
      console.log(
        `⚖️ Collected ${overallSummary.bodyWeightRecords} body weight ${overallSummary.bodyWeightRecords === 1 ? "record" : "records"}`
      );
      hasData = true;
    }

    if (overallSummary.gamesSessions > 0) {
      console.log(
        `🎮 Collected ${overallSummary.gamesSessions} gaming ${overallSummary.gamesSessions === 1 ? "session" : "sessions"}`
      );
      hasData = true;
    }

    if (!hasData) {
      console.log("📭 No new data was collected");
    }

    console.log("");
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
