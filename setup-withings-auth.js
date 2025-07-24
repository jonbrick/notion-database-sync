const http = require("http");
const url = require("url");
const fetch = require("node-fetch");
require("dotenv").config();

const CLIENT_ID = process.env.WITHINGS_CLIENT_ID;
const CLIENT_SECRET = process.env.WITHINGS_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3000/callback";
const PORT = 3000;

console.log("🔐 Withings OAuth Token Generator\n");

// Create a simple HTTP server to handle the callback
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname === "/callback") {
    const code = parsedUrl.query.code;

    if (code) {
      console.log("✅ Authorization code received:", code);

      // Exchange code for access token
      try {
        const tokenResponse = await fetch(
          "https://wbsapi.withings.net/v2/oauth2",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              action: "requesttoken",
              grant_type: "authorization_code",
              client_id: CLIENT_ID,
              client_secret: CLIENT_SECRET,
              code: code,
              redirect_uri: REDIRECT_URI,
            }),
          }
        );

        const tokenData = await tokenResponse.json();

        if (tokenData.status === 0) {
          console.log("\n🎉 Success! Here are your tokens:\n");
          console.log("Add these to your .env file:");
          console.log(`WITHINGS_ACCESS_TOKEN=${tokenData.body.access_token}`);
          console.log(`WITHINGS_REFRESH_TOKEN=${tokenData.body.refresh_token}`);
          console.log(
            `\nTokens expire in ${tokenData.body.expires_in} seconds`
          );

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<h1>Success!</h1><p>Tokens have been generated. Check your terminal and update your .env file.</p><p>You can close this window.</p>"
          );

          // Close server after a delay
          setTimeout(() => {
            server.close();
            process.exit(0);
          }, 2000);
        } else {
          console.error("❌ Token exchange failed:", tokenData);
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end(
            "<h1>Error</h1><p>Failed to exchange code for tokens. Check console.</p>"
          );
        }
      } catch (error) {
        console.error("❌ Error exchanging code:", error);
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(
          "<h1>Error</h1><p>Failed to exchange code for tokens. Check console.</p>"
        );
      }
    } else {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end("<h1>Error</h1><p>No authorization code received.</p>");
    }
  } else {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end("<h1>404 Not Found</h1>");
  }
});

server.listen(PORT, () => {
  console.log(`🌐 OAuth callback server listening on http://localhost:${PORT}`);

  // Generate authorization URL
  const authUrl = new URL(
    "https://account.withings.com/oauth2_user/authorize2"
  );
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("client_id", CLIENT_ID);
  authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.append("scope", "user.metrics");
  authUrl.searchParams.append("state", "init");

  console.log("\n📋 Steps to get your tokens:\n");
  console.log("1. Open this URL in your browser:");
  console.log(`\n${authUrl.toString()}\n`);
  console.log("2. Log in to your Withings account");
  console.log("3. Authorize the application");
  console.log("4. You will be redirected back here");
  console.log("5. Copy the tokens from the terminal to your .env file\n");
  console.log("Waiting for authorization...\n");
});
