const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");
const NotionClient = require("./lib/notion/strava-notion-client.js");
const readline = require("readline");

class GPXParser {
  constructor() {
    this.parser = new xml2js.Parser();
  }

  async parseGPXFile(filePath) {
    try {
      const gpxData = fs.readFileSync(filePath, "utf8");
      const result = await this.parser.parseStringPromise(gpxData);

      const gpx = result.gpx;
      const metadata = gpx.metadata[0];
      const track = gpx.trk[0];

      // Parse the UTC time from GPX metadata
      const utcTime = new Date(metadata.time[0]);

      // Extract basic info
      const startTime = utcTime; // Keep original UTC for calculations
      const activityName = track.name[0];
      const activityType = track.type[0];

      // Parse track points
      const trackSegments = track.trkseg;
      const allPoints = [];

      trackSegments.forEach((segment) => {
        if (segment.trkpt) {
          segment.trkpt.forEach((point) => {
            const lat = parseFloat(point.$.lat);
            const lon = parseFloat(point.$.lon);
            const ele = point.ele ? parseFloat(point.ele[0]) : null;
            const time = new Date(point.time[0]);

            // Extract heart rate and cadence if available
            let hr = null;
            let cad = null;

            if (
              point.extensions &&
              point.extensions[0]["gpxtpx:TrackPointExtension"]
            ) {
              const ext = point.extensions[0]["gpxtpx:TrackPointExtension"][0];
              hr = ext["gpxtpx:hr"] ? parseInt(ext["gpxtpx:hr"][0]) : null;
              cad = ext["gpxtpx:cad"] ? parseInt(ext["gpxtpx:cad"][0]) : null;
            }

            allPoints.push({
              lat,
              lon,
              ele,
              time,
              hr,
              cad,
            });
          });
        }
      });

      // Calculate workout statistics
      const stats = this.calculateStats(allPoints);

      // Map GPX type to Strava/Notion style
      const typeMap = {
        running: "Run",
        cycling: "Ride",
        swimming: "Swim",
        walk: "Walk",
        hiking: "Hike",
        workout: "Workout",
        other: "Workout",
      };
      const mappedType =
        typeMap[(activityType || "").toLowerCase()] || "Workout";

      // Create EST time string by formatting the UTC time in EST timezone
      const estTimeString =
        utcTime
          .toLocaleString("sv-SE", {
            timeZone: "America/New_York",
          })
          .replace(" ", "T") + "-04:00";

      return {
        name: activityName,
        type: mappedType,
        start_date: startTime.toISOString(),
        start_date_local: estTimeString,
        distance: stats.distance,
        moving_time: stats.movingTime,
        total_elevation_gain: stats.elevationGain,
        average_heartrate: stats.avgHR,
        max_heartrate: stats.maxHR,
        average_cadence: stats.avgCadence,
        id: Date.now(),
        points: allPoints,
        stats,
      };
    } catch (error) {
      throw new Error(`Failed to parse GPX file: ${error.message}`);
    }
  }

  calculateStats(points) {
    if (points.length < 2) {
      return {
        distance: 0,
        movingTime: 0,
        elevationGain: 0,
        avgHR: null,
        maxHR: null,
        avgCadence: null,
      };
    }

    let totalDistance = 0;
    let totalElevationGain = 0;
    let movingTime = 0;
    const heartRates = [];
    const cadences = [];

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];

      // Calculate distance between points (Haversine formula)
      const distance = this.calculateDistance(
        prev.lat,
        prev.lon,
        curr.lat,
        curr.lon
      );
      totalDistance += distance;

      // Calculate elevation gain
      if (prev.ele && curr.ele && curr.ele > prev.ele) {
        totalElevationGain += curr.ele - prev.ele;
      }

      // Calculate moving time (time between points)
      const timeDiff = (curr.time - prev.time) / 1000; // seconds
      movingTime += timeDiff;

      // Collect heart rate and cadence data
      if (curr.hr) heartRates.push(curr.hr);
      if (curr.cad) cadences.push(curr.cad);
    }

    return {
      distance: Math.round(totalDistance * 1000), // Convert to meters
      movingTime: Math.round(movingTime), // seconds
      elevationGain: Math.round(totalElevationGain),
      avgHR:
        heartRates.length > 0
          ? Math.round(
              heartRates.reduce((a, b) => a + b, 0) / heartRates.length
            )
          : null,
      maxHR: heartRates.length > 0 ? Math.max(...heartRates) : null,
      avgCadence:
        cadences.length > 0
          ? Math.round(cadences.reduce((a, b) => a + b, 0) / cadences.length)
          : null,
    };
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
}

async function uploadGPXWorkout(gpxFilePath) {
  console.log("📁 GPX Workout Uploader\n");

  // Check if file exists
  if (!fs.existsSync(gpxFilePath)) {
    console.log(`❌ File not found: ${gpxFilePath}`);
    return;
  }

  // Parse GPX file
  console.log("1. Parsing GPX file...");
  const parser = new GPXParser();
  let workoutData;

  try {
    workoutData = await parser.parseGPXFile(gpxFilePath);
    console.log("✅ GPX file parsed successfully");
  } catch (error) {
    console.log(`❌ Failed to parse GPX: ${error.message}`);
    return;
  }

  // Display workout information
  console.log("\n2. Workout Information:");
  console.log(`   Name: ${workoutData.name}`);
  console.log(`   Type: ${workoutData.type}`);
  console.log(`   Date: ${new Date(workoutData.start_date).toDateString()}`);
  console.log(`   Distance: ${(workoutData.distance / 1000).toFixed(2)}km`);
  console.log(
    `   Duration: ${Math.floor(workoutData.moving_time / 60)}min ${
      workoutData.moving_time % 60
    }s`
  );
  console.log(`   Elevation Gain: ${workoutData.total_elevation_gain}m`);
  if (workoutData.average_heartrate) {
    console.log(`   Avg HR: ${workoutData.average_heartrate}bpm`);
  }
  if (workoutData.max_heartrate) {
    console.log(`   Max HR: ${workoutData.max_heartrate}bpm`);
  }
  if (workoutData.average_cadence) {
    console.log(`   Avg Cadence: ${workoutData.average_cadence}spm`);
  }
  console.log(`   Track Points: ${workoutData.points.length}`);

  // Test Notion connection
  console.log("\n3. Testing Notion connection...");
  const notion = new NotionClient();
  const notionOk = await notion.testConnection();

  if (!notionOk) {
    console.log("❌ Notion connection failed");
    return;
  }

  // Create workout record
  console.log("\n4. Creating workout record in Notion...");
  try {
    await notion.createWorkoutRecord(workoutData);
    console.log("✅ Workout record created successfully!");
    console.log(
      `📊 Saved: ${workoutData.name} | ${workoutData.type} | ${(
        workoutData.distance / 1000
      ).toFixed(2)}km`
    );
  } catch (error) {
    console.log(`❌ Failed to create workout record: ${error.message}`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  let gpxFilePath = args[0];

  if (!gpxFilePath) {
    // Interactive prompt for file path
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    gpxFilePath = await new Promise((resolve) => {
      rl.question("? Enter the path to your GPX file: ", (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
    if (!gpxFilePath) {
      console.log("❌ No file path provided. Exiting.");
      return;
    }
  }

  await uploadGPXWorkout(gpxFilePath);
}

main().catch(console.error);
