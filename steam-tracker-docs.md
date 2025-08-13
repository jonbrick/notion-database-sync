# Steam Playtime Tracker - Technical Documentation

## System Overview

A serverless AWS-based system that tracks Steam gaming sessions by capturing playtime snapshots every 30 minutes, calculating session durations, and providing daily summaries with time-of-play analysis.

## Architecture Components

### 1. Data Collection Lambda (`steam-playtime-tracker`)

- **Purpose**: Fetches Steam API data every 30 minutes and tracks playtime changes
- **Trigger**: EventBridge rule (30-minute intervals)
- **Runtime**: Node.js 20.x
- **Timeout**: 30 seconds
- **Memory**: 256 MB

### 2. Daily Summary Lambda (`steam-daily-summary`)

- **Purpose**: Aggregates daily gaming sessions and identifies play periods
- **Trigger**: EventBridge rule (midnight daily) or manual invocation
- **Runtime**: Node.js 20.x
- **Timeout**: 1 minute
- **Memory**: 256 MB

### 3. Data API Lambda (`steam-data-api`)

- **Purpose**: REST API endpoint for querying gaming data
- **Access**: Function URL (public)
- **Runtime**: Node.js 20.x
- **Timeout**: 30 seconds
- **Memory**: 256 MB

### 4. DynamoDB Table (`steam-playtime`)

- **Partition Key**: `record_id` (String)
- **No Sort Key**

## DynamoDB Data Schema

### 1. Latest Game State Records

```json
{
  "record_id": "LATEST_{game_id}",
  "game_id": "1086940",
  "game_name": "Baldur's Gate 3",
  "timestamp": "2025-07-16T15:54:48.000Z",
  "total_minutes": 27375
}
```

### 2. Session Records

```json
{
  "record_id": "{timestamp}_{game_id}",
  "game_id": "1086940",
  "game_name": "Baldur's Gate 3",
  "timestamp": "2025-07-16T15:54:48.000Z",
  "date": "2025-07-16",
  "total_minutes": 27375,
  "session_minutes": 26
}
```

### 3. Daily Summary Records

```json
{
  "record_id": "DAILY_{date}_{game_id}",
  "date": "2025-07-16",
  "game_id": "1086940",
  "game_name": "Baldur's Gate 3",
  "total_minutes": 150,
  "total_hours": 2.5,
  "play_periods": [
    {
      "start_time": "15:00",
      "end_time": "16:30",
      "duration_minutes": 90,
      "checks": 3
    }
  ],
  "period_count": 1
}
```

## Lambda Function Code

### steam-playtime-tracker

```javascript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  console.log("Starting Steam playtime check...");

  try {
    // Get Steam data
    const steamUrl = `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${process.env.STEAM_API_KEY}&steamid=${process.env.STEAM_ID}&include_appinfo=1&include_played_free_games=1&format=json`;

    console.log("Fetching Steam data...");
    const response = await fetch(steamUrl);
    const data = await response.json();

    if (!data.response || !data.response.games) {
      throw new Error("No games data in response");
    }

    const games = data.response.games;
    const timestamp = new Date().toISOString();
    const date = timestamp.split("T")[0];

    console.log(`Found ${games.length} games. Processing...`);

    let gamesUpdated = 0;

    // Process each game
    for (const game of games) {
      if (game.playtime_forever > 0) {
        // Only track played games
        const gameId = String(game.appid);
        const currentMinutes = game.playtime_forever;

        // Get last reading
        let lastMinutes = currentMinutes;
        let delta = 0;

        try {
          const getCommand = new GetCommand({
            TableName: "steam-playtime",
            Key: { record_id: `LATEST_${gameId}` },
          });

          const lastReading = await docClient.send(getCommand);
          if (lastReading.Item) {
            lastMinutes = lastReading.Item.total_minutes;
            delta = currentMinutes - lastMinutes;
          }
        } catch (err) {
          console.log(`First time tracking ${game.name}`);
        }

        // Only store if there's a change
        if (delta > 0) {
          console.log(`${game.name}: +${delta} minutes`);

          // Store historical record
          const putCommand = new PutCommand({
            TableName: "steam-playtime",
            Item: {
              record_id: `${timestamp}_${gameId}`,
              game_id: gameId,
              game_name: game.name,
              timestamp: timestamp,
              date: date,
              total_minutes: currentMinutes,
              session_minutes: delta,
            },
          });
          await docClient.send(putCommand);

          gamesUpdated++;
        }

        // Always update latest pointer
        const updateLatestCommand = new PutCommand({
          TableName: "steam-playtime",
          Item: {
            record_id: `LATEST_${gameId}`,
            game_id: gameId,
            game_name: game.name,
            timestamp: timestamp,
            total_minutes: currentMinutes,
          },
        });
        await docClient.send(updateLatestCommand);
      }
    }

    console.log(`Updated ${gamesUpdated} games with playtime changes`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully tracked ${gamesUpdated} games`,
        timestamp: timestamp,
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
};
```

### steam-daily-summary

```javascript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  console.log("Starting daily summary generation...");

  try {
    // Get date from event or use yesterday
    let targetDate;
    if (event.date) {
      targetDate = event.date;
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      targetDate = yesterday.toISOString().split("T")[0];
    }

    console.log(`Processing date: ${targetDate}`);

    // Scan for all records from target date with session_minutes
    const scanCommand = new ScanCommand({
      TableName: "steam-playtime",
      FilterExpression:
        "#date = :date AND attribute_exists(session_minutes) AND session_minutes > :zero",
      ExpressionAttributeNames: {
        "#date": "date",
      },
      ExpressionAttributeValues: {
        ":date": targetDate,
        ":zero": 0,
      },
    });

    const response = await docClient.send(scanCommand);
    console.log(`Found ${response.Items.length} gaming sessions`);

    if (response.Items.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `No gaming sessions found for ${targetDate}`,
        }),
      };
    }

    // Group sessions by game
    const gameData = {};

    response.Items.forEach((item) => {
      const gameId = item.game_id;
      if (!gameData[gameId]) {
        gameData[gameId] = {
          game_name: item.game_name,
          sessions: [],
          total_minutes: 0,
        };
      }

      gameData[gameId].sessions.push({
        timestamp: item.timestamp,
        minutes: item.session_minutes,
      });
      gameData[gameId].total_minutes += item.session_minutes;
    });

    // Process each game
    let summariesCreated = 0;

    for (const [gameId, data] of Object.entries(gameData)) {
      // Sort sessions by timestamp
      data.sessions.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      // Detect play periods (group consecutive sessions)
      const playPeriods = [];
      let currentPeriod = null;

      data.sessions.forEach((session, index) => {
        const sessionTime = new Date(session.timestamp);
        const sessionHour = sessionTime.getHours();

        if (!currentPeriod) {
          // Start new period
          currentPeriod = {
            start_hour: sessionHour,
            end_hour: sessionHour,
            minutes: session.minutes,
            session_count: 1,
          };
        } else {
          // Check if this is part of the same gaming period (within 1 hour)
          const prevSession = data.sessions[index - 1];
          const timeDiff =
            (sessionTime - new Date(prevSession.timestamp)) / 1000 / 60; // minutes

          if (timeDiff <= 90) {
            // Same gaming period if within 90 minutes
            currentPeriod.end_hour = sessionHour;
            currentPeriod.minutes += session.minutes;
            currentPeriod.session_count++;
          } else {
            // Gap too large, save current period and start new one
            playPeriods.push(currentPeriod);
            currentPeriod = {
              start_hour: sessionHour,
              end_hour: sessionHour,
              minutes: session.minutes,
              session_count: 1,
            };
          }
        }
      });

      // Don't forget the last period
      if (currentPeriod) {
        playPeriods.push(currentPeriod);
      }

      // Format play periods for storage
      const formattedPeriods = playPeriods.map((period) => ({
        start_time: `${period.start_hour}:00`,
        end_time: `${period.end_hour}:30`, // Since we check every 30 min
        duration_minutes: period.minutes,
        checks: period.session_count,
      }));

      // Store daily summary
      const summaryItem = {
        record_id: `DAILY_${targetDate}_${gameId}`,
        date: targetDate,
        game_id: gameId,
        game_name: data.game_name,
        total_minutes: data.total_minutes,
        total_hours: Number((data.total_minutes / 60).toFixed(1)),
        play_periods: formattedPeriods,
        period_count: formattedPeriods.length,
      };

      console.log(
        `Saving summary for ${data.game_name}: ${data.total_minutes} minutes across ${formattedPeriods.length} periods`
      );

      const putCommand = new PutCommand({
        TableName: "steam-playtime",
        Item: summaryItem,
      });

      await docClient.send(putCommand);
      summariesCreated++;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Created ${summariesCreated} daily summaries for ${targetDate}`,
        games: Object.keys(gameData).map((gameId) => ({
          game: gameData[gameId].game_name,
          total_minutes: gameData[gameId].total_minutes,
        })),
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
```

## API Endpoints

### Base URL

```
https://your-lambda-url.lambda-url.region.on.aws/
```

### Endpoints

1. **Get Today's Gaming**

   ```
   GET /
   ```

2. **Get Specific Date**

   ```
   GET /?date=2025-07-16
   ```

3. **Get Date Range**

   ```
   GET /?start=2025-07-01&end=2025-07-31
   ```

4. **Get Period**
   ```
   GET /?period=week
   GET /?period=month
   ```

### Response Format

```json
{
  "date": "2025-07-16",
  "total_hours": 2.5,
  "game_count": 1,
  "games": [
    {
      "name": "Baldur's Gate 3",
      "hours": 2.5,
      "minutes": 150,
      "sessions": [
        {
          "start_time": "15:00",
          "end_time": "16:30",
          "duration_minutes": 90,
          "checks": 3
        }
      ]
    }
  ]
}
```

## Environment Variables

### steam-playtime-tracker

- `STEAM_API_KEY`: <your-steam-api-key>
- `STEAM_ID`: <your-steam-id>

## EventBridge Schedules

### 1. Playtime Tracker (30 minutes)

- **Name**: `steam-playtime-30min`
- **Target**: `steam-playtime-tracker`
- **Schedule**: Rate-based, 30 minutes

### 2. Daily Summary (Midnight)

- **Name**: `steam-daily-summary-midnight`
- **Target**: `steam-daily-summary`
- **Schedule**: Cron-based, `1 0 * * ? *`
- **Payload**: `{}`

## IAM Permissions

All Lambda functions require:

- Basic Lambda execution role
- `AmazonDynamoDBFullAccess` policy

## Usage Examples

### JavaScript/Node.js

```javascript
const fetch = require("node-fetch");

async function getWeeklyGaming() {
  const response = await fetch(
    "https://your-lambda-url.lambda-url.region.on.aws/?period=week"
  );
  const data = await response.json();

  console.log(`This week: ${data.total_hours} hours`);
  data.games.forEach((game) => {
    console.log(`- ${game.name}: ${game.total_hours} hours`);
  });
}
```

### Python

```python
import requests

response = requests.get('https://your-lambda-url.lambda-url.region.on.aws/?period=week')
data = response.json()

print(f"This week: {data['total_hours']} hours")
for game in data['games']:
    print(f"- {game['name']}: {game['total_hours']} hours")
```

### cURL

```bash
# Get this week's data
curl "https://your-lambda-url.lambda-url.region.on.aws/?period=week"

# Get specific date
curl "https://your-lambda-url.lambda-url.region.on.aws/?date=2025-07-16"
```

## Maintenance Notes

1. **Steam Profile**: Must remain public for API access
2. **API Rate Limits**: Steam API has generous limits, 30-minute intervals are safe
3. **DynamoDB Costs**: Free tier includes 25GB storage and millions of requests
4. **Lambda Costs**: Free tier includes 1M requests/month
5. **Monitoring**: Check CloudWatch logs for Lambda execution details

## Troubleshooting

### No data appearing

1. Check Steam profile is public
2. Verify environment variables in Lambda
3. Check CloudWatch logs for errors
4. Ensure EventBridge rules are enabled

### Missing play sessions

1. Steam API updates can lag 5-10 minutes
2. Sessions under 5 minutes might not register
3. Check timezone settings if times seem off

### API errors

1. Verify DynamoDB permissions
2. Check Lambda timeout settings
3. Ensure Function URL is configured correctly

## Future Enhancements

1. **Notifications**: Add SNS alerts for gaming milestones
2. **Data Export**: S3 integration for CSV exports
3. **Visualization**: Web dashboard with charts
4. **Game Goals**: Track weekly/monthly gaming targets
5. **Cost Optimization**: Implement DynamoDB TTL for old session records
