const { Client } = require("@notionhq/client");
require("dotenv").config();

class NotionClient {
  constructor() {
    this.notion = new Client({ auth: process.env.STRAVA_NOTION_TOKEN });
    this.databaseId = process.env.STRAVA_NOTION_DATABASE_ID;
  }

  async testConnection() {
    try {
      const response = await this.notion.databases.retrieve({
        database_id: this.databaseId,
      });

      console.log("✅ Notion connection successful!");
      console.log(
        `📊 Database: ${response.title[0]?.plain_text || "Workout Database"}`
      );
      return true;
    } catch (error) {
      console.error("❌ Notion connection failed:", error.message);
      return false;
    }
  }

  async createWorkoutRecord(workoutData) {
    try {
      const properties = this.transformWorkoutToNotion(workoutData);

      const response = await this.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties,
      });

      console.log(`✅ Created workout record: ${workoutData.name}`);
      return response;
    } catch (error) {
      console.error("❌ Error creating workout record:", error.message);
      throw error;
    }
  }

  transformWorkoutToNotion(workout) {
    // Convert Strava workout to Notion properties format
    const distance = workout.distance
      ? (workout.distance / 1609.34).toFixed(1)
      : "0"; // Convert meters to miles
    const duration = Math.round(workout.moving_time / 60); // Convert seconds to minutes

    return {
      "Activity Name": {
        title: [{ text: { content: workout.name || "Unnamed Workout" } }],
      },
      Date: {
        date: { start: workout.start_date_local.split("T")[0] },
      },
      "Activity Type": {
        select: { name: workout.type || "Workout" },
      },
      "Start Time": {
        rich_text: [{ text: { content: workout.start_date_local } }],
      },
      Duration: {
        number: duration,
      },
      Distance: {
        number: parseFloat(distance),
      },
      "Activity ID": {
        number: workout.id,
      },
      "Calendar Created": {
        checkbox: false,
      },
    };
  }

  async getWorkoutsForWeek(weekStart, weekEnd) {
    try {
      const startDateStr = weekStart.toISOString().split("T")[0];
      const endDateStr = weekEnd.toISOString().split("T")[0];

      console.log(`🔄 Reading workouts from ${startDateStr} to ${endDateStr}`);

      const response = await this.notion.databases.query({
        database_id: this.databaseId,
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
          props["Activity Name"]?.title?.[0]?.plain_text || "Unnamed Workout",
        date: props["Date"]?.date?.start,
        activityType: props["Activity Type"]?.select?.name || "Workout",
        startTime: props["Start Time"]?.rich_text?.[0]?.plain_text,
        duration: props["Duration"]?.number || 0,
        distance: props["Distance"]?.number || 0,
        activityId: props["Activity ID"]?.number,
      };
    });
  }

  async markCalendarCreated(workoutId) {
    try {
      await this.notion.pages.update({
        page_id: workoutId,
        properties: {
          "Calendar Created": { checkbox: true },
        },
      });
    } catch (error) {
      console.error("❌ Error marking calendar created:", error.message);
    }
  }
}

module.exports = NotionClient;
