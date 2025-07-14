const fetch = require("node-fetch");
require("dotenv").config();

class OuraClient {
  constructor() {
    this.accessToken = process.env.OURA_ACCESS_TOKEN;
    this.baseUrl = "https://api.ouraring.com/v2";
  }

  async testConnection() {
    try {
      const response = await fetch(
        `${this.baseUrl}/usercollection/personal_info`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (response.ok) {
        const info = await response.json();
        console.log("✅ Oura connection successful!");
        console.log(`👤 User: Age ${info.age}, Weight ${info.weight}kg`);
        return true;
      } else {
        console.error("❌ Oura connection failed:", response.status);
        return false;
      }
    } catch (error) {
      console.error("❌ Error testing Oura connection:", error.message);
      return false;
    }
  }

  async getSleepSessions(startDate, endDate) {
    try {
      console.log(`🔄 Fetching sleep sessions from ${startDate} to ${endDate}`);

      const response = await fetch(
        `${this.baseUrl}/usercollection/sleep?start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log(`😴 Found ${data.data.length} sleep sessions`);
        return data.data;
      } else {
        console.error("❌ Failed to fetch sleep sessions:", response.status);
        return [];
      }
    } catch (error) {
      console.error("❌ Error fetching sleep sessions:", error.message);
      return [];
    }
  }
}

module.exports = OuraClient;
