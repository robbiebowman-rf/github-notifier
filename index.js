const { execSync } = require('child_process');
const notifier = require('node-notifier');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Ensure gh can be found when run via launchd
process.env.PATH = `/opt/homebrew/bin:${process.env.PATH}`;

const STATE_FILE = path.join(os.homedir(), '.github-notifier-state.json');
const POLL_INTERVAL_MS = 30 * 1000;

function readState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function fetchPRs() {
  const query = `
    query {
      viewer {
        pullRequests(states: OPEN, first: 20, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            title
            url
            repository { nameWithOwner }
            commits(last: 1) { nodes { commit { oid statusCheckRollup { state } } } }
          }
        }
      }
    }
  `;
  try {
    const output = execSync(`gh api graphql -f query='${query}'`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    return JSON.parse(output).data.viewer.pullRequests.nodes;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Failed to fetch PRs from GitHub API. Is 'gh' authenticated?`);
    return [];
  }
}

function poll() {
  console.log(`[${new Date().toISOString()}] Polling GitHub PRs...`);
  const prs = fetchPRs();
  const state = readState();
  let stateUpdated = false;

  for (const pr of prs) {
    const title = pr.title;
    const url = pr.url;
    const commitNode = pr.commits.nodes[0];
    if (!commitNode) continue;
    
    const commitOid = commitNode.commit.oid;
    const checkState = commitNode.commit.statusCheckRollup ? commitNode.commit.statusCheckRollup.state : null;
    
    if (!checkState) continue; // No checks for this commit yet

    const isNewPR = !state.hasOwnProperty(url);
    const prevState = state[url] || {};

    if (prevState.commit !== commitOid || prevState.state !== checkState) {
      if (!isNewPR) {
         const isNewCommit = prevState.commit !== commitOid;
         const stateChanged = prevState.state !== checkState;
         
         if (isNewCommit || stateChanged) {
            if (checkState === 'SUCCESS') {
               console.log(`Notification: Success for ${title}`);
               notifySuccess(pr);
            } else if (checkState === 'FAILURE' || checkState === 'ERROR') {
               console.log(`Notification: Failure for ${title}`);
               notifyFailure(pr);
            }
         }
      }
      
      state[url] = {
        title: title,
        commit: commitOid,
        state: checkState,
        updatedAt: new Date().toISOString()
      };
      stateUpdated = true;
    }
  }

  if (stateUpdated) {
    writeState(state);
  }
}

function notifySuccess(pr) {
  notifier.notify({
    title: 'PR Checks Passed! ✅',
    message: pr.title,
    open: pr.url,
    sound: 'Glass'
  });
}

function notifyFailure(pr) {
  notifier.notify({
    title: 'PR Checks Failed ❌',
    message: pr.title,
    open: pr.url,
    sound: 'Basso'
  });
}

// Ensure the state file exists or can be created before starting the daemon
console.log(`[${new Date().toISOString()}] Starting GitHub PR Notifier...`);
poll();
setInterval(poll, POLL_INTERVAL_MS);
