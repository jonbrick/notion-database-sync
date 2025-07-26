const fetch = require("node-fetch");
require("dotenv").config();

// Work repository classification
function getProjectType(repoName) {
  return repoName.startsWith("cortexapps/") ? "Work" : "Personal";
}

class GitHubClient {
  constructor(options = {}) {
    this.token = process.env.GITHUB_TOKEN;
    this.username = process.env.GITHUB_USERNAME;
    this.baseUrl = "https://api.github.com";

    // Configure work repositories to search
    this.workRepos = options.workRepos || ["cortexapps/brain-app"];
  }

  async makeRequest(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("❌ GitHub API request failed:", error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      const user = await this.makeRequest(`${this.baseUrl}/user`);
      console.log("✅ GitHub connection successful!");
      console.log(`👤 User: ${user.name} (@${user.login})`);
      return true;
    } catch (error) {
      console.error("❌ GitHub connection failed:", error.message);
      return false;
    }
  }

  async getUserEvents(startDate, endDate) {
    try {
      // The date conversion is already done in collect-github.js
      // startDate and endDate are already the correct UTC boundaries
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      console.log(
        `🔄 Searching for commits authored by ${
          this.username
        } from ${startDate.toDateString()} to ${endDate.toDateString()}`
      );

      // Search for commits you authored in the date range
      const searchQuery = `author:${this.username} committer-date:${startDateStr}..${endDateStr}`;
      const searchResults = await this.makeRequest(
        `${this.baseUrl}/search/commits?q=${encodeURIComponent(
          searchQuery
        )}&per_page=100&sort=committer-date&order=desc`
      );

      const searchCommits = searchResults.items || [];

      // Get additional commits from work repositories
      const workCommits = await this.getWorkRepoCommits(startDate, endDate);

      // Merge and deduplicate by SHA
      const allCommits = [...searchCommits];
      const existingShas = new Set(searchCommits.map((c) => c.sha));

      for (const workCommit of workCommits) {
        if (!existingShas.has(workCommit.sha)) {
          allCommits.push(workCommit);
          existingShas.add(workCommit.sha);
        }
      }

      console.log(
        `📊 Total unique commits (search + work repos): ${allCommits.length}`
      );
      return allCommits;
    } catch (error) {
      console.error("❌ Error searching for authored commits:", error.message);
      return [];
    }
  }

  async getCommitDetails(repoFullName, sha) {
    try {
      const commit = await this.makeRequest(
        `${this.baseUrl}/repos/${repoFullName}/commits/${sha}`
      );

      // First, expand work commits if they're squashed PRs
      const expandedCommits = await this.expandWorkCommitIfSquashed(
        repoFullName,
        {
          sha: commit.sha,
          message: commit.commit.message,
          date: commit.commit.author.date,
          stats: commit.stats,
          files: commit.files || [],
          author: commit.commit.author,
        }
      );

      // For work repos, we might have expanded multiple commits
      // For personal repos, we'll have the single commit with PR info
      if (
        expandedCommits.length === 1 &&
        repoFullName.startsWith("cortexapps/")
      ) {
        // Single work commit, get PR info
        const prs = await this.getCommitPRs(repoFullName, sha);
        const prTitles =
          prs.length > 0
            ? prs.map((pr) => `${pr.title} (#${pr.number})`).join(", ")
            : "";

        expandedCommits[0].prs = prs;
        expandedCommits[0].prTitles = prTitles;
      } else if (expandedCommits.length === 1) {
        // Personal repo commit, get PR info if any
        const prs = await this.getCommitPRs(repoFullName, sha);
        const prTitles =
          prs.length > 0
            ? prs.map((pr) => `${pr.title} (#${pr.number})`).join(", ")
            : "";

        expandedCommits[0].prs = prs;
        expandedCommits[0].prTitles = prTitles;
      }

      return expandedCommits;
    } catch (error) {
      console.error(`❌ Error fetching commit ${sha}:`, error.message);
      return null;
    }
  }

  async getCommitPRs(repoFullName, sha) {
    try {
      // Get PRs associated with this commit
      const prs = await this.makeRequest(
        `${this.baseUrl}/repos/${repoFullName}/commits/${sha}/pulls`
      );
      return prs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
      }));
    } catch (error) {
      console.error(`❌ Error fetching PRs for commit ${sha}:`, error.message);
      return [];
    }
  }

  async getWorkRepoCommits(startDate, endDate) {
    try {
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      console.log(
        `🔄 Fetching work repo commits from ${startDate.toDateString()} to ${endDate.toDateString()}`
      );

      console.log(
        `🔍 Searching ${
          this.workRepos.length
        } configured work repositories: ${this.workRepos.join(", ")}`
      );

      const allWorkCommits = [];

      // Fetch commits from each configured work repo
      for (const repoName of this.workRepos) {
        try {
          const commits = await this.makeRequest(
            `${this.baseUrl}/repos/${repoName}/commits?author=${this.username}&since=${startDateStr}&until=${endDateStr}&per_page=100`
          );

          if (commits.length > 0) {
            console.log(`🔍 Found ${commits.length} commits in ${repoName}`);

            // Transform to match search API format
            const transformedCommits = commits.map((commit) => ({
              sha: commit.sha,
              commit: commit.commit,
              repository: {
                full_name: repoName,
                name: repoName.split("/")[1], // Extract repo name from full name
              },
            }));

            allWorkCommits.push(...transformedCommits);
          }
        } catch (error) {
          // Skip repos we don't have access to (409 Conflict is expected)
          if (!error.message.includes("409")) {
            console.error(
              `❌ Error fetching commits from ${repoName}:`,
              error.message
            );
          }
        }
      }

      console.log(`📊 Found ${allWorkCommits.length} total work commits`);
      return allWorkCommits;
    } catch (error) {
      console.error("❌ Error fetching work repo commits:", error.message);
      return [];
    }
  }

  async expandWorkCommitIfSquashed(repoFullName, commit) {
    // Only expand commits from work repositories
    if (!repoFullName.startsWith("cortexapps/")) {
      return [commit]; // Return single commit for personal repos
    }

    try {
      console.log(
        `🔍 Checking if ${commit.sha.substring(0, 7)} is a squashed commit...`
      );

      // Check if this commit is part of any PRs
      const prs = await this.makeRequest(
        `${this.baseUrl}/repos/${repoFullName}/commits/${commit.sha}/pulls`
      );

      if (prs.length === 0) {
        // Not part of a PR, return original commit
        return [commit];
      }

      const pr = prs[0]; // Take the first PR
      console.log(`🔍 Found PR #${pr.number}: ${pr.title}`);

      // Get all commits from the PR
      const prCommits = await this.makeRequest(
        `${this.baseUrl}/repos/${repoFullName}/pulls/${pr.number}/commits`
      );

      if (prCommits.length <= 1) {
        // Only one commit in PR, return original
        return [commit];
      }

      console.log(
        `✨ Expanding squashed commit into ${prCommits.length} individual commits`
      );

      // Transform PR commits to match our expected format
      // Use the original squashed commit's stats for all expanded commits
      // This gives us the total line changes for the entire PR
      return prCommits.map((prCommit) => ({
        sha: prCommit.sha,
        message: prCommit.commit.message,
        date: prCommit.commit.author.date,
        stats: commit.stats, // Use original squashed commit's stats
        files: commit.files || [], // Use original squashed commit's files
        author: prCommit.commit.author,
        prs: [
          {
            // Keep the PR info
            number: pr.number,
            title: pr.title,
            state: pr.state,
            url: pr.html_url,
          },
        ],
        prTitles: `${pr.title} (#${pr.number})`,
      }));
    } catch (error) {
      console.error(`❌ Error expanding commit ${commit.sha}:`, error.message);
      return [commit]; // Return original commit on error
    }
  }

  async getActivities(startDate, endDate) {
    try {
      // Get GitHub events (replaces Strava activities)
      const commits = await this.getUserEvents(startDate, endDate);

      // Process events into daily activities grouped by repository
      const activities = await this.processEventsIntoActivities(
        commits,
        startDate,
        endDate
      );

      console.log(`🔨 Found ${activities.length} repositories with activity`);
      return activities;
    } catch (error) {
      console.error("❌ Error getting GitHub activities:", error.message);
      return [];
    }
  }

  async processEventsIntoActivities(commits, startDate, endDate) {
    const prGroups = {};
    const noPrGroups = {};

    console.log(`🔍 Processing ${commits.length} commits...`);

    for (const commitItem of commits) {
      const commit = commitItem.commit;
      const commitDate = new Date(commit.committer.date); // This is UTC from GitHub

      // Step 3: Convert UTC back to EST for grouping
      const estDate = new Date(commitDate.getTime() - 5 * 60 * 60 * 1000); // UTC → EST
      const dateKey = estDate.toISOString().split("T")[0]; // YYYY-MM-DD in EST

      console.log(
        `   Commit: ${commitItem.sha.substring(0, 7)} - UTC: ${
          commit.committer.date
        } → EST: ${dateKey}`
      );

      const repoName = commitItem.repository.full_name;

      // Get detailed commit information (may return multiple commits for work PRs)
      const commitDetails = await this.getCommitDetails(
        repoName,
        commitItem.sha
      );

      if (commitDetails) {
        if (Array.isArray(commitDetails)) {
          // Multiple commits from expanded PR - convert each to EST
          const estCommits = commitDetails.map((detail) => ({
            ...detail,
            date: new Date(
              new Date(detail.date).getTime() - 5 * 60 * 60 * 1000
            ).toISOString(),
          }));

          // Process each commit
          for (const commit of estCommits) {
            await this.processCommit(
              commit,
              repoName,
              dateKey,
              prGroups,
              noPrGroups
            );
          }
        } else {
          // Single commit - convert to EST
          const estCommit = {
            ...commitDetails,
            date: new Date(
              new Date(commitDetails.date).getTime() - 5 * 60 * 60 * 1000
            ).toISOString(),
          };
          await this.processCommit(
            estCommit,
            repoName,
            dateKey,
            prGroups,
            noPrGroups
          );
        }
      }
    }

    // Convert groups to activities format
    const allActivities = [];

    // Add PR-based activities
    for (const group of Object.values(prGroups)) {
      allActivities.push(this.convertToActivity(group));
    }

    // Add non-PR activities (grouped by repo-date as before)
    for (const group of Object.values(noPrGroups)) {
      allActivities.push(this.convertToActivity(group));
    }

    return allActivities;
  }

  async processCommit(commit, repoName, dateKey, prGroups, noPrGroups) {
    // Check if this commit has PRs
    const hasPRs = commit.prs && commit.prs.length > 0;

    if (hasPRs) {
      // Create separate record for each PR
      for (const pr of commit.prs) {
        const prKey = `${repoName}-${dateKey}-PR${pr.number}`;

        if (!prGroups[prKey]) {
          prGroups[prKey] = {
            repository: repoName,
            date: dateKey,
            commits: [],
            eventDate: new Date(dateKey),
            pr: pr,
            isPrRecord: true,
          };
        }

        prGroups[prKey].commits.push(commit);
      }
    } else {
      // No PRs - group by repository and date as before
      const noPrKey = `${repoName}-${dateKey}`;

      if (!noPrGroups[noPrKey]) {
        noPrGroups[noPrKey] = {
          repository: repoName,
          date: dateKey,
          commits: [],
          eventDate: new Date(dateKey),
          isPrRecord: false,
        };
      }

      noPrGroups[noPrKey].commits.push(commit);
    }
  }

  convertToActivity(repoGroup) {
    // Calculate aggregated stats
    const totalStats = repoGroup.commits.reduce(
      (acc, commit) => ({
        additions: acc.additions + (commit.stats?.additions || 0),
        deletions: acc.deletions + (commit.stats?.deletions || 0),
        total: acc.total + (commit.stats?.total || 0),
      }),
      { additions: 0, deletions: 0, total: 0 }
    );

    // Get unique files
    const allFiles = repoGroup.commits.flatMap((commit) =>
      (commit.files || []).map((file) => file.filename)
    );
    const uniqueFiles = [...new Set(allFiles)];

    // Format commit messages (CSV style)
    const commitMessages = repoGroup.commits
      .flatMap((commit) =>
        commit.allCommitMessages && commit.allCommitMessages.length > 0
          ? commit.allCommitMessages.map((msg, idx) => {
              const time = new Date(commit.date)
                .toISOString()
                .split("T")[1]
                .split(".")[0];
              return `${msg} (${time})`;
            })
          : [
              (() => {
                const time = new Date(commit.date)
                  .toISOString()
                  .split("T")[1]
                  .split(".")[0];
                return `${commit.message.split("\n")[0]} (${time})`;
              })(),
            ]
      )
      .join(", ");

    // Handle PR-specific data
    let activityName, prTitles, pullRequestsCount;

    if (repoGroup.isPrRecord && repoGroup.pr) {
      // PR record - use PR title and number
      activityName = `${repoGroup.repository} - ${repoGroup.pr.title} (#${repoGroup.pr.number})`;
      prTitles = `${repoGroup.pr.title} (#${repoGroup.pr.number})`;
      pullRequestsCount = 1;
    } else {
      // Non-PR record - format as before
      activityName = repoGroup.repository;

      // Format PR titles (CSV style) - deduplicated
      prTitles = [
        ...new Set(
          repoGroup.commits
            .filter((commit) => commit.prTitles)
            .map((commit) => commit.prTitles)
        ),
      ].join(", ");

      // Count unique PRs (by PR number)
      const uniquePRs = new Set();
      repoGroup.commits.forEach((commit) => {
        if (commit.prs && commit.prs.length > 0) {
          commit.prs.forEach((pr) => {
            uniquePRs.add(pr.number);
          });
        }
      });
      pullRequestsCount = uniquePRs.size;
    }

    // Get time range
    const commitTimes = repoGroup.commits.map((c) => new Date(c.date));
    const startTime =
      commitTimes.length > 0
        ? new Date(Math.min(...commitTimes))
        : repoGroup.eventDate;
    const endTime =
      commitTimes.length > 0
        ? new Date(Math.max(...commitTimes))
        : repoGroup.eventDate;

    // Generate unique hash ID
    let uniqueId;
    if (repoGroup.isPrRecord && repoGroup.pr) {
      // For PR records: hash of repository + date + PR number
      const hashInput = `${repoGroup.repository}-${repoGroup.date}-PR${repoGroup.pr.number}`;
      uniqueId = require("crypto")
        .createHash("sha256")
        .update(hashInput)
        .digest("hex")
        .substring(0, 16);
    } else {
      // For non-PR records: hash of repository + date + commit SHAs
      const commitShas = repoGroup.commits
        .map((c) => c.sha || c.commit?.sha || "")
        .sort()
        .join("-");
      const hashInput = `${repoGroup.repository}-${repoGroup.date}-${commitShas}`;
      uniqueId = require("crypto")
        .createHash("sha256")
        .update(hashInput)
        .digest("hex")
        .substring(0, 16);
    }

    // Generate appropriate ID for backward compatibility
    let activityId;
    if (repoGroup.isPrRecord && repoGroup.pr) {
      activityId =
        `${repoGroup.repository}-${repoGroup.date}-PR${repoGroup.pr.number}`.replace(
          /[^a-zA-Z0-9-]/g,
          "-"
        );
    } else {
      activityId = `${repoGroup.repository}-${repoGroup.date}`.replace(
        /[^a-zA-Z0-9-]/g,
        "-"
      );
    }

    // Convert to activity format (matching Strava structure)
    return {
      name: activityName,
      type: "Development",
      start_date: startTime.toISOString(),
      start_date_local: startTime.toISOString(),
      id: activityId,
      uniqueId: uniqueId, // New unique hash ID

      // GitHub-specific data
      repository: repoGroup.repository,
      projectType: getProjectType(repoGroup.repository),
      date: repoGroup.date,
      commitsCount: repoGroup.commits.length,
      commitMessages: commitMessages,
      prTitles: prTitles,
      pullRequestsCount: pullRequestsCount,
      filesChanged: uniqueFiles.length,
      filesChangedList: uniqueFiles.join(", "),
      totalLinesAdded: totalStats.additions,
      totalLinesDeleted: totalStats.deletions,
      totalChanges: totalStats.total,

      // PR-specific data for PR records
      ...(repoGroup.isPrRecord &&
        repoGroup.pr && {
          prNumber: repoGroup.pr.number,
          prTitle: repoGroup.pr.title,
          prState: repoGroup.pr.state,
          prUrl: repoGroup.pr.url,
          isPrRecord: true,
        }),

      // Times for calendar
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: Math.max(1, Math.round((endTime - startTime) / (1000 * 60))), // minutes, minimum 1
    };
  }
}

module.exports = GitHubClient;
