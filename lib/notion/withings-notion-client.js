const { Client } = require("@notionhq/client");
require("dotenv").config();

class NotionClient {
  constructor() {
    this.notion = new Client({ auth: process.env.WITHINGS_NOTION_TOKEN });
    this.databaseId = process.env.WITHINGS_NOTION_DATABASE_ID;
  }

  async testConnection() {
    try {
      const response = await this.notion.databases.retrieve({
        database_id: this.databaseId,
      });

      console.log("✅ Notion connection successful!");
      console.log(
        `📊 Database: ${response.title[0]?.plain_text || "Bodyweight Database"}`
      );
      return true;
    } catch (error) {
      console.error("❌ Notion connection failed:", error.message);
      return false;
    }
  }

  async createMeasurementRecord(measurementData) {
    try {
      const properties = this.transformMeasurementToNotion(measurementData);

      const response = await this.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties,
      });

      console.log(
        `✅ Created measurement record for ${measurementData.date.toDateString()}`
      );
      return response;
    } catch (error) {
      console.error("❌ Error creating measurement record:", error.message);
      throw error;
    }
  }

  transformMeasurementToNotion(measurement) {
    // Format the date string for the title
    const dateStr = measurement.date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Format weight for title (e.g., "Body Weight - Monday, January 15, 2025")
    const title = `Body Weight - ${dateStr}`;

    return {
      Name: {
        title: [{ text: { content: title } }],
      },
      Date: {
        date: { start: measurement.date.toLocaleDateString("en-CA") }, // YYYY-MM-DD format in local timezone
      },
      Weight: {
        number: Math.round(measurement.weight * 10) / 10 || null, // Round to 1 decimal
      },
      "Fat Free Mass": {
        number: Math.round(measurement.fatFreeMass * 10) / 10 || null,
      },
      "Fat Percentage": {
        number: Math.round(measurement.fatPercentage * 10) / 10 || null,
      },
      "Fat Mass": {
        number: Math.round(measurement.fatMass * 10) / 10 || null,
      },
      "Muscle Mass": {
        number: Math.round(measurement.muscleMass * 10) / 10 || null,
      },
      "Body Water Percentage": {
        number: Math.round(measurement.bodyWaterPercentage * 10) / 10 || null,
      },
      "Bone Mass": {
        number: Math.round(measurement.boneMass * 10) / 10 || null,
      },
      "Measurement Time": {
        rich_text: [{ text: { content: measurement.date.toISOString() } }],
      },
      "Device Model": {
        rich_text: [
          { text: { content: measurement.deviceModel || "Unknown" } },
        ],
      },
      "Measurement ID": {
        rich_text: [{ text: { content: measurement.id.toString() } }],
      },
      "Calendar Created": {
        checkbox: false,
      },
    };
  }

  async getMeasurementsForWeek(weekStart, weekEnd) {
    try {
      const startDateStr = weekStart.toISOString().split("T")[0];
      const endDateStr = weekEnd.toISOString().split("T")[0];

      console.log(
        `🔄 Reading measurements from ${startDateStr} to ${endDateStr}`
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
        `📊 Found ${response.results.length} measurements without calendar events`
      );
      return this.transformNotionToMeasurements(response.results);
    } catch (error) {
      console.error("❌ Error reading measurements:", error.message);
      return [];
    }
  }

  transformNotionToMeasurements(notionPages) {
    return notionPages.map((page) => {
      const props = page.properties;
      return {
        id: page.id,
        date: props["Date"]?.date?.start,
        weight: props["Weight"]?.number,
        fatFreeMass: props["Fat Free Mass"]?.number,
        fatPercentage: props["Fat Percentage"]?.number,
        fatMass: props["Fat Mass"]?.number,
        muscleMass: props["Muscle Mass"]?.number,
        bodyWaterPercentage: props["Body Water Percentage"]?.number,
        boneMass: props["Bone Mass"]?.number,
        measurementTime: props["Measurement Time"]?.rich_text?.[0]?.plain_text,
        deviceModel: props["Device Model"]?.rich_text?.[0]?.plain_text,
        measurementId: props["Measurement ID"]?.rich_text?.[0]?.plain_text,

        // For calendar compatibility
        activityName: props["Name"]?.title?.[0]?.plain_text || "Body Weight",
        activityType: "Measurement",
        startTime: `${props["Date"]?.date?.start}T08:00:00Z`, // Default morning time
        duration: 0, // All-day event
        distance: 0, // Not applicable
        activityId: page.id,
      };
    });
  }

  async markCalendarCreated(measurementId) {
    try {
      await this.notion.pages.update({
        page_id: measurementId,
        properties: {
          "Calendar Created": { checkbox: true },
        },
      });
    } catch (error) {
      console.error("❌ Error marking calendar created:", error.message);
    }
  }

  // Check if measurement already exists (for deduplication)
  async checkMeasurementExists(measurementId) {
    try {
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        filter: {
          property: "Measurement ID",
          rich_text: { equals: measurementId.toString() },
        },
      });

      return response.results.length > 0;
    } catch (error) {
      console.error("❌ Error checking measurement existence:", error.message);
      return false;
    }
  }
}

module.exports = NotionClient;
