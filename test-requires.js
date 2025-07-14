// Test script to verify all require paths work correctly
console.log("Testing require paths...");

try {
  // Test GitHub requires
  const GitHubClient = require("./lib/clients/github-client.js");
  const GitHubNotionClient = require("./lib/notion/github-notion-client.js");
  const GitHubCliUtils = require("./lib/utils/github-cli-utils.js");
  const GitHubWeekUtils = require("./lib/utils/github-week-utils.js");
  console.log("✅ GitHub requires work");

  // Test Oura requires
  const OuraClient = require("./lib/clients/oura-client.js");
  const OuraNotionClient = require("./lib/notion/oura-notion-client.js");
  const OuraWeekUtils = require("./lib/utils/oura-week-utils.js");
  console.log("✅ Oura requires work");

  // Test Strava requires
  const StravaClient = require("./lib/clients/strava-client.js");
  const StravaNotionClient = require("./lib/notion/strava-notion-client.js");
  const StravaWeekUtils = require("./lib/utils/strava-week-utils.js");
  console.log("✅ Strava requires work");

  console.log("\n🎉 All require paths are working correctly!");
} catch (error) {
  console.error("❌ Error testing requires:", error.message);
  process.exit(1);
}
