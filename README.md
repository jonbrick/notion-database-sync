# Database Sync

A comprehensive data synchronization tool that collects activity data from multiple services and syncs it to Notion databases.

## Overview

This repository contains sync scripts for collecting and storing data from various services into Notion databases:

- **GitHub Activity Sync**: Collects PR and commit activity from GitHub repositories
- **Oura Sleep Sync**: Collects sleep data and patterns from Oura Ring
- **Strava Workout Sync**: Collects workout and activity data from Strava
- **Steam Gaming Sync**: Collects gaming activity data from Steam via Lambda API
- **Withings Body Sync**: Collects body measurement data from Withings scales
- **GPX Upload Utility**: Uploads GPX files to Notion (for Strava activities)

## Project Structure

```
database-sync/
├── collect-github.js      # GitHub activity collection
├── collect-oura.js        # Oura sleep data collection
├── collect-strava.js      # Strava workout collection
├── collect-steam.js       # Steam gaming activity collection
├── collect-withings.js    # Withings body measurement collection
├── upload-gpx.js          # GPX file upload utility
├── withings-auth.js       # Withings OAuth authentication helper
├── test-requires.js       # Dependency testing utility
├── lib/
│   ├── clients/           # API clients for each service
│   │   ├── github-client.js
│   │   ├── oura-client.js
│   │   ├── steam-client.js
│   │   ├── strava-client.js
│   │   └── withings-client.js
│   ├── notion/            # Notion integration clients
│   │   ├── github-notion-client.js
│   │   ├── oura-notion-client.js
│   │   ├── steam-notion-client.js
│   │   ├── strava-notion-client.js
│   │   └── withings-notion-client.js
│   └── utils/             # Utility functions
│       ├── github-cli-utils.js
│       ├── github-week-utils.js
│       ├── oura-week-utils.js
│       ├── steam-week-utils.js
│       ├── strava-week-utils.js
│       └── withings-week-utils.js
├── package.json
└── README.md
```

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables (see Environment Variables section below)

## Usage

### GitHub Activity Sync

Collects GitHub activity (commits, PRs) from specified repositories:

```bash
npm run github
# or
node collect-github.js
```

**Features:**

- Single day or week-based collection
- Configurable repository list in the script
- EST/UTC timezone handling
- Interactive date selection

### Oura Sleep Sync

Collects sleep data from Oura Ring:

```bash
npm run oura
# or
node collect-oura.js
```

**Features:**

- Single night or week-based collection
- "Night of" date calculation (Oura API uses next day)
- Sleep session processing and transformation

### Strava Workout Sync

Collects workout and activity data from Strava:

```bash
npm run strava
# or
node collect-strava.js
```

**Features:**

- Single day or week-based collection
- Activity filtering and processing
- GPX file support for detailed workout data

### Steam Gaming Sync

Collects gaming activity data from Steam via custom Lambda API:

```bash
npm run steam
# or
node collect-steam.js
```

**Features:**

- Single day or week-based collection
- Fetches gaming sessions with start/end times
- Tracks playtime per game per day
- Deduplication to avoid duplicate entries
- Support for multiple gaming sessions per day

### Withings Body Sync

Collects body measurement data from Withings scales:

```bash
npm run withings
# or
node collect-withings.js
```

**Features:**

- Single day or week-based collection
- Supports multiple measurement types (weight, body fat, muscle mass, etc.)
- Automatic token refresh
- Deduplication of measurements

### GPX Upload Utility

Uploads GPX files to Notion for Strava activities:

```bash
npm run upload-gpx
# or
node upload-gpx.js
```

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# GitHub (for GitHub sync)
GITHUB_TOKEN=your_github_token
GITHUB_USERNAME=your_github_username
GITHUB_NOTION_TOKEN=your_notion_token
GITHUB_NOTION_DATABASE_ID=your_database_id

# Oura (for Oura sync)
OURA_ACCESS_TOKEN=your_oura_token
OURA_NOTION_TOKEN=your_notion_token
OURA_NOTION_DATABASE_ID=your_database_id

# Strava (for Strava sync)
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
STRAVA_ACCESS_TOKEN=your_strava_access_token
STRAVA_REFRESH_TOKEN=your_strava_refresh_token
STRAVA_NOTION_TOKEN=your_notion_token
STRAVA_NOTION_DATABASE_ID=your_database_id

# Steam (for Steam sync)
STEAM_URL=https://fmbemz2etdgk23bce3wvf2yk540kezhy.lambda-url.us-east-2.on.aws
STEAM_NOTION_TOKEN=your_notion_token
STEAM_NOTION_DATABASE_ID=your_database_id

# Withings (for Withings sync)
WITHINGS_CLIENT_ID=your_withings_client_id
WITHINGS_CLIENT_SECRET=your_withings_client_secret
WITHINGS_ACCESS_TOKEN=your_withings_access_token
WITHINGS_REFRESH_TOKEN=your_withings_refresh_token
WITHINGS_NOTION_TOKEN=your_notion_token
WITHINGS_NOTION_DATABASE_ID=your_database_id
```

## Configuration

### GitHub Configuration

Edit `collect-github.js` to specify which repositories to monitor:

```javascript
const github = new GitHubClient({
  workRepos: ["cortexapps/brain-app"], // Add more repos here
});
```

### Steam Configuration

The Steam sync uses a custom Lambda API endpoint. The URL can be configured via the `STEAM_URL` environment variable. The API returns gaming data in the following format:

```json
{
  "date": "2025-07-16",
  "total_hours": 0.4,
  "game_count": 1,
  "games": [
    {
      "name": "Baldur's Gate 3",
      "hours": 0.4,
      "minutes": 26,
      "sessions": [
        {
          "start_time": "15:00",
          "end_time": "15:30",
          "duration_minutes": 26
        }
      ]
    }
  ]
}
```

### Date Selection

All scripts support two selection methods:

1. **Single Day**: Enter a specific date in DD-MM-YY format
2. **Week Selection**: Choose a week number (1-52) for the year

## Notion Database Setup

Each service requires a Notion database with specific properties:

### Steam Database Properties

- **Game Name** (Title): Name of the game
- **Date** (Date): Date of gaming session
- **Hours Played** (Number): Total hours played
- **Minutes Played** (Number): Total minutes played
- **Session Count** (Number): Number of gaming sessions
- **Session Details** (Text): Start/end times and durations
- **Start Time** (Text): First session start time
- **End Time** (Text): Last session end time
- **Platform** (Select): Gaming platform (defaults to "Steam")
- **Calendar Created** (Checkbox): Whether calendar event was created
- **Activity ID** (Text): Unique identifier for deduplication

## Dependencies

- `@notionhq/client`: Notion API integration
- `dotenv`: Environment variable management
- `inquirer`: CLI prompts
- `node-fetch`: HTTP requests
- `xml2js`: XML parsing (for GPX files)

## Development

### Testing Dependencies

Run the test script to verify all required modules are available:

```bash
node test-requires.js
```

### Adding New Services

To add a new service:

1. Create a client in `lib/clients/`
2. Create a Notion client in `lib/notion/`
3. Create utility functions in `lib/utils/`
4. Create a collection script in the root directory
5. Add the script to `package.json` scripts

## Notes

- Each script can be run independently
- All scripts include connection testing before execution
- Interactive prompts guide users through date selection
- Timezone handling is built-in for accurate data collection
- Deduplication is supported to avoid duplicate entries

## Troubleshooting

1. **Connection Issues**: Verify your environment variables are set correctly
2. **Date Selection**: Ensure dates are in the correct format (DD-MM-YY)
3. **No Data Found**: Check that the selected date range contains activity data
4. **API Limits**: Be aware of rate limits for each service's API
5. **Steam API**: Ensure the Lambda endpoint is accessible and returning data
