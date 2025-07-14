# Database Sync

A comprehensive data synchronization tool that collects activity data from multiple services and syncs it to Notion databases.

## Overview

This repository contains sync scripts for collecting and storing data from various services into Notion databases:

- **GitHub Activity Sync**: Collects PR and commit activity from GitHub repositories
- **Oura Sleep Sync**: Collects sleep data and patterns from Oura Ring
- **Strava Workout Sync**: Collects workout and activity data from Strava
- **GPX Upload Utility**: Uploads GPX files to Notion (for Strava activities)
- **Steam & Withings**: Placeholder scripts for future integrations

## Project Structure

```
database-sync/
├── collect-github.js      # GitHub activity collection
├── collect-oura.js        # Oura sleep data collection
├── collect-strava.js      # Strava workout collection
├── collect-steam.js       # Steam data collection (placeholder)
├── collect-withings.js    # Withings data collection (placeholder)
├── upload-gpx.js          # GPX file upload utility
├── test-requires.js       # Dependency testing utility
├── lib/
│   ├── clients/           # API clients for each service
│   │   ├── github-client.js
│   │   ├── oura-client.js
│   │   └── strava-client.js
│   ├── notion/            # Notion integration clients
│   │   ├── github-notion-client.js
│   │   ├── oura-notion-client.js
│   │   └── strava-notion-client.js
│   └── utils/             # Utility functions
│       ├── github-cli-utils.js
│       ├── github-week-utils.js
│       ├── oura-week-utils.js
│       └── strava-week-utils.js
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
# Notion (required for all services)
NOTION_TOKEN=your_notion_token
NOTION_DATABASE_ID=your_database_id

# GitHub (for GitHub sync)
GITHUB_TOKEN=your_github_token

# Oura (for Oura sync)
OURA_TOKEN=your_oura_token

# Strava (for Strava sync)
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
STRAVA_REFRESH_TOKEN=your_strava_refresh_token
```

## Configuration

### GitHub Configuration

Edit `collect-github.js` to specify which repositories to monitor:

```javascript
const github = new GitHubClient({
  workRepos: ["cortexapps/brain-app"], // Add more repos here
});
```

### Date Selection

All scripts support two selection methods:

1. **Single Day**: Enter a specific date in DD-MM-YY format
2. **Week Selection**: Choose a week number (1-52) for the year

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
- Placeholder scripts exist for Steam and Withings integrations

## Troubleshooting

1. **Connection Issues**: Verify your environment variables are set correctly
2. **Date Selection**: Ensure dates are in the correct format (DD-MM-YY)
3. **No Data Found**: Check that the selected date range contains activity data
4. **API Limits**: Be aware of rate limits for each service's API
