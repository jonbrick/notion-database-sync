const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

class WithingsClient {
  constructor() {
    this.clientId = process.env.WITHINGS_CLIENT_ID;
    this.clientSecret = process.env.WITHINGS_CLIENT_SECRET;
    this.accessToken = process.env.WITHINGS_ACCESS_TOKEN;
    this.refreshToken = process.env.WITHINGS_REFRESH_TOKEN;
    this.baseUrl = "https://wbsapi.withings.net";
  }

  saveTokensToEnvFile() {
    try {
      const envPath = path.join(process.cwd(), ".env");

      if (!fs.existsSync(envPath)) {
        console.log(
          "⚠️ .env file not found, tokens will only persist for this session"
        );
        return;
      }

      let envContent = fs.readFileSync(envPath, "utf8");

      // Update access token
      const accessTokenPattern = /^WITHINGS_ACCESS_TOKEN=.*$/m;
      if (accessTokenPattern.test(envContent)) {
        envContent = envContent.replace(
          accessTokenPattern,
          `WITHINGS_ACCESS_TOKEN=${this.accessToken}`
        );
      } else {
        envContent += `\nWITHINGS_ACCESS_TOKEN=${this.accessToken}`;
      }

      // Update refresh token
      const refreshTokenPattern = /^WITHINGS_REFRESH_TOKEN=.*$/m;
      if (refreshTokenPattern.test(envContent)) {
        envContent = envContent.replace(
          refreshTokenPattern,
          `WITHINGS_REFRESH_TOKEN=${this.refreshToken}`
        );
      } else {
        envContent += `\nWITHINGS_REFRESH_TOKEN=${this.refreshToken}`;
      }

      fs.writeFileSync(envPath, envContent);
      console.log("💾 Tokens saved to .env file for future use");
    } catch (error) {
      console.error("⚠️ Failed to save tokens to .env file:", error.message);
      console.log("Tokens will only persist for this session");
    }
  }

  async refreshAccessToken() {
    try {
      console.log("🔄 Refreshing Withings access token...");

      if (!this.refreshToken) {
        console.error(
          "❌ No refresh token available - cannot refresh access token"
        );
        return false;
      }

      const response = await fetch(`${this.baseUrl}/v2/oauth2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          action: "requesttoken",
          grant_type: "refresh_token",
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.status === 0) {
          this.accessToken = data.body.access_token;
          process.env.WITHINGS_ACCESS_TOKEN = data.body.access_token;

          // Also update refresh token if provided (Withings sometimes gives a new one)
          if (data.body.refresh_token) {
            this.refreshToken = data.body.refresh_token;
            process.env.WITHINGS_REFRESH_TOKEN = data.body.refresh_token;
          }

          // Save tokens to .env file
          this.saveTokensToEnvFile();

          console.log("✅ Withings access token refreshed successfully!");
          return true;
        } else {
          console.error(
            "❌ Failed to refresh token - API returned error:",
            data
          );
          return false;
        }
      } else {
        const errorText = await response.text();
        console.error(
          "❌ Failed to refresh token - HTTP error:",
          response.status,
          errorText
        );
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

    // Check if token is expired (401 status or specific Withings error codes)
    if (!response.ok && response.status === 401) {
      console.log("🔄 Token expired, attempting refresh...");
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
    } else if (!response.ok) {
      // For other errors, check the Withings-specific error format
      try {
        const data = await response.json();
        if (data.status === 401 || data.status === 2555) {
          console.log("🔄 Token expired, attempting refresh...");
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
      } catch (parseError) {
        // If we can't parse the response, just return the original response
      }
    }

    return response;
  }

  async testConnection() {
    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/measure?action=getmeas&meastype=1&lastupdate=0&limit=1`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === 0) {
          console.log("✅ Withings connection successful!");
          console.log(
            `📊 Found measurements in timezone: ${data.body.timezone}`
          );
          return true;
        } else if (data.status === 401 || data.status === 2555) {
          // Token expired - try to refresh and retry
          console.log("🔄 Token expired, attempting refresh...");
          const refreshSuccess = await this.refreshAccessToken();
          if (refreshSuccess) {
            // Retry the test connection
            const retryResponse = await this.makeAuthenticatedRequest(
              `${this.baseUrl}/measure?action=getmeas&meastype=1&lastupdate=0&limit=1`
            );
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              if (retryData.status === 0) {
                console.log("✅ Withings connection successful!");
                console.log(
                  `📊 Found measurements in timezone: ${retryData.body.timezone}`
                );
                return true;
              } else {
                console.error("❌ Withings API error after retry:", retryData);
                return false;
              }
            } else {
              console.error(
                "❌ Withings connection failed after retry:",
                retryResponse.status
              );
              return false;
            }
          } else {
            console.error("❌ Withings API error:", data);
            return false;
          }
        } else {
          console.error("❌ Withings API error:", data);
          return false;
        }
      } else {
        // Try to get more detailed error information
        try {
          const errorData = await response.json();
          console.error("❌ Withings API error:", {
            status: response.status,
            body: errorData,
            error: errorData.error || "Unknown error",
          });
        } catch (parseError) {
          console.error("❌ Withings connection failed:", response.status);
        }
        return false;
      }
    } catch (error) {
      console.error("❌ Error testing Withings connection:", error.message);
      return false;
    }
  }

  async getMeasurements(startDate, endDate) {
    try {
      // Convert dates to Unix timestamps
      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);

      console.log(
        `🔄 Fetching measurements from ${startDate.toDateString()} to ${endDate.toDateString()}`
      );

      // Get all measurement types available from your scale
      const measureTypes = "1,5,6,8,76,77,88"; // Weight, Fat Free Mass, Fat Ratio, Fat Mass, Muscle Mass, Hydration, Bone Mass

      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/measure?action=getmeas&meastype=${measureTypes}&startdate=${startTimestamp}&enddate=${endTimestamp}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === 0) {
          console.log(
            `📊 Found ${data.body.measuregrps.length} measurement sessions`
          );
          return data.body.measuregrps;
        } else {
          console.error("❌ Failed to fetch measurements:", data);
          return [];
        }
      } else {
        console.error("❌ Failed to fetch measurements:", response.status);
        return [];
      }
    } catch (error) {
      console.error("❌ Error fetching measurements:", error.message);
      return [];
    }
  }

  // Convert Withings measurement value based on unit
  convertMeasurementValue(value, unit) {
    return value * Math.pow(10, unit);
  }

  // Convert kg to pounds
  kgToPounds(kg) {
    return kg * 2.20462;
  }

  // Parse a measurement group into structured data
  parseMeasurementGroup(measureGroup) {
    const measurements = {};

    // Parse the timestamp to a proper date
    const measurementDate = new Date(measureGroup.date * 1000);

    // Process each measurement in the group
    measureGroup.measures.forEach((measure) => {
      const value = this.convertMeasurementValue(measure.value, measure.unit);

      switch (measure.type) {
        case 1: // Weight (kg)
          measurements.weight = this.kgToPounds(value);
          measurements.weightKg = value;
          break;
        case 5: // Fat Free Mass (kg)
          measurements.fatFreeMass = this.kgToPounds(value);
          break;
        case 6: // Fat Ratio (%)
          measurements.fatPercentage = value;
          break;
        case 8: // Fat Mass Weight (kg)
          measurements.fatMass = this.kgToPounds(value);
          break;
        case 76: // Muscle Mass (kg)
          measurements.muscleMass = this.kgToPounds(value);
          break;
        case 77: // Hydration (%)
          measurements.bodyWaterPercentage = value;
          break;
        case 88: // Bone Mass (kg)
          measurements.boneMass = this.kgToPounds(value);
          break;
      }
    });

    return {
      id: measureGroup.grpid,
      date: measurementDate,
      deviceModel: measureGroup.model || "Unknown",
      timezone: "America/New_York", // From API response
      ...measurements,
    };
  }
}

module.exports = WithingsClient;
