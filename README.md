# Notion Sync Combined

A unified repository containing sync scripts for GitHub, Oura, and Strava data to Notion.

## Overview

This repository combines three previously separate sync tools:

- **GitHub Activity Sync**: Collects PR and commit activity
- **Oura Sleep Sync**: Collects sleep data and patterns
- **Strava Workout Sync**: Collects workout and activity data

## Structure

```
combined-sync/
├── scripts/
│   ├── collect-github.js    # GitHub activity collection
│   ├── collect-oura.js      # Oura sleep data collection
│   ├── collect-strava.js    # Strava workout collection
│   └── upload-gpx.js        # GPX file upload utility
├── lib/
│   ├── clients/             # API clients for each service
│   │   ├── github-client.js
│   │   ├── oura-client.js
│   │   └── strava-client.js
│   ├── notion/              # Notion integration clients
│   │   ├── github-notion-client.js
│   │   ├── oura-notion-client.js
│   │   └── strava-notion-client.js
│   └── utils/               # Utility functions
│       ├── github-cli-utils.js
│       ├── github-week-utils.js
│       ├── oura-week-utils.js
│       └── strava-week-utils.js
└── package.json
```

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy your `.env` file from one of the original repos and merge any additional environment variables needed

## Usage

### GitHub Activity Sync

```bash
npm run github
# or
node scripts/collect-github.js
```

### Oura Sleep Sync

```bash
npm run oura
# or
node scripts/collect-oura.js
```

### Strava Workout Sync

```bash
npm run strava
# or
node scripts/collect-strava.js
```

### GPX Upload Utility

```bash
npm run upload-gpx
# or
node scripts/upload-gpx.js
```

## Environment Variables

You'll need to set up environment variables for each service. Here's a template:

```env
# Notion (required for all services)
# Note: NOTION_TOKEN and NOTION_DATABASE_ID are specifically for GitHub activity data
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

# Google Calendar (optional, used by some scripts)
GOOGLE_APPLICATION_CREDENTIALS=path_to_credentials.json
```

## Migration from Individual Repos

This repository was created by combining three separate sync repositories:

- `sync-github/`
- `sync-oura/`
- `sync-strava/`

All functionality has been preserved, with updated require paths to work within the new structure.

## Dependencies

- `@notionhq/client`: Notion API integration
- `dotenv`: Environment variable management
- `googleapis`: Google Calendar integration
- `inquirer`: CLI prompts
- `node-fetch`: HTTP requests
- `xml2js`: XML parsing (for GPX files)

## Notes

- Each script can be run independently
- All scripts maintain their original functionality
- Environment variables need to be merged from the original repos
- The original repos are preserved as backups
