const { Client } = require("@notionhq/client");
require("dotenv").config();

/**
 * Steam-specific Notion client
 *
 * This client uses STEAM_NOTION_TOKEN and STEAM_NOTION_DATABASE_ID environment variables
 * specifically for Steam gaming data. These environment variables should
 * point to a Notion database configured for gaming activity records.
 */
class NotionClient {
  constructor() {
    this.notion = new Client({ auth: process.env.STEAM_NOTION_TOKEN });
    this.databaseId = process.env.STEAM_NOTION_DATABASE_ID;
  }

  // Helper function to truncate text to Notion's 2000 character limit
  truncateForNotion(text, maxLength = 2000) {
    if (!text || text.length <= maxLength) {
      return text;
    }

    // Truncate and add ellipsis
    const truncated = text.substring(0, maxLength - 3) + "...";
    return truncated;
  }

  async testConnection() {
    try {
      const response = await this.notion.databases.retrieve({
        database_id: this.databaseId,
      });

      console.log("✅ Steam Notion connection successful!");
      console.log(
        `📊 Steam Database: ${response.title[0]?.plain_text || "Gaming Activity Database"}\n`
      );
      return true;
    } catch (error) {
      console.error("❌ Steam Notion connection failed:", error.message);
      return false;
    }
  }

  async createGamingRecord(activityData) {
    try {
      const properties = this.transformGamingToNotion(activityData);

      const response = await this.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties,
      });

      console.log(`✅ Created gaming record: ${activityData.gameName}`);
      return response;
    } catch (error) {
      console.error("❌ Error creating gaming record:", error.message);
      throw error;
    }
  }

  transformGamingToNotion(activity) {
    // Format session details
    const sessionDetails = activity.sessions
      .map(
        (session) =>
          `${session.start_time}-${session.end_time} (${session.duration_minutes}min)`
      )
      .join(", ");

    // Convert Steam gaming activity to Notion properties format
    return {
      "Game Name": {
        title: [{ text: { content: activity.gameName || "Unknown Game" } }],
      },
      Date: {
        date: { start: activity.date },
      },
      "Hours Played": {
        number: activity.hoursPlayed || 0,
      },
      "Minutes Played": {
        number: activity.minutesPlayed || 0,
      },
      "Session Count": {
        number: activity.sessionCount || 0,
      },
      "Session Details": {
        rich_text: [
          {
            text: {
              content: this.truncateForNotion(sessionDetails || ""),
            },
          },
        ],
      },
      "Start Time": {
        rich_text: [{ text: { content: activity.startTime || "" } }],
      },
      "End Time": {
        rich_text: [{ text: { content: activity.endTime || "" } }],
      },
      Platform: {
        select: { name: "Steam" },
      },
      "Calendar Created": {
        checkbox: false,
      },
      "Activity ID": {
        rich_text: [{ text: { content: activity.id || "" } }],
      },
    };
  }

  async getGamingForWeek(weekStart, weekEnd) {
    try {
      const startDateStr = weekStart.toISOString().split("T")[0];
      const endDateStr = weekEnd.toISOString().split("T")[0];

      console.log(
        `🔄 Reading gaming activities from ${startDateStr} to ${endDateStr}`
      );

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
        `📊 Found ${response.results.length} gaming activities without calendar events`
      );
      return this.transformNotionToGaming(response.results);
    } catch (error) {
      console.error("❌ Error reading gaming activities:", error.message);
      return [];
    }
  }

  transformNotionToGaming(notionPages) {
    return notionPages.map((page) => {
      const props = page.properties;
      return {
        id: page.id,
        gameName: props["Game Name"]?.title?.[0]?.plain_text || "Unknown Game",
        date: props["Date"]?.date?.start,
        hoursPlayed: props["Hours Played"]?.number || 0,
        minutesPlayed: props["Minutes Played"]?.number || 0,
        sessionCount: props["Session Count"]?.number || 0,
        sessionDetails:
          props["Session Details"]?.rich_text?.[0]?.plain_text || "",
        startTime: props["Start Time"]?.rich_text?.[0]?.plain_text || "",
        endTime: props["End Time"]?.rich_text?.[0]?.plain_text || "",
        platform: props["Platform"]?.select?.name || "Steam",
        activityId: props["Activity ID"]?.rich_text?.[0]?.plain_text || "",

        // For calendar compatibility
        activityName:
          props["Game Name"]?.title?.[0]?.plain_text || "Unknown Game",
        activityType: "Gaming",
        duration: props["Minutes Played"]?.number || 0,
        distance: 0, // Not applicable for gaming
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

  async checkActivityExists(activityId) {
    try {
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        filter: {
          property: "Activity ID",
          rich_text: { equals: activityId },
        },
      });

      return response.results.length > 0;
    } catch (error) {
      console.error("❌ Error checking activity existence:", error.message);
      return false;
    }
  }
}

module.exports = NotionClient;
