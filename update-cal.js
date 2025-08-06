const { Client } = require("@notionhq/client");
const { google } = require("googleapis");
const {
  testConnections,
  getDateSelection,
  closeReadline,
  askQuestion,
  generateWeekSummary,
} = require("./lib/calendar/cli-utils.js");
require("dotenv").config();

class NotionClient {
  constructor() {
    this.notion = new Client({ auth: process.env.NOTION_TOKEN });
    this.prsDbId = process.env.NOTION_PRS_DATABASE_ID;
    this.workoutsDbId = process.env.NOTION_WORKOUTS_DATABASE_ID;
    this.sleepDbId = process.env.NOTION_SLEEP_DATABASE_ID;
    this.bodyWeightDbId = process.env.NOTION_BODY_WEIGHT_DATABASE_ID;
    this.videoGamesDbId = process.env.NOTION_VIDEO_GAMES_DATABASE_ID;
  }

  async testConnection() {
    try {
      const response = await this.notion.databases.retrieve({
        database_id: this.prsDbId,
      });
      console.log("✅ Notion connection successful!");
      return true;
    } catch (error) {
      console.error("❌ Notion connection failed:", error.message);
      return false;
    }
  }

  async getGitHubActivitiesForWeek(weekStart, weekEnd) {
    try {
      const startDateStr = weekStart.toISOString().split("T")[0];
      // Just use the date portion to avoid any timezone/rounding issues
      const endDate = new Date(weekEnd);
      endDate.setHours(0, 0, 0, 0);
      const endDateStr = endDate.toISOString().split("T")[0];

      console.log(
        `🔄 Reading GitHub activities from ${startDateStr} to ${endDateStr}`
      );

      const response = await this.notion.databases.query({
        database_id: this.prsDbId,
        filter: {
          and: [
            {
              property: "Date",
              date: { on_or_after: startDateStr },
            },
            {
              property: "Date",
              date: { on_or_before: endDateStr },
            },
            {
              property: "Calendar Created",
              checkbox: { equals: false },
            },
          ],
        },
        sorts: [{ property: "Date", direction: "ascending" }],
      });

      console.log(
        `📊 Found ${response.results.length} GitHub activities without calendar events`
      );
      return this.transformNotionToActivities(response.results);
    } catch (error) {
      console.error("❌ Error reading GitHub activities:", error.message);
      return [];
    }
  }

  transformNotionToActivities(notionPages) {
    return notionPages.map((page) => {
      const props = page.properties;
      return {
        id: page.id,
        repository:
          props["Repository"]?.title?.[0]?.plain_text || "Unknown Repository",
        date: props["Date"]?.date?.start,
        commitsCount: props["Commits Count"]?.number || 0,
        projectType: props["Project Type"]?.select?.name || "Personal",
        commitMessages:
          props["Commit Messages"]?.rich_text?.[0]?.plain_text || "",
        prTitles: props["PR Titles"]?.rich_text?.[0]?.plain_text || "",
        totalLinesAdded: props["Lines Added"]?.number || 0,
        totalLinesDeleted: props["Lines Deleted"]?.number || 0,
        totalChanges:
          (props["Lines Added"]?.number || 0) +
          (props["Lines Deleted"]?.number || 0),
      };
    });
  }

  async markCalendarCreated(activityId) {
    try {
      await this.notion.pages.update({
        page_id: activityId,
        properties: {
          "Calendar Created": { checkbox: true },
        },
      });
    } catch (error) {
      console.error("❌ Error marking calendar created:", error.message);
    }
  }

  async getWorkoutsForWeek(weekStart, weekEnd) {
    try {
      const startDateStr = weekStart.toISOString().split("T")[0];
      // Just use the date portion to avoid any timezone/rounding issues
      const endDate = new Date(weekEnd);
      endDate.setHours(0, 0, 0, 0);
      const endDateStr = endDate.toISOString().split("T")[0];

      console.log(`🔄 Reading workouts from ${startDateStr} to ${endDateStr}`);

      const response = await this.notion.databases.query({
        database_id: this.workoutsDbId,
        filter: {
          and: [
            {
              property: "Date",
              date: { on_or_after: startDateStr },
            },
            {
              property: "Date",
              date: { on_or_before: endDateStr },
            },
            {
              property: "Calendar Created",
              checkbox: { equals: false },
            },
          ],
        },
        sorts: [{ property: "Date", direction: "ascending" }],
      });

      console.log(
        `📊 Found ${response.results.length} workouts without calendar events`
      );
      return this.transformNotionToWorkouts(response.results);
    } catch (error) {
      console.error("❌ Error reading workouts:", error.message);
      return [];
    }
  }

  transformNotionToWorkouts(notionPages) {
    return notionPages.map((page) => {
      const props = page.properties;
      return {
        id: page.id,
        activityName:
          props["Activity Name"]?.title?.[0]?.plain_text || "Workout",
        date: props["Date"]?.date?.start,
        activityType: props["Activity Type"]?.select?.name || "Workout",
        startTime: props["Start Time"]?.rich_text?.[0]?.plain_text || "",
        duration: props["Duration"]?.number || 0,
        distance: props["Distance"]?.number || 0,
      };
    });
  }

  async markWorkoutCalendarCreated(workoutId) {
    try {
      await this.notion.pages.update({
        page_id: workoutId,
        properties: {
          "Calendar Created": { checkbox: true },
        },
      });
    } catch (error) {
      console.error(
        "❌ Error marking workout calendar created:",
        error.message
      );
    }
  }

  async getSleepForWeek(weekStart, weekEnd) {
    try {
      const startDateStr = weekStart.toISOString().split("T")[0];
      // Just use the date portion to avoid any timezone/rounding issues
      const endDate = new Date(weekEnd);
      endDate.setHours(0, 0, 0, 0);
      const endDateStr = endDate.toISOString().split("T")[0];

      console.log(
        `🔄 Reading sleep records from ${startDateStr} to ${endDateStr}`
      );

      const response = await this.notion.databases.query({
        database_id: this.sleepDbId,
        filter: {
          and: [
            {
              property: "Night of Date",
              date: { on_or_after: startDateStr },
            },
            {
              property: "Night of Date",
              date: { on_or_before: endDateStr },
            },
            {
              property: "Calendar Created",
              checkbox: { equals: false },
            },
          ],
        },
        sorts: [{ property: "Night of Date", direction: "ascending" }],
      });

      console.log(
        `📊 Found ${response.results.length} sleep sessions without calendar events`
      );

      return this.transformNotionToSleep(response.results);
    } catch (error) {
      console.error("❌ Error reading sleep records:", error.message);
      return [];
    }
  }

  transformNotionToSleep(notionPages) {
    return notionPages.map((page) => {
      const props = page.properties;
      return {
        id: page.id,
        nightOf: props["Night of"]?.title?.[0]?.plain_text,
        nightOfDate: props["Night of Date"]?.date?.start,
        bedtime: props["Bedtime"]?.rich_text?.[0]?.plain_text,
        wakeTime: props["Wake Time"]?.rich_text?.[0]?.plain_text,
        sleepDuration: props["Sleep Duration"]?.number || 0,
        deepSleep: props["Deep Sleep"]?.number || 0,
        remSleep: props["REM Sleep"]?.number || 0,
        lightSleep: props["Light Sleep"]?.number || 0,
        efficiency: props["Efficiency"]?.number || 0,
        googleCalendar: props["Google Calendar"]?.select?.name || "Sleep In",
      };
    });
  }

  async markSleepCalendarCreated(sleepId) {
    try {
      await this.notion.pages.update({
        page_id: sleepId,
        properties: {
          "Calendar Created": { checkbox: true },
        },
      });
    } catch (error) {
      console.error("❌ Error marking sleep calendar created:", error.message);
    }
  }

  async getBodyWeightForWeek(weekStart, weekEnd) {
    try {
      const startDateStr = weekStart.toISOString().split("T")[0];
      // Just use the date portion to avoid any timezone/rounding issues
      const endDate = new Date(weekEnd);
      endDate.setHours(0, 0, 0, 0);
      const endDateStr = endDate.toISOString().split("T")[0];

      console.log(
        `🔄 Reading body weight records from ${startDateStr} to ${endDateStr}`
      );

      const response = await this.notion.databases.query({
        database_id: this.bodyWeightDbId,
        filter: {
          and: [
            {
              property: "Date",
              date: { on_or_after: startDateStr },
            },
            {
              property: "Date",
              date: { on_or_before: endDateStr },
            },
            {
              property: "Calendar Created",
              checkbox: { equals: false },
            },
          ],
        },
        sorts: [{ property: "Date", direction: "ascending" }],
      });

      console.log(
        `📊 Found ${response.results.length} body weight records without calendar events`
      );

      return this.transformNotionToBodyWeight(response.results);
    } catch (error) {
      console.error("❌ Error reading body weight records:", error.message);
      return [];
    }
  }

  transformNotionToBodyWeight(notionPages) {
    return notionPages.map((page) => {
      const props = page.properties;
      return {
        id: page.id,
        date: props["Date"]?.date?.start,
        weight: props["Weight"]?.number || 0,
        weightUnit: props["Weight Unit"]?.select?.name || "lbs",
        measurementTime: props["Time"]?.rich_text?.[0]?.plain_text || "",
        notes: props["Notes"]?.rich_text?.[0]?.plain_text || "",
      };
    });
  }

  async markBodyWeightCalendarCreated(bodyWeightId) {
    try {
      await this.notion.pages.update({
        page_id: bodyWeightId,
        properties: {
          "Calendar Created": { checkbox: true },
        },
      });
    } catch (error) {
      console.error(
        "❌ Error marking body weight calendar created:",
        error.message
      );
    }
  }

  async getVideoGamesForWeek(weekStart, weekEnd) {
    try {
      const startDateStr = weekStart.toISOString().split("T")[0];
      const endDate = new Date(weekEnd);
      endDate.setHours(0, 0, 0, 0);
      const endDateStr = endDate.toISOString().split("T")[0];

      console.log(
        `🔄 Reading video game sessions from ${startDateStr} to ${endDateStr}`
      );

      const response = await this.notion.databases.query({
        database_id: this.videoGamesDbId,
        filter: {
          and: [
            { property: "Date", date: { on_or_after: startDateStr } },
            { property: "Date", date: { on_or_before: endDateStr } },
            { property: "Calendar Created", checkbox: { equals: false } },
          ],
        },
        sorts: [{ property: "Date", direction: "ascending" }],
      });

      console.log(
        `📊 Found ${response.results.length} gaming sessions without calendar events`
      );
      return this.transformNotionToVideoGames(response.results);
    } catch (error) {
      console.error("❌ Error reading video game sessions:", error.message);
      return [];
    }
  }

  transformNotionToVideoGames(notionPages) {
    return notionPages.map((page) => {
      const props = page.properties;
      const hoursPlayed = props["Hours Played"]?.number || 0;
      const minutesPlayed = props["Minutes Played"]?.number || 0;
      const totalMinutes = hoursPlayed * 60 + minutesPlayed;

      return {
        id: page.id,
        gameName: props["Game Name"]?.title?.[0]?.plain_text || "Unknown Game",
        date: props["Date"]?.date?.start,
        hoursPlayed: hoursPlayed,
        minutesPlayed: minutesPlayed,
        totalMinutes: totalMinutes,
        sessionCount: props["Session Count"]?.number || 1,
        sessionDetails:
          props["Session Details"]?.rich_text?.[0]?.plain_text || "",
        startTime: props["Start Time"]?.rich_text?.[0]?.plain_text || "",
        endTime: props["End Time"]?.rich_text?.[0]?.plain_text || "",
        platform: props["Platform"]?.select?.name || "Steam",
        activityId: props["Activity ID"]?.rich_text?.[0]?.plain_text || "",
      };
    });
  }

  async markVideoGameCalendarCreated(gameSessionId) {
    try {
      await this.notion.pages.update({
        page_id: gameSessionId,
        properties: {
          "Calendar Created": { checkbox: true },
        },
      });
    } catch (error) {
      console.error(
        "❌ Error marking video game calendar created:",
        error.message
      );
    }
  }
}

class CalendarClient {
  constructor() {
    const redirectUri = "urn:ietf:wg:oauth:2.0:oob"; // Out-of-band URI for desktop apps

    this.personalAuth = new google.auth.OAuth2(
      process.env.PERSONAL_GOOGLE_CLIENT_ID,
      process.env.PERSONAL_GOOGLE_CLIENT_SECRET,
      redirectUri
    );
    this.personalAuth.setCredentials({
      refresh_token: process.env.PERSONAL_GOOGLE_REFRESH_TOKEN,
    });

    // Work account auth
    this.workAuth = new google.auth.OAuth2(
      process.env.WORK_GOOGLE_CLIENT_ID,
      process.env.WORK_GOOGLE_CLIENT_SECRET,
      redirectUri
    );
    this.workAuth.setCredentials({
      refresh_token: process.env.WORK_GOOGLE_REFRESH_TOKEN,
    });

    this.personalCalendar = google.calendar({
      version: "v3",
      auth: this.personalAuth,
    });
    this.workCalendar = google.calendar({
      version: "v3",
      auth: this.workAuth,
    });

    this.prsPersonalCalendarId = process.env.PRS_PERSONAL_CALENDAR_ID;
    this.prsWorkCalendarId = process.env.PRS_WORK_CALENDAR_ID;
    this.fitnessCalendarId = process.env.FITNESS_CALENDAR_ID;
    this.normalWakeUpCalendarId = process.env.NORMAL_WAKE_UP_CALENDAR_ID;
    this.sleepInCalendarId = process.env.SLEEP_IN_CALENDAR_ID;
    this.bodyWeightCalendarId = process.env.BODY_WEIGHT_CALENDAR_ID;
    this.videoGamesCalendarId = process.env.VIDEO_GAMES_CALENDAR_ID;
  }

  async testConnection() {
    try {
      const calendars = await this.personalCalendar.calendarList.list();
      console.log("✅ Google Calendar connection successful!");
      console.log(`📅 Found ${calendars.data.items.length} calendars`);
      return true;
    } catch (error) {
      console.error("❌ Calendar connection failed:", error.message);
      return false;
    }
  }

  async createGitHubEvent(activity) {
    try {
      // Use personal PRs calendar for personal repos
      const calendarId = this.prsPersonalCalendarId;

      // Create all-day event
      const eventDate = activity.date; // YYYY-MM-DD format
      const title = this.formatGitHubEventTitle(activity);
      const description = this.formatGitHubEventDescription(activity);

      const event = {
        summary: title,
        description: description,
        start: { date: eventDate },
        end: { date: eventDate },
      };

      const response = await this.personalCalendar.events.insert({
        calendarId: calendarId,
        resource: event,
      });

      console.log(`✅ Created Personal GitHub calendar event: ${title}`);
      return response;
    } catch (error) {
      console.error("❌ Error creating GitHub calendar event:", error.message);
      throw error;
    }
  }

  async createWorkGitHubEvent(activity) {
    try {
      // Use work PRs calendar for work repos
      const calendarId = this.prsWorkCalendarId;

      // Create all-day event
      const eventDate = activity.date; // YYYY-MM-DD format
      const title = this.formatGitHubEventTitle(activity);
      const description = this.formatGitHubEventDescription(activity);

      const event = {
        summary: title,
        description: description,
        start: { date: eventDate },
        end: { date: eventDate },
      };

      const response = await this.workCalendar.events.insert({
        calendarId: calendarId,
        resource: event,
      });

      console.log(`✅ Created Work GitHub calendar event: ${title}`);
      return response;
    } catch (error) {
      console.error(
        "❌ Error creating Work GitHub calendar event:",
        error.message
      );
      throw error;
    }
  }

  formatGitHubEventTitle(activity) {
    const repoName = activity.repository.split("/")[1] || activity.repository;
    const linesInfo =
      activity.totalChanges > 0
        ? ` (+${activity.totalLinesAdded}/-${activity.totalLinesDeleted} lines)`
        : "";
    return `${repoName}: ${activity.commitsCount} commits${linesInfo}`;
  }

  formatGitHubEventDescription(activity) {
    let description = `💻 ${activity.repository}\n`;
    description += `📊 ${activity.commitsCount} commits\n`;
    if (activity.totalChanges > 0) {
      description += `📈 +${activity.totalLinesAdded}/-${activity.totalLinesDeleted} lines\n`;
    }

    if (activity.prTitles && activity.prTitles.trim()) {
      description += `🔀 PR: ${activity.prTitles}\n`;
    } else {
      description += `🔀 PR: None\n`;
    }

    description += `\n📝 Commits:\n${activity.commitMessages}`;
    return description;
  }

  async createWorkoutEvent(workout) {
    try {
      // Parse the start time - handle both ISO strings and basic formats
      let startTime;
      if (workout.startTime && workout.startTime.includes("T")) {
        startTime = new Date(workout.startTime);
      } else {
        // Default to noon on the workout date
        startTime = new Date(workout.date + "T12:00:00");
      }

      const endTime = new Date(
        startTime.getTime() + (workout.duration || 30) * 60 * 1000
      );

      const title = this.formatWorkoutEventTitle(workout);
      const description = this.formatWorkoutEventDescription(workout);

      const event = {
        summary: title,
        description: description,
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
      };

      const response = await this.personalCalendar.events.insert({
        calendarId: this.fitnessCalendarId,
        resource: event,
      });

      console.log(`✅ Created workout calendar event: ${title}`);
      return response;
    } catch (error) {
      console.error("❌ Error creating workout calendar event:", error.message);
      throw error;
    }
  }

  formatWorkoutEventTitle(workout) {
    if (workout.distance > 0) {
      return `${workout.activityType} - ${workout.distance} miles`;
    } else {
      return workout.activityName;
    }
  }

  formatWorkoutEventDescription(workout) {
    let description = `🏃‍♂️ ${workout.activityName}\n`;
    description += `⏱️ Duration: ${workout.duration} minutes\n`;

    if (workout.distance > 0) {
      description += `📏 Distance: ${workout.distance} miles\n`;
    }

    description += `📊 Activity Type: ${workout.activityType}`;
    return description;
  }

  async createSleepEvent(sleepRecord) {
    try {
      // Parse bedtime and wake time
      const bedtime = new Date(sleepRecord.bedtime);
      const wakeTime = new Date(sleepRecord.wakeTime);

      const title = this.formatSleepEventTitle(sleepRecord);
      const description = this.formatSleepEventDescription(sleepRecord);

      // Choose calendar based on wake time category
      const calendarId =
        sleepRecord.googleCalendar === "Normal Wake Up"
          ? this.normalWakeUpCalendarId
          : this.sleepInCalendarId;

      const event = {
        summary: title,
        description: description,
        start: { dateTime: bedtime.toISOString() },
        end: { dateTime: wakeTime.toISOString() },
      };

      const response = await this.personalCalendar.events.insert({
        calendarId: calendarId,
        resource: event,
      });

      console.log(
        `✅ Created sleep calendar event: ${title} (${sleepRecord.googleCalendar})`
      );
      return response;
    } catch (error) {
      console.error("❌ Error creating sleep calendar event:", error.message);
      throw error;
    }
  }

  formatSleepEventTitle(sleepRecord) {
    return `Sleep - ${sleepRecord.sleepDuration}hrs (${sleepRecord.efficiency}% efficiency)`;
  }

  formatSleepEventDescription(sleepRecord) {
    let description = `😴 ${sleepRecord.nightOf}\n`;
    description += `⏱️ Duration: ${sleepRecord.sleepDuration} hours\n`;
    description += `📊 Efficiency: ${sleepRecord.efficiency}%\n\n`;

    description += `🛌 Sleep Stages:\n`;
    description += `• Deep Sleep: ${sleepRecord.deepSleep} min\n`;
    description += `• REM Sleep: ${sleepRecord.remSleep} min\n`;
    description += `• Light Sleep: ${sleepRecord.lightSleep} min\n\n`;

    return description;
  }

  async createBodyWeightEvent(bodyWeightRecord) {
    try {
      // Create all-day event for body weight
      const eventDate = bodyWeightRecord.date; // YYYY-MM-DD format
      const title = this.formatBodyWeightEventTitle(bodyWeightRecord);
      const description =
        this.formatBodyWeightEventDescription(bodyWeightRecord);

      const event = {
        summary: title,
        description: description,
        start: { date: eventDate },
        end: { date: eventDate },
      };

      const response = await this.personalCalendar.events.insert({
        calendarId: this.bodyWeightCalendarId,
        resource: event,
      });

      console.log(`✅ Created body weight calendar event: ${title}`);
      return response;
    } catch (error) {
      console.error(
        "❌ Error creating body weight calendar event:",
        error.message
      );
      throw error;
    }
  }

  formatBodyWeightEventTitle(bodyWeightRecord) {
    return `Weight: ${bodyWeightRecord.weight} ${bodyWeightRecord.weightUnit}`;
  }

  formatBodyWeightEventDescription(bodyWeightRecord) {
    let description = `⚖️ Body Weight Measurement\n`;
    description += `📊 Weight: ${bodyWeightRecord.weight} ${bodyWeightRecord.weightUnit}\n`;

    if (bodyWeightRecord.measurementTime) {
      description += `⏰ Time: ${bodyWeightRecord.measurementTime}\n`;
    }

    if (bodyWeightRecord.notes && bodyWeightRecord.notes.trim()) {
      description += `📝 Notes: ${bodyWeightRecord.notes}\n`;
    }

    description += `🔗 Source: Withings`;
    return description;
  }

  async createVideoGameEvent(gameSession) {
    try {
      // Parse start and end times
      let startDateTime, endDateTime;

      if (gameSession.startTime && gameSession.endTime) {
        // Check if times are already full ISO strings (contain 'T')
        if (
          gameSession.startTime.includes("T") &&
          gameSession.endTime.includes("T")
        ) {
          // They're already full datetime strings, use them directly
          startDateTime = new Date(gameSession.startTime);
          endDateTime = new Date(gameSession.endTime);
        } else {
          // They're just time portions, concatenate with date
          startDateTime = new Date(
            `${gameSession.date}T${gameSession.startTime}`
          );
          endDateTime = new Date(`${gameSession.date}T${gameSession.endTime}`);
        }
      } else {
        // Fallback: create event based on date and duration
        startDateTime = new Date(`${gameSession.date}T19:00:00`); // Default 7 PM
        endDateTime = new Date(
          startDateTime.getTime() + gameSession.totalMinutes * 60 * 1000
        );
      }

      const title = this.formatVideoGameEventTitle(gameSession);
      const description = this.formatVideoGameEventDescription(gameSession);

      const event = {
        summary: title,
        description: description,
        start: { dateTime: startDateTime.toISOString() },
        end: { dateTime: endDateTime.toISOString() },
      };

      const response = await this.personalCalendar.events.insert({
        calendarId: this.videoGamesCalendarId,
        resource: event,
      });

      console.log(`✅ Created video game calendar event: ${title}`);
      return response;
    } catch (error) {
      console.error(
        "❌ Error creating video game calendar event:",
        error.message
      );
      throw error;
    }
  }

  formatVideoGameEventTitle(gameSession) {
    const duration =
      gameSession.hoursPlayed > 0
        ? `${gameSession.hoursPlayed}h ${gameSession.minutesPlayed}m`
        : `${gameSession.minutesPlayed}m`;

    return `🎮 ${gameSession.gameName} - ${duration}`;
  }

  formatVideoGameEventDescription(gameSession) {
    let description = `🎮 ${gameSession.gameName}\n`;
    description += `⏱️ Duration: ${gameSession.hoursPlayed}h ${gameSession.minutesPlayed}m\n`;
    description += `🎯 Sessions: ${gameSession.sessionCount}\n`;
    description += `🖥️ Platform: ${gameSession.platform}\n`;

    if (gameSession.sessionDetails && gameSession.sessionDetails.trim()) {
      description += `\n📝 Session Details:\n${gameSession.sessionDetails}\n`;
    }

    if (gameSession.activityId) {
      description += `\n🔗 Activity ID: ${gameSession.activityId}`;
    }

    return description;
  }
}

async function syncGitHubWork(
  weekStart,
  weekEnd,
  selectedDate,
  optionInput,
  dateRangeLabel,
  dryRun = false
) {
  console.log("💼 GitHub Work Sync\n");

  const notion = new NotionClient();
  const calendar = new CalendarClient();

  // Test connections
  await testConnections({ notion, calendar });

  if (optionInput === "1") {
    console.log(
      `\n📊 Syncing Work GitHub activities for Date ${selectedDate.toDateString()}`
    );
  } else {
    console.log(
      `\n📊 Syncing Work GitHub activities from ${weekStart.toDateString()} to ${weekEnd.toDateString()}`
    );
  }

  const activities = await notion.getGitHubActivitiesForWeek(
    weekStart,
    weekEnd
  );

  if (activities.length === 0) {
    console.log("📭 No GitHub activities found without calendar events");
    return;
  }

  // Filter to work repos only
  const workActivities = activities.filter(
    (activity) => activity.projectType === "Work"
  );

  console.log(
    `🔍 Found ${workActivities.length} work GitHub activities to sync`
  );

  let createdCount = 0;
  for (const activity of workActivities) {
    try {
      if (dryRun) {
        // In dry run mode, just show what would be created
        const title = calendar.formatGitHubEventTitle(activity);
        console.log(
          `🧪 Would create: ${title} for ${activity.repository} (${activity.commitsCount} commits)`
        );
        createdCount++;
      } else {
        // Normal mode - actually create the event
        await calendar.createWorkGitHubEvent(activity);
        await notion.markCalendarCreated(activity.id);
        createdCount++;
        console.log(
          `✅ Synced: ${activity.repository} (${activity.commitsCount} commits)`
        );
      }
    } catch (error) {
      console.error(`❌ Failed to sync ${activity.repository}:`, error.message);
    }
  }

  const actionText = dryRun ? "Would sync" : "Successfully synced";
  console.log(
    `\n${
      dryRun ? "🧪" : "✅"
    } ${actionText} ${createdCount} work GitHub activities!`
  );

  // Add week summary
  const summary = generateWeekSummary(
    weekStart,
    weekEnd,
    dateRangeLabel,
    optionInput
  );
  console.log(`\n${summary}`);

  // Return summary data for recap
  return {
    syncType: "GitHub Work",
    count: createdCount,
    emoji: "💼",
  };
}

async function syncGitHubPersonal(
  weekStart,
  weekEnd,
  selectedDate,
  optionInput,
  dateRangeLabel,
  dryRun = false
) {
  console.log("💻 GitHub Personal Sync\n");

  const notion = new NotionClient();
  const calendar = new CalendarClient();

  // Test connections
  await testConnections({ notion, calendar });

  if (optionInput === "1") {
    console.log(
      `\n📊 Syncing GitHub activities for Date ${selectedDate.toDateString()}`
    );
  } else {
    console.log(
      `\n📊 Syncing GitHub activities from ${weekStart.toDateString()} to ${weekEnd.toDateString()}`
    );
  }

  const activities = await notion.getGitHubActivitiesForWeek(
    weekStart,
    weekEnd
  );

  if (activities.length === 0) {
    console.log("📭 No GitHub activities found without calendar events");
    return;
  }

  // Filter to personal repos only for now
  const personalActivities = activities.filter(
    (activity) => activity.projectType === "Personal"
  );

  console.log(
    `🔍 Found ${personalActivities.length} personal GitHub activities to sync`
  );

  let createdCount = 0;
  for (const activity of personalActivities) {
    try {
      if (dryRun) {
        // In dry run mode, just show what would be created
        const title = calendar.formatGitHubEventTitle(activity);
        console.log(
          `🧪 Would create: ${title} for ${activity.repository} (${activity.commitsCount} commits)`
        );
        createdCount++;
      } else {
        // Normal mode - actually create the event
        await calendar.createGitHubEvent(activity);
        await notion.markCalendarCreated(activity.id);
        createdCount++;
        console.log(
          `✅ Synced: ${activity.repository} (${activity.commitsCount} commits)`
        );
      }
    } catch (error) {
      console.error(`❌ Failed to sync ${activity.repository}:`, error.message);
    }
  }

  const actionText = dryRun ? "Would sync" : "Successfully synced";
  console.log(
    `\n${dryRun ? "🧪" : "✅"} ${actionText} ${createdCount} GitHub activities!`
  );

  // Add week summary
  const summary = generateWeekSummary(
    weekStart,
    weekEnd,
    dateRangeLabel,
    optionInput
  );
  console.log(`\n${summary}`);

  // Return summary data for recap
  return {
    syncType: "GitHub Personal",
    count: createdCount,
    emoji: "💻",
  };
}

async function syncWorkouts(
  weekStart,
  weekEnd,
  selectedDate,
  optionInput,
  dateRangeLabel,
  dryRun = false
) {
  console.log("💪 Workout Sync\n");

  const notion = new NotionClient();
  const calendar = new CalendarClient();

  // Test connections
  await testConnections({ notion, calendar });

  if (optionInput === "1") {
    console.log(
      `\n📊 Syncing workouts for Date ${selectedDate.toDateString()}`
    );
  } else {
    console.log(
      `\n📊 Syncing workouts from ${weekStart.toDateString()} to ${weekEnd.toDateString()}`
    );
  }

  const workouts = await notion.getWorkoutsForWeek(weekStart, weekEnd);

  if (workouts.length === 0) {
    console.log("📭 No workouts found without calendar events");
    return;
  }

  console.log(`🔍 Found ${workouts.length} workouts to sync`);

  let createdCount = 0;
  for (const workout of workouts) {
    try {
      if (dryRun) {
        // In dry run mode, just show what would be created
        const title = calendar.formatWorkoutEventTitle(workout);
        console.log(
          `🧪 Would create: ${title} for ${workout.activityName} (${workout.activityType}) - ${workout.date}`
        );
        createdCount++;
      } else {
        // Normal mode - actually create the event
        await calendar.createWorkoutEvent(workout);
        await notion.markWorkoutCalendarCreated(workout.id);
        createdCount++;
        console.log(
          `✅ Synced: ${workout.activityName} (${workout.activityType}) - ${workout.date}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Failed to sync ${workout.activityName}:`,
        error.message
      );
    }
  }

  const actionText = dryRun ? "Would sync" : "Successfully synced";
  console.log(
    `\n${dryRun ? "🧪" : "✅"} ${actionText} ${createdCount} workouts!`
  );

  // Add week summary
  const summary = generateWeekSummary(
    weekStart,
    weekEnd,
    dateRangeLabel,
    optionInput
  );
  console.log(`\n${summary}`);

  // Return summary data for recap
  return {
    syncType: "Workouts",
    count: createdCount,
    emoji: "🏃‍♂️",
  };
}

async function syncSleep(
  weekStart,
  weekEnd,
  selectedDate,
  optionInput,
  dateRangeLabel,
  dryRun = false
) {
  console.log("😴 Sleep Sync\n");

  const notion = new NotionClient();
  const calendar = new CalendarClient();

  // Test connections
  await testConnections({ notion, calendar });

  if (optionInput === "1") {
    console.log(`\n📊 Syncing sleep for Date ${selectedDate.toDateString()}`);
  } else {
    console.log(
      `\n📊 Syncing sleep from ${weekStart.toDateString()} to ${weekEnd.toDateString()}`
    );
  }

  const sleepRecords = await notion.getSleepForWeek(weekStart, weekEnd);

  if (sleepRecords.length === 0) {
    console.log("📭 No sleep records found without calendar events");
    return;
  }

  console.log(`🔍 Found ${sleepRecords.length} sleep records to sync`);

  let createdCount = 0;
  for (const sleepRecord of sleepRecords) {
    try {
      if (dryRun) {
        // In dry run mode, just show what would be created
        const title = calendar.formatSleepEventTitle(sleepRecord);
        console.log(
          `🧪 Would create: ${title} for ${sleepRecord.nightOf} (${sleepRecord.sleepDuration}hrs)`
        );
        createdCount++;
      } else {
        // Normal mode - actually create the event
        await calendar.createSleepEvent(sleepRecord);
        await notion.markSleepCalendarCreated(sleepRecord.id);
        createdCount++;
        console.log(
          `✅ Synced: ${sleepRecord.nightOf} (${sleepRecord.sleepDuration}hrs)`
        );
      }
    } catch (error) {
      console.error(`❌ Failed to sync ${sleepRecord.nightOf}:`, error.message);
    }
  }

  const actionText = dryRun ? "Would sync" : "Successfully synced";
  console.log(
    `\n${dryRun ? "🧪" : "✅"} ${actionText} ${createdCount} sleep records!`
  );

  // Add week summary
  const summary = generateWeekSummary(
    weekStart,
    weekEnd,
    dateRangeLabel,
    optionInput
  );
  console.log(`\n${summary}`);

  // Return summary data for recap
  return {
    syncType: "Sleep Records",
    count: createdCount,
    emoji: "😴",
  };
}

async function syncBodyWeight(
  weekStart,
  weekEnd,
  selectedDate,
  optionInput,
  dateRangeLabel,
  dryRun = false
) {
  console.log("⚖️ Body Weight Sync\n");

  const notion = new NotionClient();
  const calendar = new CalendarClient();

  // Test connections
  await testConnections({ notion, calendar });

  if (optionInput === "1") {
    console.log(
      `\n📊 Syncing body weight records for Date ${selectedDate.toDateString()}`
    );
  } else {
    console.log(
      `\n📊 Syncing body weight records from ${weekStart.toDateString()} to ${weekEnd.toDateString()}`
    );
  }

  const bodyWeightRecords = await notion.getBodyWeightForWeek(
    weekStart,
    weekEnd
  );

  if (bodyWeightRecords.length === 0) {
    console.log("📭 No body weight records found without calendar events");
    return;
  }

  console.log(
    `🔍 Found ${bodyWeightRecords.length} body weight records to sync`
  );

  let createdCount = 0;
  for (const bodyWeightRecord of bodyWeightRecords) {
    try {
      if (dryRun) {
        // In dry run mode, just show what would be created
        const title = calendar.formatBodyWeightEventTitle(bodyWeightRecord);
        console.log(`🧪 Would create: ${title} for ${bodyWeightRecord.date}`);
        createdCount++;
      } else {
        // Normal mode - actually create the event
        await calendar.createBodyWeightEvent(bodyWeightRecord);
        await notion.markBodyWeightCalendarCreated(bodyWeightRecord.id);
        createdCount++;
        console.log(
          `✅ Synced: Weight ${bodyWeightRecord.weight} ${bodyWeightRecord.weightUnit} - ${bodyWeightRecord.date}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Failed to sync body weight record for ${bodyWeightRecord.date}:`,
        error.message
      );
    }
  }

  const actionText = dryRun ? "Would sync" : "Successfully synced";
  console.log(
    `\n${
      dryRun ? "🧪" : "✅"
    } ${actionText} ${createdCount} body weight records!`
  );

  // Add week summary
  const summary = generateWeekSummary(
    weekStart,
    weekEnd,
    dateRangeLabel,
    optionInput
  );
  console.log(`\n${summary}`);

  // Return summary data for recap
  return {
    syncType: "Body Weight Records",
    count: createdCount,
    emoji: "⚖️",
  };
}

async function syncVideoGames(
  weekStart,
  weekEnd,
  selectedDate,
  optionInput,
  dateRangeLabel,
  dryRun = false
) {
  console.log("🎮 Steam (Video Games) Sync\n");

  const notion = new NotionClient();
  const calendar = new CalendarClient();

  // Test connections
  await testConnections({ notion, calendar });

  if (optionInput === "1") {
    console.log(
      `\n📊 Syncing video game sessions for Date ${selectedDate.toDateString()}`
    );
  } else {
    console.log(
      `\n📊 Syncing video game sessions from ${weekStart.toDateString()} to ${weekEnd.toDateString()}`
    );
  }

  const gameSessions = await notion.getVideoGamesForWeek(weekStart, weekEnd);

  if (gameSessions.length === 0) {
    console.log("📭 No video game sessions found without calendar events");
    return;
  }

  console.log(`🔍 Found ${gameSessions.length} gaming sessions to sync`);

  let createdCount = 0;
  for (const gameSession of gameSessions) {
    try {
      if (dryRun) {
        const title = calendar.formatVideoGameEventTitle(gameSession);
        console.log(
          `🧪 Would create: ${title} on ${gameSession.date} (${gameSession.startTime} - ${gameSession.endTime})`
        );
        createdCount++;
      } else {
        await calendar.createVideoGameEvent(gameSession);
        await notion.markVideoGameCalendarCreated(gameSession.id);
        createdCount++;
        console.log(
          `✅ Synced: ${gameSession.gameName} (${gameSession.hoursPlayed}h ${gameSession.minutesPlayed}m) - ${gameSession.date}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Failed to sync ${gameSession.gameName}:`,
        error.message
      );
    }
  }

  const actionText = dryRun ? "Would sync" : "Successfully synced";
  console.log(
    `\n${dryRun ? "🧪" : "✅"} ${actionText} ${createdCount} gaming sessions!`
  );

  // Add week summary
  const summary = generateWeekSummary(
    weekStart,
    weekEnd,
    dateRangeLabel,
    optionInput
  );
  console.log(`\n${summary}`);

  // Return summary data for recap
  return {
    syncType: "Gaming Sessions",
    count: createdCount,
    emoji: "🎮",
  };
}

// Helper function to execute sync for single or multiple weeks
async function executeSyncForWeeks(
  syncFunction,
  isMultipleWeeks,
  multipleWeeks,
  weekStart,
  weekEnd,
  selectedDate,
  optionInput,
  dateRangeLabel,
  dryRun
) {
  const summaries = [];

  if (isMultipleWeeks) {
    for (let i = 0; i < multipleWeeks.length; i++) {
      const week = multipleWeeks[i];
      console.log(`\n${"=".repeat(60)}`);
      console.log(
        `📅 Processing Week ${week.weekNumber} (${i + 1}/${
          multipleWeeks.length
        })`
      );
      console.log(
        `   ${week.weekStart.toDateString()} - ${week.weekEnd.toDateString()}`
      );
      console.log(`${"=".repeat(60)}\n`);

      const summary = await syncFunction(
        week.weekStart,
        week.weekEnd,
        selectedDate,
        optionInput,
        week.dateRangeLabel,
        dryRun
      );
      summaries.push(summary);
    }
  } else {
    const summary = await syncFunction(
      weekStart,
      weekEnd,
      selectedDate,
      optionInput,
      dateRangeLabel,
      dryRun
    );
    summaries.push(summary);
  }

  return summaries;
}

// Main execution
async function main() {
  // Check for dry run flag
  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    console.log("🧪 DRY RUN MODE - No calendar events will be created\n");
  }

  console.log("🔄 Calendar Sync App\n");
  console.log("Available syncs:");
  console.log(
    "1. All (GitHub Personal + GitHub Work + Oura + Steam + Strava + Withings)"
  );
  console.log("2. GitHub Personal (PRs)");
  console.log("3. GitHub Work (PRs)");
  console.log("4. Oura (Sleep)");
  console.log("5. Steam (Video Games)");
  console.log("6. Strava (Workouts)");
  console.log("7. Withings (Body weight)");

  const choice = await askQuestion("\n? Choose sync type (1-7): ");

  // Get date selection using the unified CLI utilities
  const dateSelection = await getDateSelection();

  // Handle multiple weeks scenario
  let isMultipleWeeks = false;
  let multipleWeeks = [];
  let weekStart, weekEnd, dateRangeLabel, selectedDate, optionInput;

  if (dateSelection.isMultipleWeeks) {
    isMultipleWeeks = true;
    multipleWeeks = dateSelection.multipleWeeks;
    optionInput = dateSelection.optionInput;
  } else {
    ({ weekStart, weekEnd, dateRangeLabel, selectedDate, optionInput } =
      dateSelection);
  }

  // Confirmation step
  console.log("\n📋 Summary:");

  if (optionInput === "1") {
    console.log(`📊 Single day operation`);
    console.log(`📅 Date: ${selectedDate.toDateString()}`);
    console.log(
      `🗓️ Calendar Date: ${selectedDate.toDateString()} (${
        selectedDate.toISOString().split("T")[0]
      })`
    );
  } else if (isMultipleWeeks) {
    console.log(`📊 Multiple weeks operation`);
    console.log(`📅 Weeks: ${dateSelection.weekNumbers.join(", ")}`);
    multipleWeeks.forEach((week) => {
      console.log(
        `   Week ${
          week.weekNumber
        }: ${week.weekStart.toDateString()} - ${week.weekEnd.toDateString()}`
      );
    });
  } else {
    const totalDays = Math.ceil((weekEnd - weekStart) / (1000 * 60 * 60 * 24));
    console.log(`📊 Total days: ${totalDays} days`);
    console.log(
      `📅 Date range: ${weekStart.toDateString()} - ${weekEnd.toDateString()}`
    );
  }

  // Show which sync type will run
  const syncTypes = {
    1: "All (GitHub Personal + GitHub Work + Oura + Steam + Strava + Withings)",
    2: "GitHub Personal (PRs)",
    3: "GitHub Work (PRs)",
    4: "Oura (Sleep)",
    5: "Steam (Video Games)",
    6: "Strava (Workouts)",
    7: "Withings (Body weight)",
  };
  console.log(`🔄 Sync type: ${syncTypes[choice]}`);

  if (dryRun) {
    console.log(
      `🧪 DRY RUN: Will preview what would be synced (no actual changes)`
    );
  }

  const confirmMessage = dryRun
    ? "\n? Proceed with previewing calendar events for this period? (y/n): "
    : "\n? Proceed with creating calendar events for this period? (y/n): ";

  const confirm = await askQuestion(confirmMessage);

  if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
    console.log("❌ Operation cancelled.");
    closeReadline();
    return;
  }

  closeReadline();

  // For "All" sync, don't allow multiple weeks (too overwhelming)
  if (choice === "1" && isMultipleWeeks) {
    console.log(
      "❌ Multiple weeks not supported for 'All' sync option. Please choose individual sync types for multiple weeks."
    );
    return;
  }

  if (isMultipleWeeks) {
    console.log(`\n📊 Processing ${multipleWeeks.length} weeks...`);
  } else if (optionInput === "1") {
    console.log(`\n📊 Processing ${dateRangeLabel}`);
  } else {
    console.log(
      `\n📊 Processing ${dateRangeLabel}: ${weekStart.toDateString()} - ${weekEnd.toDateString()}`
    );
  }

  // Track summaries for final recap
  const allSummaries = [];

  switch (choice) {
    case "1":
      console.log("🔄 Running all syncs...\n");
      const personalSummary = await syncGitHubPersonal(
        weekStart,
        weekEnd,
        selectedDate,
        optionInput,
        dateRangeLabel,
        dryRun
      );
      allSummaries.push(personalSummary);
      console.log("\n" + "=".repeat(50) + "\n");
      const workSummary = await syncGitHubWork(
        weekStart,
        weekEnd,
        selectedDate,
        optionInput,
        dateRangeLabel,
        dryRun
      );
      allSummaries.push(workSummary);
      console.log("\n" + "=".repeat(50) + "\n");
      const sleepSummary = await syncSleep(
        weekStart,
        weekEnd,
        selectedDate,
        optionInput,
        dateRangeLabel,
        dryRun
      );
      allSummaries.push(sleepSummary);
      console.log("\n" + "=".repeat(50) + "\n");
      const videoGameSummary = await syncVideoGames(
        weekStart,
        weekEnd,
        selectedDate,
        optionInput,
        dateRangeLabel,
        dryRun
      );
      allSummaries.push(videoGameSummary);
      console.log("\n" + "=".repeat(50) + "\n");
      const workoutSummary = await syncWorkouts(
        weekStart,
        weekEnd,
        selectedDate,
        optionInput,
        dateRangeLabel,
        dryRun
      );
      allSummaries.push(workoutSummary);
      console.log("\n" + "=".repeat(50) + "\n");
      const bodyWeightSummary = await syncBodyWeight(
        weekStart,
        weekEnd,
        selectedDate,
        optionInput,
        dateRangeLabel,
        dryRun
      );
      allSummaries.push(bodyWeightSummary);
      break;
    case "2":
      const summaries2 = await executeSyncForWeeks(
        syncGitHubPersonal,
        isMultipleWeeks,
        multipleWeeks,
        weekStart,
        weekEnd,
        selectedDate,
        optionInput,
        dateRangeLabel,
        dryRun
      );
      allSummaries.push(...summaries2);
      break;
    case "3":
      const summaries3 = await executeSyncForWeeks(
        syncGitHubWork,
        isMultipleWeeks,
        multipleWeeks,
        weekStart,
        weekEnd,
        selectedDate,
        optionInput,
        dateRangeLabel,
        dryRun
      );
      allSummaries.push(...summaries3);
      break;
    case "4":
      const summaries4 = await executeSyncForWeeks(
        syncSleep,
        isMultipleWeeks,
        multipleWeeks,
        weekStart,
        weekEnd,
        selectedDate,
        optionInput,
        dateRangeLabel,
        dryRun
      );
      allSummaries.push(...summaries4);
      break;
    case "5":
      const summaries5 = await executeSyncForWeeks(
        syncVideoGames,
        isMultipleWeeks,
        multipleWeeks,
        weekStart,
        weekEnd,
        selectedDate,
        optionInput,
        dateRangeLabel,
        dryRun
      );
      allSummaries.push(...summaries5);
      break;
    case "6":
      const summaries6 = await executeSyncForWeeks(
        syncWorkouts,
        isMultipleWeeks,
        multipleWeeks,
        weekStart,
        weekEnd,
        selectedDate,
        optionInput,
        dateRangeLabel,
        dryRun
      );
      allSummaries.push(...summaries6);
      break;
    case "7":
      const summaries7 = await executeSyncForWeeks(
        syncBodyWeight,
        isMultipleWeeks,
        multipleWeeks,
        weekStart,
        weekEnd,
        selectedDate,
        optionInput,
        dateRangeLabel,
        dryRun
      );
      allSummaries.push(...summaries7);
      break;
    default:
      console.log("❌ Invalid choice. Please run again and choose 1-7.");
  }

  // Final summary for multiple weeks
  if (isMultipleWeeks && choice !== "1") {
    console.log(`\n${"=".repeat(60)}`);
    console.log(
      `✅ Completed processing ${multipleWeeks.length} weeks for ${syncTypes[choice]}`
    );
    console.log(`📅 Weeks processed: ${dateSelection.weekNumbers.join(", ")}`);
    console.log(`${"=".repeat(60)}`);
  }

  // Display comprehensive final recap
  console.log("");
  console.log("📊 CALENDAR UPDATE RECAP");
  console.log("========================");

  // Display period information
  if (optionInput === "1") {
    console.log(`📅 Updated calendar for ${selectedDate.toDateString()}`);
  } else if (isMultipleWeeks) {
    console.log(`📅 Updated calendar for ${multipleWeeks.length} weeks`);
    console.log(`   Weeks: ${dateSelection.weekNumbers.join(", ")}`);
  } else {
    const totalDays = Math.ceil((weekEnd - weekStart) / (1000 * 60 * 60 * 24));
    console.log(`📅 Updated calendar for ${totalDays} days`);
    console.log(`   ${weekStart.toDateString()} - ${weekEnd.toDateString()}`);
  }

  console.log("");

  // Aggregate summaries by type
  const aggregatedSummaries = {};
  let totalUpdates = 0;

  allSummaries.forEach((summary) => {
    if (summary && summary.syncType) {
      if (!aggregatedSummaries[summary.syncType]) {
        aggregatedSummaries[summary.syncType] = {
          count: 0,
          emoji: summary.emoji,
        };
      }
      aggregatedSummaries[summary.syncType].count += summary.count;
      totalUpdates += summary.count;
    }
  });

  // Display what was updated
  let hasUpdates = false;
  Object.entries(aggregatedSummaries).forEach(([syncType, data]) => {
    if (data.count > 0) {
      console.log(
        `${data.emoji} Updated ${data.count} ${syncType.toLowerCase()}`
      );
      hasUpdates = true;
    }
  });

  if (!hasUpdates) {
    console.log("📭 No calendar events were created");
  } else {
    console.log("");
    console.log(
      `📊 Total: ${totalUpdates} calendar events ${dryRun ? "would be" : "were"} ${dryRun ? "created" : "created"}`
    );
  }

  console.log("");
  console.log("🎉 Calendar sync complete!");
}

main().catch(console.error);
