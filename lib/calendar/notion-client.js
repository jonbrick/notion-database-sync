const { Client } = require("@notionhq/client");
require("dotenv").config();

class NotionClient {
  constructor() {
    this.notion = new Client({ auth: process.env.NOTION_TOKEN });
    this.databaseId = process.env.NOTION_DATABASE_ID;
  }

  async testConnection() {
    try {
      const response = await this.notion.databases.retrieve({
        database_id: this.databaseId,
      });

      console.log("✅ Notion connection successful!");
      console.log(
        `📊 Database: ${response.title[0]?.plain_text || "GitHub Data"}\n`
      );
      return true;
    } catch (error) {
      console.error("❌ Notion connection failed:", error.message);
      return false;
    }
  }

  async createWorkoutRecord(activityData) {
    try {
      const properties = this.transformWorkoutToNotion(activityData);

      const response = await this.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties,
      });

      console.log(`✅ Created GitHub record: ${activityData.repository}`);
      return response;
    } catch (error) {
      console.error("❌ Error creating GitHub record:", error.message);
      throw error;
    }
  }

  transformWorkoutToNotion(activity) {
    // Convert GitHub activity to Notion properties format
    return {
      Repository: {
        title: [
          { text: { content: activity.repository || "Unknown Repository" } },
        ],
      },
      Date: {
        date: { start: activity.date },
      },
      "Commits Count": {
        number: activity.commitsCount || 0,
      },
      "Commit Messages": {
        rich_text: [{ text: { content: activity.commitMessages || "" } }],
      },
      "PR Titles": {
        rich_text: [{ text: { content: activity.prTitles || "" } }],
      },
      "PRs Count": {
        number: activity.pullRequestsCount || 0,
      },
      "Files Changed": {
        number: activity.filesChanged || 0,
      },
      "Files List": {
        rich_text: [{ text: { content: activity.filesChangedList || "" } }],
      },
      "Lines Added": {
        number: activity.totalLinesAdded || 0,
      },
      "Lines Deleted": {
        number: activity.totalLinesDeleted || 0,
      },
      "Total Changes": {
        number: activity.totalChanges || 0,
      },
      "Project Type": {
        select: { name: activity.projectType || "Personal" },
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

      console.log(
        `🔄 Reading GitHub activities from ${startDateStr} to ${endDateStr}`
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
        `📊 Found ${response.results.length} GitHub activities without calendar events`
      );
      return this.transformNotionToWorkouts(response.results);
    } catch (error) {
      console.error("❌ Error reading GitHub activities:", error.message);
      return [];
    }
  }

  transformNotionToWorkouts(notionPages) {
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
        pullRequestsCount: props["PRs Count"]?.number || 0,
        filesChanged: props["Files Changed"]?.number || 0,
        totalLinesAdded: props["Lines Added"]?.number || 0,
        totalLinesDeleted: props["Lines Deleted"]?.number || 0,

        // For calendar compatibility
        activityName:
          props["Repository"]?.title?.[0]?.plain_text || "Unknown Repository",
        activityType: "Development",
        startTime: `${props["Date"]?.date?.start}T12:00:00Z`, // Default to noon
        duration: 30, // Default 30 min blocks
        distance: 0, // Not applicable for GitHub
        activityId: page.id,
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
}

module.exports = NotionClient;
