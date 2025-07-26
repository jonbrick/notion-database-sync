const crypto = require("crypto");
const GitHubClient = require("./lib/clients/github-client.js");
const NotionClient = require("./lib/notion/github-notion-client.js");
const {
  testConnections,
  getDateSelection,
  calculateSearchRange,
  calculateWeekSearchRange,
  closeReadline,
  askQuestion,
} = require("./lib/utils/github-cli-utils.js");

// Check for CLI arguments for non-interactive mode
const args = process.argv.slice(2);
const isNonInteractive = args.length > 0;
const cliDateInput = args[0];

// Create clients
const github = new GitHubClient({
  workRepos: ["cortexapps/brain-app"], // Add more repos here as needed: ["cortexapps/brain-app", "cortexapps/other-repo"]
});
const notion = new NotionClient();

// Function to parse DD-MM-YY date format
function parseDateDDMMYY(dateString) {
  const dateRegex = /^(\d{1,2})-(\d{1,2})-(\d{2})$/;
  const match = dateString.match(dateRegex);

  if (!match) {
    throw new Error("Invalid format. Please use DD-MM-YY (e.g., 15-03-25)");
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
    throw new Error("Invalid date. Please check day, month, and year.");
  }

  return date;
}

async function main() {
  console.log("🔨 GitHub Activity Collector 2025\n");

  // Test connections
  await testConnections({ github, notion });

  let weekStart, weekEnd, dateRangeLabel, selectedDate, optionInput;

  if (isNonInteractive) {
    // Non-interactive mode with CLI argument
    try {
      selectedDate = parseDateDDMMYY(cliDateInput);
      optionInput = "1"; // Force single day mode
      dateRangeLabel = `Date: ${selectedDate.toDateString()}`;

      console.log(
        `📊 Collecting GitHub activity for Date ${selectedDate.toDateString()} (Eastern)`
      );
      console.log(`📅 Eastern Date: ${selectedDate.toDateString()}`);
      console.log(
        `📱 GitHub Date (UTC): ${selectedDate.toDateString()} (${
          selectedDate.toISOString().split("T")[0]
        })\n`
      );
    } catch (error) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  } else {
    // Interactive mode (original behavior)
    const dateSelection = await getDateSelection();
    weekStart = dateSelection.weekStart;
    weekEnd = dateSelection.weekEnd;
    dateRangeLabel = dateSelection.dateRangeLabel;
    selectedDate = dateSelection.selectedDate;
    optionInput = dateSelection.optionInput;
  }

  if (optionInput === "1") {
    if (!isNonInteractive) {
      console.log(
        `\n📊 Collecting GitHub activity for Date ${selectedDate.toDateString()} (Eastern)`
      );
      console.log(`📅 Eastern Date: ${selectedDate.toDateString()}`);
      console.log(
        `📱 GitHub Date (UTC): ${selectedDate.toDateString()} (${
          selectedDate.toISOString().split("T")[0]
        })\n`
      );

      console.log("📋 Summary:");
      console.log("📊 Single day operation");
      console.log(`📅 Eastern Date: ${selectedDate.toDateString()}`);
      console.log(
        `📱 GitHub Date (UTC): ${selectedDate.toDateString()} (${
          selectedDate.toISOString().split("T")[0]
        })\n`
      );

      const searchRange = calculateSearchRange(selectedDate);
      console.log("🔍 Search Details:");
      console.log(`   EST date requested: ${selectedDate.toDateString()}`);
      console.log(
        `   EST day boundaries: ${searchRange.estStartOfDay.toLocaleString(
          "en-US",
          { timeZone: "America/New_York" }
        )} to ${searchRange.estEndOfDay.toLocaleString("en-US", {
          timeZone: "America/New_York",
        })}`
      );
      console.log(
        `   UTC search range: ${searchRange.startUTC.toISOString()} to ${searchRange.endUTC.toISOString()}\n`
      );

      const proceed = await askQuestion(
        "? Proceed with collecting GitHub activity for this period? (y/n): "
      );
      if (proceed.toLowerCase() !== "y") {
        console.log("❌ Operation cancelled");
        process.exit(0);
      }
    }

    console.log(
      `🔄 Fetching GitHub dates ${
        selectedDate.toISOString().split("T")[0]
      } to ${
        selectedDate.toISOString().split("T")[0]
      } for Date ${selectedDate.toDateString()} - ${selectedDate.toDateString()}`
    );
  } else {
    if (!isNonInteractive) {
      console.log(`\n📊 Collecting GitHub activity for ${dateRangeLabel}`);
      console.log(
        `📅 Date range: ${weekStart.toDateString()} - ${weekEnd.toDateString()}\n`
      );

      // Add confirmation step for week selection
      const weekSearchRange = calculateWeekSearchRange(weekStart, weekEnd);
      console.log("🔍 Search Details:");
      console.log(`   Week requested: ${dateRangeLabel}`);
      console.log(
        `   EST week boundaries: ${weekStart.toDateString()} to ${weekEnd.toDateString()}`
      );
      console.log(
        `   UTC search range: ${weekSearchRange.startUTC.toISOString()} to ${weekSearchRange.endUTC.toISOString()}\n`
      );

      const proceed = await askQuestion(
        "? Proceed with collecting GitHub activity for this period? (y/n): "
      );
      if (proceed.toLowerCase() !== "y") {
        console.log("❌ Operation cancelled");
        process.exit(0);
      }
    }
  }

  // Don't call closeReadline in CLI mode to avoid hanging
  if (!isNonInteractive) {
    closeReadline();
  }

  // Fetch activities from GitHub
  let activities;
  if (optionInput === "1") {
    // Use UTC boundaries for single date
    const searchRange = calculateSearchRange(selectedDate);
    activities = await github.getActivities(
      searchRange.startUTC,
      searchRange.endUTC
    );
    // Filter to only activities matching the requested EST date
    const requestedEstDateStr = searchRange.estStartOfDay
      .toISOString()
      .split("T")[0];
    activities = activities.filter((a) => a.date === requestedEstDateStr);
    console.log(
      `🔍 Filtered to ${activities.length} activities for EST date ${requestedEstDateStr}`
    );
  } else {
    // Use UTC boundaries for week selection
    const weekSearchRange = calculateWeekSearchRange(weekStart, weekEnd);
    activities = await github.getActivities(
      weekSearchRange.startUTC,
      weekSearchRange.endUTC
    );
    console.log(
      `🔍 Using UTC week range: ${weekSearchRange.startUTC.toISOString()} to ${weekSearchRange.endUTC.toISOString()}`
    );

    // Filter activities to only include those within the selected week boundaries
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    const originalCount = activities.length;
    activities = activities.filter((activity) => {
      const activityDate = activity.date; // This is already in EST format YYYY-MM-DD
      return activityDate >= weekStartStr && activityDate <= weekEndStr;
    });

    if (originalCount !== activities.length) {
      console.log(
        `🔍 Filtered from ${originalCount} to ${activities.length} activities within week ${weekStartStr} to ${weekEndStr}`
      );
    }
  }

  if (activities.length === 0) {
    // Create date range string for the no data message
    let noDataDateRangeStr;
    if (optionInput === "1") {
      noDataDateRangeStr = selectedDate.toDateString();
    } else {
      // Extract week number from the dateRangeLabel
      const weekMatch = dateRangeLabel.match(/Week (\d+)/);
      const weekNumber = weekMatch ? weekMatch[1] : "";
      noDataDateRangeStr = `Week ${weekNumber} (${weekStart.toDateString()} - ${weekEnd.toDateString()})`;
    }

    console.log(`📭 No GitHub activity found for ${noDataDateRangeStr}`);
    return;
  }

  if (optionInput === "1") {
    if (!isNonInteractive) {
      console.log(
        `🔄 Fetching GitHub activity from ${
          selectedDate.toISOString().split("T")[0]
        } to ${selectedDate.toISOString().split("T")[0]}`
      );
    }
  }

  console.log(`🔨 Found ${activities.length} repositories with activity\n`);

  console.log("🔨 Processing GitHub activities:");
  let savedCount = 0;
  let skippedCount = 0;

  for (const activity of activities) {
    try {
      console.log(
        `🔄 Processing activity: ${activity.repository} - ${activity.date} - ${activity.commitsCount} commits`
      );
      const result = await notion.createWorkoutRecord(activity);

      if (result === null) {
        // Record was skipped (duplicate)
        skippedCount++;
        if (optionInput === "1") {
          console.log(
            `⏭️  Skipped Eastern ${selectedDate.toDateString()}: ${activity.repository} | ${activity.commitsCount} commits | ${activity.totalChanges} changes`
          );
        } else {
          console.log(
            `⏭️  Skipped ${activity.repository}: ${activity.commitsCount} commits | ${activity.totalChanges} changes`
          );
        }
      } else {
        // Record was created
        savedCount++;
        if (optionInput === "1") {
          console.log(
            `✅ Saved Eastern ${selectedDate.toDateString()}: ${activity.repository} | ${activity.commitsCount} commits | ${activity.totalChanges} changes`
          );
        } else {
          console.log(
            `✅ Saved ${activity.repository}: ${activity.commitsCount} commits | ${activity.totalChanges} changes`
          );
        }
      }
    } catch (error) {
      console.error(`❌ Failed to save ${activity.repository}:`, error.message);
    }
  }

  // Create date range string for the success message
  let dateRangeStr;
  if (optionInput === "1") {
    dateRangeStr = selectedDate.toDateString();
  } else {
    // Extract week number from the dateRangeLabel
    const weekMatch = dateRangeLabel.match(/Week (\d+)/);
    const weekNumber = weekMatch ? weekMatch[1] : "";
    dateRangeStr = `Week ${weekNumber} (${weekStart.toDateString()} - ${weekEnd.toDateString()})`;
  }

  console.log(
    `\n✅ Successfully processed GitHub activities for ${dateRangeStr}!`
  );
  console.log(
    `📊 Summary: ${savedCount} new records created, ${skippedCount} duplicates skipped`
  );
}

main().catch(console.error);
