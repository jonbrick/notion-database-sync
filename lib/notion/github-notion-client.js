const { Client } = require("@notionhq/client");
require("dotenv").config();

/**
 * GitHub-specific Notion client
 *
 * This client uses NOTION_TOKEN and NOTION_DATABASE_ID environment variables
 * specifically for GitHub activity data. These environment variables should
 * point to a Notion database configured for GitHub activity records.
 */
class NotionClient {
  constructor() {
    this.notion = new Client({ auth: process.env.GITHUB_NOTION_TOKEN });
    this.databaseId = process.env.GITHUB_NOTION_DATABASE_ID;
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

      console.log("✅ GitHub Notion connection successful!");
      console.log(
        `📊 GitHub Database: ${response.title[0]?.plain_text || "GitHub Activity Database"}\n`
      );
      return true;
    } catch (error) {
      console.error("❌ GitHub Notion connection failed:", error.message);
      return false;
    }
  }

  async checkForExistingRecord(uniqueId) {
    try {
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        filter: {
          property: "Unique ID",
          rich_text: {
            equals: uniqueId,
          },
        },
      });

      return response.results.length > 0;
    } catch (error) {
      console.error("❌ Error checking for existing record:", error.message);
      return false;
    }
  }

  async createWorkoutRecord(activityData) {
    try {
      // Check if record already exists
      if (activityData.uniqueId) {
        const exists = await this.checkForExistingRecord(activityData.uniqueId);
        if (exists) {
          console.log(
            `⏭️  Skipping duplicate record: ${activityData.repository} (${activityData.uniqueId.substring(0, 8)}...)`
          );
          return null;
        }
      }

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
    // Determine repository name - use PR title if available
    let repositoryName = activity.repository || "Unknown Repository";
    if (activity.isPrRecord && activity.prTitle) {
      repositoryName = `${activity.repository} - ${activity.prTitle} (#${activity.prNumber})`;
    }

    // Convert GitHub activity to Notion properties format
    return {
      Repository: {
        title: [{ text: { content: repositoryName } }],
      },
      Date: {
        date: { start: activity.date },
      },
      "Commits Count": {
        number: activity.commitsCount || 0,
      },
      "Commit Messages": {
        rich_text: [
          {
            text: {
              content: this.truncateForNotion(activity.commitMessages || ""),
            },
          },
        ],
      },
      "PR Titles": {
        rich_text: [
          {
            text: { content: this.truncateForNotion(activity.prTitles || "") },
          },
        ],
      },
      "PRs Count": {
        number: activity.pullRequestsCount || 0,
      },
      "Files Changed": {
        number: activity.filesChanged || 0,
      },
      "Files List": {
        rich_text: [
          {
            text: {
              content: this.truncateForNotion(activity.filesChangedList || ""),
            },
          },
        ],
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
      // Add unique ID field
      "Unique ID": {
        rich_text: [
          {
            text: { content: activity.uniqueId || "" },
          },
        ],
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

      // Extract PR information from repository name if it contains PR details
      const repositoryName =
        props["Repository"]?.title?.[0]?.plain_text || "Unknown Repository";
      let repository = repositoryName;
      let prTitle = "";
      let prNumber = null;

      // Check if repository name contains PR information (format: "repo - PR Title (#123)")
      const prMatch = repositoryName.match(/^(.+?) - (.+?) \(#(\d+)\)$/);
      if (prMatch) {
        repository = prMatch[1];
        prTitle = prMatch[2];
        prNumber = parseInt(prMatch[3]);
      }

      return {
        id: page.id,
        repository: repository,
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

        // PR-specific fields (extracted from repository name)
        prNumber: prNumber,
        prTitle: prTitle,
        prState: "unknown", // Default since we don't have this field
        prUrl: "", // Default since we don't have this field
        isPrRecord: !!prNumber,

        // For calendar compatibility
        activityName: repositoryName,
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
