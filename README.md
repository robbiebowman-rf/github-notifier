# GitHub PR Notifier

A macOS menu bar notifier that polls your open GitHub PRs and sends native notifications when CI checks pass or fail.

## Prerequisites

- macOS
- [Node.js](https://nodejs.org/) (via Homebrew: `brew install node`)
- [GitHub CLI](https://cli.github.com/) (`brew install gh`), authenticated with `gh auth login`

## Setup

1. Clone the repo and install dependencies:

   ```sh
   git clone git@github.com:robbiebowman-rf/github-notifier.git
   cd github-notifier
   npm install
   ```

2. Test it manually:

   ```sh
   node index.js
   ```

   You should see it polling your open PRs. Press `Ctrl+C` to stop.

## Running as a Launch Daemon (auto-start on login)

1. Copy the provided plist template and edit the paths to match your setup:

   ```sh
   cp com.github.notifier.plist ~/Library/LaunchAgents/com.github.notifier.plist
   ```

2. Open `~/Library/LaunchAgents/com.github.notifier.plist` and update:
   - The path to `node` (check with `which node`)
   - The path to `index.js` (absolute path to where you cloned the repo)
   - The `WorkingDirectory` to match
   - The log file paths if desired

3. Load the agent:

   ```sh
   launchctl load ~/Library/LaunchAgents/com.github.notifier.plist
   ```

4. To stop it:

   ```sh
   launchctl unload ~/Library/LaunchAgents/com.github.notifier.plist
   ```

## How it works

- Polls the GitHub GraphQL API every 30 seconds for your open PRs
- Tracks the latest commit and CI status for each PR in `~/.github-notifier-state.json`
- Sends a native macOS notification when checks change to **passed** or **failed**
- Clicking a notification opens the PR in your browser
