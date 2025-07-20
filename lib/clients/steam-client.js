const fetch = require("node-fetch");
require("dotenv").config();

class SteamClient {
  constructor() {
    this.baseUrl =
      process.env.STEAM_URL ||
      "https://fmbemz2etdgk23bce3wvf2yk540kezhy.lambda-url.us-east-2.on.aws";
  }

  async testConnection() {
    try {
      // Test with today's date
      const today = new Date().toISOString().split("T")[0];
      const response = await fetch(`${this.baseUrl}?date=${today}`);

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Steam API connection successful!");
        console.log(`🎮 Found ${data.game_count || 0} games played today`);
        return true;
      } else {
        console.error("❌ Steam API connection failed:", response.status);
        return false;
      }
    } catch (error) {
      console.error("❌ Error testing Steam connection:", error.message);
      return false;
    }
  }

  async getGamingSessions(startDate, endDate) {
    try {
      console.log(
        `🔄 Fetching gaming sessions from ${startDate.toDateString()} to ${endDate.toDateString()}`
      );

      const sessions = [];
      const currentDate = new Date(startDate);

      // Fetch data for each day in the range
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split("T")[0];

        try {
          const response = await fetch(`${this.baseUrl}?date=${dateStr}`);

          if (response.ok) {
            const data = await response.json();

            if (data.total_hours > 0) {
              sessions.push({
                date: dateStr,
                totalHours: data.total_hours,
                gameCount: data.game_count,
                games: data.games,
              });
              console.log(
                `📊 ${dateStr}: Found ${data.game_count} games, ${data.total_hours.toFixed(1)} hours`
              );
            }
          } else {
            console.warn(
              `⚠️ Failed to fetch data for ${dateStr}: ${response.status}`
            );
          }
        } catch (error) {
          console.error(`❌ Error fetching ${dateStr}:`, error.message);
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(`🎮 Found ${sessions.length} days with gaming activity`);
      return sessions;
    } catch (error) {
      console.error("❌ Error fetching gaming sessions:", error.message);
      return [];
    }
  }

  async getActivities(startDate, endDate) {
    try {
      // Get gaming sessions
      const sessions = await this.getGamingSessions(startDate, endDate);

      // Transform sessions into activities format (one per game per day)
      const activities = [];

      for (const daySession of sessions) {
        for (const game of daySession.games) {
          // Create an activity for each game
          const activity = {
            name: game.name,
            type: "Gaming",
            start_date: `${daySession.date}T00:00:00Z`,
            start_date_local: `${daySession.date}T00:00:00-05:00`,
            id: `${game.name.replace(/[^a-zA-Z0-9]/g, "-")}-${daySession.date}`,

            // Steam-specific data
            gameName: game.name,
            date: daySession.date,
            hoursPlayed: game.hours,
            minutesPlayed: game.minutes,
            sessions: game.sessions,
            sessionCount: game.sessions.length,

            // For calendar compatibility
            startTime: `${daySession.date}T${game.sessions[0].start_time}:00-05:00`,
            endTime: `${daySession.date}T${game.sessions[game.sessions.length - 1].end_time}:00-05:00`,
            duration: game.minutes,
          };

          activities.push(activity);
        }
      }

      console.log(`🎮 Transformed into ${activities.length} game activities`);
      return activities;
    } catch (error) {
      console.error("❌ Error getting Steam activities:", error.message);
      return [];
    }
  }
}

module.exports = SteamClient;
