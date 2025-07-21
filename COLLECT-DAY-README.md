# Unified Daily Collection Script

## Overview

All collect scripts now support CLI arguments for non-interactive mode, and there's a unified `collect-day.sh` script that runs all of them for a single date.

## Usage

### Single Command for Everything

```bash
# Collect all data for July 20th, 2025
./collect-day.sh 07-20-25

# Collect all data for today (if no date provided)
./collect-day.sh

# Collect all data for yesterday
./collect-day.sh $(date -d "yesterday" +%d-%m-%y)
```

### Individual Scripts (CLI Mode)

All individual scripts now accept a date argument:

```bash
node collect-github.js 07-20-25
node collect-oura.js 07-20-25
node collect-steam.js 07-20-25
node collect-strava.js 07-20-25
node collect-withings.js 07-20-25
```

### Interactive Mode (Original Behavior)

Run any script without arguments for the original interactive prompts:

```bash
node collect-github.js  # Shows date/week selection menu
```

## Date Format

- Always use DD-MM-YY format (e.g., `07-20-25` for July 20th, 2025)
- Single digits are OK (e.g., `7-3-25`)

## What the Unified Script Does

1. **Runs all 5 collectors** in sequence with the provided date
2. **Shows progress** with emojis and clear status updates
3. **Error handling** - continues even if one service fails
4. **Summary report** - tells you which collections succeeded/failed

## Example Output

```
🗓️ Collecting all data for 07-20-25
================================================

🔨 Starting GitHub collection...
✅ GitHub collection completed successfully

😴 Starting Oura Sleep collection...
✅ Oura Sleep collection completed successfully

🎮 Starting Steam Gaming collection...
✅ Steam Gaming collection completed successfully

🏃‍♂️ Starting Strava Workouts collection...
✅ Strava Workouts collection completed successfully

⚖️ Starting Withings Body Weight collection...
✅ Withings Body Weight collection completed successfully

================================================
✅ All collections completed successfully for 07-20-25!
🎉 Collection session complete!
```

## Benefits

- ✅ **One command** instead of 5 separate interactive sessions
- ✅ **No prompts** - perfect for automation or quick daily catch-up
- ✅ **Error resilience** - one failure doesn't stop the others
- ✅ **Clear progress** - see exactly what's happening
- ✅ **Backward compatible** - original interactive mode still works
