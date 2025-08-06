const { Client } = require("@notionhq/client");
require("dotenv").config();

class NotionClient {
  constructor() {
    this.notion = new Client({ auth: process.env.OURA_NOTION_TOKEN });
    this.databaseId = process.env.OURA_NOTION_DATABASE_ID;
  }

  async testConnection() {
    try {
      const response = await this.notion.databases.retrieve({
        database_id: this.databaseId,
      });

      console.log("✅ Notion connection successful!");
      console.log(
        `📊 Database: ${response.title[0]?.plain_text || "Sleep Database"}`
      );
      return true;
    } catch (error) {
      console.error("❌ Notion connection failed:", error.message);
      return false;
    }
  }

  async checkExistingSleepRecord(sleepId) {
    try {
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        filter: {
          property: "Sleep ID",
          rich_text: { equals: sleepId },
        },
      });

      return response.results.length > 0 ? response.results[0] : null;
    } catch (error) {
      console.error("❌ Error checking existing sleep record:", error.message);
      return null;
    }
  }

  async createSleepRecord(sleepData) {
    try {
      // Check if record already exists
      const existingRecord = await this.checkExistingSleepRecord(sleepData.id);

      if (existingRecord) {
        const properties = this.transformSleepToNotion(sleepData);
        console.log(
          `⏭️  Skipped sleep record for Night of: ${properties["Night of"].title[0].text.content} (Oura Date: ${sleepData.day}) - already exists`
        );
        return { skipped: true, existing: existingRecord };
      }

      const properties = this.transformSleepToNotion(sleepData);

      const response = await this.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties,
      });

      console.log(
        `✅ Created sleep record for Night of: ${properties["Night of"].title[0].text.content} (Oura Date: ${sleepData.day})`
      );
      return { skipped: false, created: response };
    } catch (error) {
      console.error("❌ Error creating sleep record:", error.message);
      throw error;
    }
  }

  transformSleepToNotion(sleep) {
    // Parse bedtime and wake time
    const bedtime = new Date(sleep.bedtime_start);
    const wakeTime = new Date(sleep.bedtime_end);

    // Calculate "Night of Date" = Oura Date - 1 (simple rule)
    // Oura Date = wake up day, Night of = previous night
    const nightOfDate = new Date(sleep.day + "T00:00:00");
    nightOfDate.setDate(nightOfDate.getDate() - 1); // Always subtract 1 day

    // Format "Night of" text
    const nightOfText = nightOfDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Determine Google Calendar category based on wake time
    const wakeHour = wakeTime.getHours();
    const googleCalendar = wakeHour < 7 ? "Normal Wake Up" : "Sleep In";

    return {
      "Night of": {
        title: [{ text: { content: nightOfText } }],
      },
      "Night of Date": {
        date: { start: nightOfDate.toISOString().split("T")[0] },
      },
      "Oura Date": {
        date: { start: sleep.day },
      },
      Bedtime: {
        rich_text: [{ text: { content: sleep.bedtime_start } }],
      },
      "Wake Time": {
        rich_text: [{ text: { content: sleep.bedtime_end } }],
      },
      "Sleep Duration": {
        number: parseFloat((sleep.total_sleep_duration / 3600).toFixed(1)),
      },
      "Deep Sleep": {
        number: Math.round(sleep.deep_sleep_duration / 60), // Convert to minutes
      },
      "REM Sleep": {
        number: Math.round(sleep.rem_sleep_duration / 60),
      },
      "Light Sleep": {
        number: Math.round(sleep.light_sleep_duration / 60),
      },
      "Awake Time": {
        number: Math.round(sleep.awake_time / 60),
      },
      "Heart Rate Avg": {
        number: sleep.average_heart_rate || 0,
      },
      "Heart Rate Low": {
        number: sleep.lowest_heart_rate || 0,
      },
      HRV: {
        number: sleep.average_hrv || 0,
      },
      "Respiratory Rate": {
        number: sleep.average_breath || 0,
      },
      "Google Calendar": {
        select: { name: googleCalendar },
      },
      "Sleep ID": {
        rich_text: [{ text: { content: sleep.id } }],
      },
      "Calendar Created": {
        checkbox: false,
      },
      Type: {
        rich_text: [{ text: { content: sleep.type } }],
      },
      Efficiency: {
        number: sleep.efficiency || 0,
      },
    };
  }

  async getSleepForWeek(weekStart, weekEnd) {
    try {
      const startDateStr = weekStart.toISOString().split("T")[0];
      const endDateStr = weekEnd.toISOString().split("T")[0];

      console.log(
        `🔄 Reading sleep records from ${startDateStr} to ${endDateStr}`
      );

      const response = await this.notion.databases.query({
        database_id: this.databaseId,
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
        ouraDate: props["Oura Date"]?.date?.start,
        bedtime: props["Bedtime"]?.rich_text?.[0]?.plain_text,
        wakeTime: props["Wake Time"]?.rich_text?.[0]?.plain_text,
        sleepDuration: props["Sleep Duration"]?.number || 0,
        deepSleep: props["Deep Sleep"]?.number || 0,
        remSleep: props["REM Sleep"]?.number || 0,
        lightSleep: props["Light Sleep"]?.number || 0,
        awakeTime: props["Awake Time"]?.number || 0,
        avgHR: props["Heart Rate Avg"]?.number || 0,
        lowHR: props["Heart Rate Low"]?.number || 0,
        hrv: props["HRV"]?.number || 0,
        respiratoryRate: props["Respiratory Rate"]?.number || 0,
        googleCalendar: props["Google Calendar"]?.select?.name || "Sleep In",
        sleepId: props["Sleep ID"]?.rich_text?.[0]?.plain_text,
        type: props["Type"]?.rich_text?.[0]?.plain_text,
        efficiency: props["Efficiency"]?.number || 0,
      };
    });
  }

  async markCalendarCreated(sleepRecordId) {
    try {
      await this.notion.pages.update({
        page_id: sleepRecordId,
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
