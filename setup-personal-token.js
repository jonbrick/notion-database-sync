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

async function fixPersonalToken() {
  console.log("🔧 Quick Personal Token Fix");
  console.log("==========================\n");

  console.log(
    "Since your Work calendar is working, we just need to fix the Personal one."
  );
  console.log("This will be super simple!\n");

  const clientId = process.env.PERSONAL_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.PERSONAL_GOOGLE_CLIENT_SECRET;

  console.log("📋 Steps:");
  console.log("1. Copy and paste this URL into your browser:");
  console.log("\n" + "=".repeat(60));
  console.log(
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/calendar&response_type=code&access_type=offline&prompt=consent`
  );
  console.log("=".repeat(60));
  console.log("\n2. Sign in with your Personal Google account");
  console.log("3. Click 'Allow' for all permissions");
  console.log("4. Copy the code that appears on the page");

  const authCode = await askQuestion("\nPaste the authorization code here: ");

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      "urn:ietf:wg:oauth:2.0:oob"
    );
    const { tokens } = await oauth2Client.getToken(authCode);

    console.log("\n🎉 SUCCESS! Here's your new Personal token:");
    console.log("\n" + "=".repeat(60));
    console.log(`PERSONAL_GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log("=".repeat(60));

    console.log("\n💡 Now:");
    console.log("1. Copy the token above");
    console.log("2. Open your .env file");
    console.log("3. Replace the old PERSONAL_GOOGLE_REFRESH_TOKEN line");
    console.log("4. Save the file");
    console.log("5. Test with: node test-oauth.js");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.log("\n💡 Try again or check your Google Cloud Console settings");
  }

  rl.close();
}

fixPersonalToken().catch(console.error);
