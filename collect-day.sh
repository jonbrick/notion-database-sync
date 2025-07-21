#!/bin/bash

# collect-day.sh - Unified collector for all data sources
# Usage: ./collect-day.sh 07-20-25         (specific date in DD-MM-YY format)
#        ./collect-day.sh yesterday        (yesterday's date)
#        ./collect-day.sh today            (today's date)
#        ./collect-day.sh tomorrow         (tomorrow's date)
#        ./collect-day.sh                  (defaults to today)

# Function to convert special date keywords to DD-MM-YY format
convert_date_input() {
    local input=$1
    
    case $input in
        "yesterday")
            date -d "yesterday" +%d-%m-%y 2>/dev/null || date -v-1d +%d-%m-%y
            ;;
        "today")
            date +%d-%m-%y
            ;;
        "tomorrow")
            date -d "tomorrow" +%d-%m-%y 2>/dev/null || date -v+1d +%d-%m-%y
            ;;
        *)
            echo "$input"
            ;;
    esac
}

# Get the date argument or default to today
INPUT_DATE=${1:-"today"}
DATE=$(convert_date_input "$INPUT_DATE")

echo "🗓️ Collecting all data for $DATE"

# Function to convert DD-MM-YY to a readable date with day of week
get_date_info() {
    local input_date=$1
    
    # Parse DD-MM-YY format
    if [[ $input_date =~ ^([0-9]{1,2})-([0-9]{1,2})-([0-9]{2})$ ]]; then
        local day=${BASH_REMATCH[1]}
        local month=${BASH_REMATCH[2]}
        local year=20${BASH_REMATCH[3]}
        
        # Convert to a format that date command can understand (MM/DD/YYYY for macOS)
        local formatted_date=$(printf "%02d/%02d/%04d" $month $day $year)
        
        # Get day of week and formatted date (macOS compatible)
        if date -j -f "%m/%d/%Y" "$formatted_date" >/dev/null 2>&1; then
            local day_of_week=$(date -j -f "%m/%d/%Y" "$formatted_date" +%A)
            local readable_date=$(date -j -f "%m/%d/%Y" "$formatted_date" +"%B %d, %Y")
            echo "📅 That's $day_of_week, $readable_date"
            return 0
        else
            echo "❌ Invalid date: $input_date"
            return 1
        fi
    else
        echo "❌ Invalid format: $input_date (expected DD-MM-YY)"
        return 1
    fi
}

# Show date info and get confirmation
if ! get_date_info "$DATE"; then
    echo "Please use DD-MM-YY format (e.g., 07-20-25)"
    exit 1
fi

echo ""
read -p "? Proceed with collecting all data for this date? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Collection cancelled"
    exit 0
fi

echo "================================================"

# Function to run a collector and track results
run_collector() {
    local script=$1
    local name=$2
    local emoji=$3
    
    echo ""
    echo "$emoji Starting $name collection..."
    
    if node "$script" "$DATE"; then
        echo "✅ $name collection completed successfully"
    else
        echo "❌ $name collection failed"
        FAILED_COLLECTORS="$FAILED_COLLECTORS $name"
    fi
}

# Initialize failed collectors list
FAILED_COLLECTORS=""

# Run all collectors
run_collector "collect-github.js" "GitHub" "🔨"
run_collector "collect-oura.js" "Oura Sleep" "😴"
run_collector "collect-steam.js" "Steam Gaming" "🎮"
run_collector "collect-strava.js" "Strava Workouts" "🏃‍♂️"
run_collector "collect-withings.js" "Withings Body Weight" "⚖️"

echo ""
echo "================================================"

# Final summary
if [ -z "$FAILED_COLLECTORS" ]; then
    echo "✅ All collections completed successfully for $DATE!"
else
    echo "⚠️  Some collections failed: $FAILED_COLLECTORS"
    echo "   You may want to run them individually to see detailed errors."
fi

echo "🎉 Collection session complete!" 