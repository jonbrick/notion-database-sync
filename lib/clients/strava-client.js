const fetch = require("node-fetch");
require("dotenv").config();

class StravaClient {
  constructor() {
    this.clientId = process.env.STRAVA_CLIENT_ID;
    this.clientSecret = process.env.STRAVA_CLIENT_SECRET;
    this.accessToken = process.env.STRAVA_ACCESS_TOKEN;
    this.refreshToken = process.env.STRAVA_REFRESH_TOKEN;
    this.baseUrl = "https://www.strava.com/api/v3";
  }

  async refreshAccessToken() {
    try {
      console.log("🔄 Refreshing Strava access token...");

      const response = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "refresh_token",
          refresh_token: this.refreshToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.access_token;

        // Update environment variable for this session
        process.env.STRAVA_ACCESS_TOKEN = data.access_token;

        console.log("✅ Strava access token refreshed successfully!");
        return true;
      } else {
        console.error("❌ Failed to refresh token:", response.status);
        return false;
      }
    } catch (error) {
      console.error("❌ Error refreshing token:", error.message);
      return false;
    }
  }

  async makeAuthenticatedRequest(url, options = {}) {
    // First attempt with current token
    let response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    // If token is expired (401), try to refresh and retry
    if (response.status === 401) {
      const refreshSuccess = await this.refreshAccessToken();
      if (refreshSuccess) {
        // Retry the request with new token
        response = await fetch(url, {
          ...options,
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            ...options.headers,
          },
        });
      }
    }

    return response;
  }

  async testConnection() {
    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/athlete`
      );

      if (response.ok) {
        const athlete = await response.json();
        console.log("✅ Strava connection successful!");
        console.log(`👤 Athlete: ${athlete.firstname} ${athlete.lastname}`);
        return true;
      } else {
        console.error("❌ Strava connection failed:", response.status);
        return false;
      }
    } catch (error) {
      console.error("❌ Error testing Strava connection:", error.message);
      return false;
    }
  }

  async getActivities(startDate, endDate) {
    try {
      // Convert dates to Unix timestamps
      const afterTimestamp = Math.floor(startDate.getTime() / 1000);
      const beforeTimestamp = Math.floor(endDate.getTime() / 1000);

      console.log(
        `🔄 Fetching activities from ${startDate.toDateString()} to ${endDate.toDateString()}`
      );

      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/athlete/activities?after=${afterTimestamp}&before=${beforeTimestamp}&per_page=50`
      );

      if (response.ok) {
        const activities = await response.json();
        console.log(`📊 Found ${activities.length} activities`);
        return activities;
      } else {
        console.error("❌ Failed to fetch activities:", response.status);
        return [];
      }
    } catch (error) {
      console.error("❌ Error fetching activities:", error.message);
      return [];
    }
  }
}

module.exports = StravaClient;
