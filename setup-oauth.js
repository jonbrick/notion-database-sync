const { google } = require("googleapis");
const readline = require("readline");
require("dotenv").config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function setupOAuth(accountType) {
  console.log(`\n🔧 Setting up OAuth for ${accountType} account...\n`);

  // Get OAuth credentials from user
  const clientId = await askQuestion(
    `Enter your ${accountType} Google Client ID: `
  );
  const clientSecret = await askQuestion(
    `Enter your ${accountType} Google Client Secret: `
  );

  // Create OAuth2 client with redirect URI
  const redirectUri = "urn:ietf:wg:oauth:2.0:oob"; // Out-of-band URI for desktop apps
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  // Generate authorization URL
  const scopes = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent", // Force consent to get refresh token
  });

  console.log(`\n📋 Follow these steps:`);
  console.log(`1. Open this URL in your browser:`);
  console.log(`   ${authUrl}`);
  console.log(`\n2. Sign in with your ${accountType} Google account`);
  console.log(`3. Grant the requested permissions`);
  console.log(`4. Copy the authorization code from the URL`);

  const authCode = await askQuestion(`\nEnter the authorization code: `);

  try {
    // Exchange auth code for tokens
    const { tokens } = await oauth2Client.getToken(authCode);

    console.log(`\n✅ OAuth setup successful for ${accountType} account!`);
    console.log(`\n📝 Add these to your .env file:`);
    console.log(`\n# ${accountType} Google Calendar Configuration`);
    console.log(`${accountType.toUpperCase()}_GOOGLE_CLIENT_ID=${clientId}`);
    console.log(
      `${accountType.toUpperCase()}_GOOGLE_CLIENT_SECRET=${clientSecret}`
    );
    console.log(
      `${accountType.toUpperCase()}_GOOGLE_REFRESH_TOKEN=${
        tokens.refresh_token
      }`
    );

    return {
      clientId,
      clientSecret,
      refreshToken: tokens.refresh_token,
    };
  } catch (error) {
    console.error(`❌ Error getting tokens:`, error.message);
    return null;
  }
}

async function main() {
  console.log("🔄 Google OAuth Setup Script");
  console.log("============================\n");

  console.log(
    "This script will help you regenerate your Google OAuth refresh tokens."
  );
  console.log(
    "You'll need to create OAuth 2.0 credentials in Google Cloud Console.\n"
  );

  const setupPersonal = await askQuestion(
    "Do you want to setup Personal account OAuth? (y/n): "
  );
  let personalTokens = null;

  if (setupPersonal.toLowerCase() === "y") {
    personalTokens = await setupOAuth("Personal");
  }

  const setupWork = await askQuestion(
    "\nDo you want to setup Work account OAuth? (y/n): "
  );
  let workTokens = null;

  if (setupWork.toLowerCase() === "y") {
    workTokens = await setupOAuth("Work");
  }

  if (personalTokens || workTokens) {
    console.log("\n📋 Summary of tokens to add to .env:");
    console.log("=====================================");

    if (personalTokens) {
      console.log("\n# Personal Google Calendar Configuration");
      console.log(`PERSONAL_GOOGLE_CLIENT_ID=${personalTokens.clientId}`);
      console.log(
        `PERSONAL_GOOGLE_CLIENT_SECRET=${personalTokens.clientSecret}`
      );
      console.log(
        `PERSONAL_GOOGLE_REFRESH_TOKEN=${personalTokens.refreshToken}`
      );
    }

    if (workTokens) {
      console.log("\n# Work Google Calendar Configuration");
      console.log(`WORK_GOOGLE_CLIENT_ID=${workTokens.clientId}`);
      console.log(`WORK_GOOGLE_CLIENT_SECRET=${workTokens.clientSecret}`);
      console.log(`WORK_GOOGLE_REFRESH_TOKEN=${workTokens.refreshToken}`);
    }

    console.log("\n💡 Instructions:");
    console.log("1. Copy the above tokens to your .env file");
    console.log("2. Replace the existing values with these new ones");
    console.log("3. Test the connection with: node update-cal.js");
  }

  rl.close();
}

main().catch(console.error);
