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

// Create clients
const github = new GitHubClient({
  workRepos: ["cortexapps/brain-app"], // Add more repos here as needed: ["cortexapps/brain-app", "cortexapps/other-repo"]
});
const notion = new NotionClient();

async function main() {
  console.log("🔨 GitHub Activity Collector 2025\n");

  // Test connections
  await testConnections({ github, notion });

  // Get date selection
  const { weekStart, weekEnd, dateRangeLabel, selectedDate, optionInput } =
    await getDateSelection();

  if (optionInput === "1") {
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

    console.log(
      `🔄 Fetching GitHub dates ${
        selectedDate.toISOString().split("T")[0]
      } to ${
        selectedDate.toISOString().split("T")[0]
      } for Date ${selectedDate.toDateString()} - ${selectedDate.toDateString()}`
    );
  } else {
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

  closeReadline();

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
    console.log(
      `🔄 Fetching GitHub activity from ${
        selectedDate.toISOString().split("T")[0]
      } to ${selectedDate.toISOString().split("T")[0]}`
    );
  }

  console.log(`🔨 Found ${activities.length} repositories with activity\n`);

  console.log("🔨 Processing GitHub activities:");
  let savedCount = 0;

  for (const activity of activities) {
    try {
      console.log(
        `🔄 Processing activity: ${activity.repository} - ${activity.date} - ${activity.commitsCount} commits`
      );
      await notion.createWorkoutRecord(activity);
      savedCount++;

      if (optionInput === "1") {
        console.log(
          `✅ Processing Eastern Date ${selectedDate.toDateString()} from GitHub Date ${
            activity.date
          }`
        );
        console.log(
          `✅ Created GitHub record for Eastern Date: ${selectedDate.toDateString()} (GitHub Date: ${
            activity.date
          })`
        );
        console.log(
          `✅ Saved Eastern ${selectedDate.toDateString()}: ${
            activity.repository
          } | ${activity.commitsCount} commits | ${
            activity.totalChanges
          } changes`
        );
      } else {
        console.log(
          `✅ Saved ${activity.repository}: ${activity.commitsCount} commits | ${activity.totalChanges} changes`
        );
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
    `\n✅ Successfully saved ${savedCount} GitHub activities to Notion for ${dateRangeStr}!`
  );
}

main().catch(console.error);
