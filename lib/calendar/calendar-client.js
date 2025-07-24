const { google } = require("googleapis");
require("dotenv").config();

class CalendarClient {
  constructor() {
    // Personal account auth
    this.personalAuth = new google.auth.OAuth2(
      process.env.PERSONAL_GOOGLE_CLIENT_ID,
      process.env.PERSONAL_GOOGLE_CLIENT_SECRET
    );
    this.personalAuth.setCredentials({
      refresh_token: process.env.PERSONAL_GOOGLE_REFRESH_TOKEN,
    });

    // Work account auth
    this.workAuth = new google.auth.OAuth2(
      process.env.WORK_GOOGLE_CLIENT_ID,
      process.env.WORK_GOOGLE_CLIENT_SECRET
    );
    this.workAuth.setCredentials({
      refresh_token: process.env.WORK_GOOGLE_REFRESH_TOKEN,
    });

    this.personalCalendar = google.calendar({
      version: "v3",
      auth: this.personalAuth,
    });
    this.workCalendar = google.calendar({ version: "v3", auth: this.workAuth });
    this.workCalendarId = process.env.WORK_CALENDAR_ID;
    this.personalCalendarId = process.env.PERSONAL_CALENDAR_ID;
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

  async createWorkoutEvent(workout) {
    try {
      // Parse the UTC time but treat it as if it were local time
      // This preserves the actual workout time from Strava
      const startTime = new Date(workout.startTime.replace("Z", ""));
      const endTime = new Date(
        startTime.getTime() + workout.duration * 60 * 1000
      );

      const title = this.formatEventTitle(workout);
      const description = this.formatEventDescription(workout);

      const event = {
        summary: title,
        description: description,
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
      };

      const response = await this.workCalendar.events.insert({
        calendarId: this.workCalendarId,
        resource: event,
      });

      console.log(`✅ Created calendar event: ${title}`);
      return response;
    } catch (error) {
      console.error("❌ Error creating calendar event:", error.message);
      throw error;
    }
  }

  async createGitHubEvent(activity) {
    try {
      // Determine which calendar to use based on project type
      const calendarId =
        activity.projectType === "Work"
          ? this.workCalendarId
          : this.personalCalendarId;

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

      const calendar =
        activity.projectType === "Work"
          ? this.workCalendar
          : this.personalCalendar;
      const response = await calendar.events.insert({
        calendarId: calendarId,
        resource: event,
      });

      const calendarType =
        activity.projectType === "Work" ? "Work" : "Personal";
      console.log(`✅ Created ${calendarType} calendar event: ${title}`);
      return response;
    } catch (error) {
      console.error("❌ Error creating GitHub calendar event:", error.message);
      throw error;
    }
  }

  formatEventTitle(workout) {
    if (workout.distance > 0) {
      return `${workout.activityType} - ${workout.distance} miles`;
    } else {
      return `${workout.activityName}`;
    }
  }

  formatEventDescription(workout) {
    let description = `🏃‍♂️ ${workout.activityName}\n`;
    description += `⏱️ Duration: ${workout.duration} minutes\n`;

    if (workout.distance > 0) {
      description += `📏 Distance: ${workout.distance} miles\n`;
    }

    description += `📊 Activity Type: ${workout.activityType}\n`;
    description += `🔗 Activity ID: ${workout.activityId}`;

    return description;
  }

  formatGitHubEventTitle(activity) {
    const repoName = activity.repository.split("/")[1]; // Get just "brain-app" from "cortexapps/brain-app"
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

    // Always show PR section, even if empty
    if (activity.prTitles && activity.prTitles.trim()) {
      description += `🔀 PR: ${activity.prTitles}\n`;
    } else {
      description += `🔀 PR: None\n`;
    }

    description += `\n📝 Commits:\n${activity.commitMessages}`;
    return description;
  }
}

module.exports = CalendarClient;
