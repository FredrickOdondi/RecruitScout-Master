# RecruitScout Command Center — AI Agent Knowledge Base

> **Purpose of this document**: This is the complete reference guide for the RecruitScout Command Center dashboard. An AI agent should use this document to answer any question a user asks about how the dashboard works, what buttons do, how to accomplish a task, or how to troubleshoot a problem.

---

## 1. What Is RecruitScout?

RecruitScout is a Chrome Extension and web dashboard system designed for high-volume, automated job listing extraction from job boards (primarily Indeed and TrovoLavoro). It has two modes of operation:

1. **Manual Mode** — A user visits a job board URL in Chrome and the extension scrapes the jobs on that page automatically or on demand.
2. **Swarm / Agent Mode** — Multiple Chrome browsers (called "nodes" or "agents") are connected to a shared cloud task queue (hosted on Supabase). An operator pushes job search tasks to the queue from the dashboard, and all connected extension agents autonomously pick up and execute tasks.

The **Command Center** is the main web dashboard interface for controlling the system, viewing scraped data, managing tasks, exporting data, and configuring clients.

---

## 2. Accessing the Dashboard

### Login Screen
The dashboard is protected by Supabase authentication. When a user visits the dashboard URL or opens the extension's Options page, they are shown a login screen with:

- **Email address field** — The user's registered email.
- **Password field** — With a show/hide toggle (eye icon on the right).
- **Forgot Password?** link — Sends a password reset email to the user. The user clicks the link in their email and is brought back to the dashboard on a "Set New Password" screen.
- **Sign In button** — Authenticates with Supabase. If credentials are wrong, the form shakes and shows a red error message.
- **Accept Invitation flow** — If a user was invited via email, clicking the invite link brings them to a special "Accept Invitation" screen where they set their password for the first time.

> **Access is restricted to authorised users only.** The dashboard does not have a public self-registration option.

### Signing Out
In the left sidebar at the very bottom, there is a **Sign Out** button (arrow-out-of-door icon). Clicking it ends the Supabase session and returns the user to the login screen.

---

## 3. Dashboard Layout

The dashboard has two main zones:

### Left Sidebar (Navigation)
A collapsible vertical navigation bar. On desktop it can be expanded (shows full labels) or collapsed (shows only icons). On mobile it slides in as a drawer. It contains:

**Section: Agent Control**
- **Bulk Priority Queue** (Search icon) — The main queue management tab.
- **Engine Settings** (Gear icon) — Extension configuration settings.

**Section: Database**
- **Extracted Jobs** (Database icon) — View and search locally-cached jobs from Chrome storage.
- **Export & Sync** (Download icon) — Download or sync data from Supabase to files or Google Sheets.

**Section: Cloud**
- **Supabase Viewer** (Cloud icon) — A full Supabase database viewer with filtering, sorting, bulk delete, and Google Sheets sync.
- **Blue.cc Workspaces** (Tag icon, blue) — A Kanban board integration with Blue.cc project management tool.

**Section: Clients**
- **Client Enrollment** (UserPlus icon) — Register clients and their Google Sheets configurations.

**Bottom of sidebar:**
- User avatar / email display.
- **Sign Out** button.

### Main Content Area
A top header bar shows the current tab name (e.g., `/ search`, `/ settings`, `/ jobs`). The main area below renders the active tab's content, which scrolls independently.

---

## 4. Tab: Bulk Priority Queue (/search)

This is the **default and most-used tab**. It is the control panel for the distributed scraping swarm.

### 4.1 Enqueue Form — "Bulk Job Priority Queue"

At the top of the tab is a card titled **"Bulk Job Priority Queue"** with the following fields:

#### Job Titles Textarea
A multi-line text area where the user types the job titles they want to search for. Rules:
- Enter one job title per line (e.g., `Software Engineer`, `Data Analyst`).
- Multiple titles can also be separated by commas.
- **Leave the textarea blank** and fill in only a Location to scrape all jobs in a location area, regardless of title.

#### Associated Client (dropdown)
Associates this batch of tasks with a specific enrolled client. Jobs scraped from this task will be tagged with the client's name in the database. This allows filtering and separate Google Sheets sync per client.
- Select **"Leave blank (No Client)..."** to scrape without a client tag.
- Enrolled clients appear in this list automatically (populated from the Clients tab).

#### Target Site (dropdown)
Chooses which job board the agents will search:
- **Indeed** — indeed.com (default)
- **TrovoLavoro** — trovolavoro.it (Italian job board)

#### Location Filter (text input)
An optional geographic filter applied to all the queued searches (e.g., `Remote`, `New York`, `Milan`).
- This filter is embedded in the search URL sent to the job board.
- Can be left blank for no location restriction.

#### Assigned Worker (dropdown)
Optionally pins the tasks to a specific swarm agent by their Worker ID. The dropdown is populated in real-time with all currently online agents (showing a green "X Online" count).
- Leave blank (default: **"Leave blank for any available node..."**) to let any available agent pick up the tasks.
- Select a specific worker name/ID to lock tasks to that machine.

#### Action Buttons
- **Apply Location** button — When clicked, this updates the `location` field of **all existing tasks** currently in the queue to match the Location Filter input. This is a bulk update, not an enqueue. Requires a Location value to be entered. A confirmation dialog appears before applying.
- **Enqueue / Scrape** button (green) — Submits the job titles and configuration as new tasks to the BulkQueue in Supabase.
  - Button label says **"Enqueue"** when job titles are typed in the textarea.
  - Button label says **"Scrape"** when the textarea is empty but a Location is entered (location-only mode).
  - Disabled if both the titles textarea AND location field are both empty.
  - On success, shows a browser alert: `Enqueued X title(s) to the remote queue!`

### 4.2 Queue Status Panel

Below the enqueue form is the **"Queue Status"** panel showing all current tasks in the BulkQueue table.

#### Header Controls
- **Refresh** button — Manually refreshes the queue list and agent list. (The queue also auto-refreshes every 4 seconds while this tab is active.)
- **Reset to Pending** button (amber) — Resets ALL completed and failed tasks back to "pending" status so agents will re-execute them. A confirmation dialog is shown. Use this to re-run the full queue for a new day's scrape.
- **STOP / KILL ENGINE** button (red) — Sends a stop signal to the extension's scraping engine and disables remote polling. Useful for emergency stops. Agents will finish their current page and halt.

#### Statistics Bar
Three colored badges show:
- **Total** — Total number of tasks in the queue.
- **Pending** (blue) — Tasks waiting to be picked up by an agent.
- **Completed** (green) — Tasks already executed.

#### Queue Table Columns
The table displays all tasks with these columns:
- **Task** — The job title being searched.
- **Site** — The target job board (shown as a purple badge: `INDEED` or `TROVOLAVORO`).
- **Client** — The associated client name, if any.
- **Location** — The geographic filter, if set.
- **Status** — Color-coded badge:
  - Yellow `pending` — Waiting for an agent.
  - Blue `running` — Currently being executed by an agent.
  - Green `completed` — Finished successfully.
  - Red `failed` — Encountered an error.
- **Worker ID** — Which agent is/was handling the task (shows "Unassigned" if not yet picked up).
- **Created** — Timestamp when the task was created.
- **Actions** — Edit / Delete buttons.

#### Inline Task Editing
Each task row has an **Edit** button (blue text). Clicking it transforms that row into an inline editing form where the user can change:
- Job Title
- Target Site
- Client
- Location

Clicking **Save** applies changes. Clicking **Cancel** discards them.

> **Note:** Tasks with status `running` cannot be edited or deleted. The Edit and Delete buttons are disabled for running tasks.

#### Deleting Tasks
Each task row has a **Delete** button (red text). Clicking it shows a confirmation dialog: "Are you sure you want to delete this queued task?" Confirming removes it from the database.

---

## 5. Tab: Engine Settings (/settings)

This tab controls how the Chrome extension behaves. Settings are saved to `chrome.storage.local` and sync instantly across the popup and dashboard.

### 5.1 General Settings Card

| Setting | Type | Description |
|---------|------|-------------|
| **Auto Extract** | Toggle (checkbox) | When ON, the extension automatically extracts jobs whenever the user visits a supported job board URL. When OFF, extraction only happens manually or via the queue. |
| **Notifications** | Toggle (checkbox) | When ON, shows Chrome desktop notifications when an extraction batch completes. |

### 5.2 Distributed Worker Mode Section

| Setting | Type | Description |
|---------|------|-------------|
| **Enable Remote Polling** | Toggle (checkbox) | When ON, the extension polls the Supabase BulkQueue every 30 seconds and automatically picks up and executes pending tasks. This is what makes the node a "swarm agent." When OFF, the node is passive and will not autonomously process queue tasks. |
| **Worker ID / Agent Name** | Text input | A human-readable name for this specific Chrome extension instance (e.g., `Node-A`, `Laptop-Italy`). This name is stamped on every job record scraped by this node, visible in the `worker_id` column. It also appears in the Assigned Worker dropdown in the Queue tab when the node is online. |

### 5.3 Extraction Settings Card

| Setting | Type | Range | Description |
|---------|------|-------|-------------|
| **Max Jobs per Page** | Number | 10-500 | Maximum number of job listings the engine will extract from a single search results page before moving to the next page. Default: 100. |
| **Pagination Limit** | Number | 1-100 | Maximum number of pages the engine will crawl per task. E.g., setting to 10 means the engine stops after 10 pages of results. Default: 10. |
| **Crawl Delay (ms)** | Number | 100-10000 | Milliseconds the engine waits between page loads during pagination. Higher values are slower but less likely to trigger rate limiting. Default: 1000 (1 second). |
| **Respect robots.txt** | Toggle (checkbox) | When ON, the engine attempts to respect crawl guidelines. |

---

## 6. Tab: Extracted Jobs (/jobs)

This tab displays the **locally cached jobs** stored in Chrome's `chrome.storage.local`. These are the jobs that this specific extension node has scraped.

> **Important distinction:** This tab shows LOCAL data only. The cloud (Supabase) database is much larger and can be viewed in the **Supabase Viewer** tab.

### Features
- Scrollable job table with columns for title, company, location, date posted, source, and URL.
- Jobs count badge is shown in the sidebar next to the "Extracted Jobs" label.
- The list can be refreshed via the component's internal controls.

---

## 7. Tab: Export & Sync (/export)

This tab handles exporting job data from the **Supabase cloud database** (not just local Chrome storage) to files or Google Sheets.

### 7.1 Left Column

#### Cloud Stats Card
Shows the total number of jobs in Supabase for the currently selected filter:
- Large number display: **"Total Cloud Jobs"** or **"Jobs by [Worker Name]"** if a specific node is selected.
- **Refresh count** link re-queries Supabase for the latest count.
- If a specific worker is selected, shows fraction: `X / Y total cloud jobs`.

#### Filter by Extension Node
A dropdown to narrow the export to jobs scraped by a specific Chrome extension node (worker):
- **"All Extensions (full cloud)"** — exports all jobs from every node.
- Individual nodes listed by their Worker ID/name.
- Extension nodes appear here once they have scraped at least one job with a Worker ID configured.

#### Google Sheets Sync Card
Sends the filtered job data to a Google Sheets spreadsheet via a Google Apps Script webhook.

**Target Client Sheet dropdown:**
- **All Enrolled Clients (Automatic Grouping)** — Iterates through all enrolled clients, fetches jobs tagged to each client, and sends them to each client's separate Google Sheet.
- **Custom Sheet Settings (Manual)** — Lets the user enter Google Sheets configuration manually.
- **[Client Name]** — Syncs only jobs tagged to that specific client, to that client's Sheet.

**When "Custom" is selected, these fields appear:**
- **Apps Script Web App URL** — The `https://script.google.com/macros/s/.../exec` URL of the deployed Google Apps Script.
- **Spreadsheet ID** (optional) — The long ID from the Google Sheets URL.
- **Sheet Name** — The name of the tab within the spreadsheet (default: `Sheet1`).

**Sync button** — Labeled "Sync X Jobs to Sheets". Only active when there are jobs and (for custom mode) a Web App URL is entered. Shows progress while syncing. Jobs with empty descriptions are automatically filtered out before sending.

> **Technical note:** Data is sent in chunks of 1,000 rows to avoid the Google Apps Script 6-minute execution limit.

### 7.2 Right Column

#### Download Format Card
Three format buttons let the user choose how to download the data:
- **CSV** — Comma-separated values (.csv file). Best for Excel, Google Sheets import.
- **JSON** — Full JSON object with metadata and jobs array (.json file).
- **XLSX** — Excel-compatible XML format (.xls file).

**Download button** — Labeled "Download X Jobs as [FORMAT]". Fetches all matching jobs from Supabase, compiles them into the chosen format, and triggers a browser file download. Filename pattern: `recruitscout-jobs-[worker]-[date].[format]`.

#### Fields Matrix Card
A checklist of all available job data fields. Only fields with their checkbox ticked will be included in the downloaded file. Users can toggle individual fields on/off to customize the export. Fields include:
- `title`, `company`, `companydomain`, `location`, `description`, `url`, `dateposted`, `employmenttype`, `salary`, `status`, `source`, `extractedat`, `worker_id`, `client`, `category`

---

## 8. Tab: Supabase Viewer (/supabase)

This is the most powerful data viewing tab. It provides a direct, paginated view of the entire `jobs` table in the Supabase cloud database with search, filtering, sorting, bulk deletion, and Google Sheets sync.

### 8.1 Stats Bar (3 cards at top)
- **Total Rows in Supabase** — Exact count of all jobs matching the current filter.
- **Columns** — Number of columns in the table (always 16).
- **Supabase Status** — A live health indicator: Green "Connected" / Red "Offline" / Gray "Checking". Also shows when the data was last refreshed.

### 8.2 Google Sheets Sync Panel

A full Google Sheets sync panel (similar to Export tab but more powerful):

**Header row** shows:
- A badge if a filter is active: `Filtered X rows`
- A badge if no filter: `All X rows`
- If the "no-desc filter" is ON, an amber pulsing badge: `Dropping empty descriptions`

**Toggle buttons:**
- **No-desc filter** (power icon) — When active (amber/ON), rows with empty `description` fields will be dropped before sending to Sheets. Useful for cleaning data. State is remembered in browser localStorage.
- **Config** button — Expands/collapses the Google Sheets configuration fields below.
- **Send to Sheets** / **Cancel** button — Starts the sync operation. Shows a spinning "Cancel" button while in progress. Progress messages show in a bar below the panel header.

**Config section (expandable) contains:**
- **Target Client Sheet** dropdown — Same options as Export tab: Custom, or any enrolled client.
- If Custom: Apps Script URL, Spreadsheet ID (optional), Sheet Name fields.
- If a client is selected: Shows a read-only summary card with the client's configuration.
- A text line listing all column names that will be sent to Sheets.

**Column order sent to Google Sheets:**
`job_title`, `company`, `company_domain`, `job_location`, `description`, `job_post_url`, `date_posted`, `employment_type`, `salary`, `status`, `source`

### 8.3 Filter Toolbar

A row of filter controls:

| Control | Description |
|---------|-------------|
| **Search box** | Full-text search across title, company, and location. Has a 400ms debounce. Has an X button to clear. |
| **All Sources** dropdown | Filter by job board source: `All Sources`, `Indeed`, `TrovoLavoro`, or any other detected source. |
| **All Categories** dropdown | Multi-select checkbox dropdown to filter by industry category. Available categories: Staffing & Recruiting Agency, Executive Search / Headhunting, HR Consulting & Services, Employment & Training Agency, IT Tech & Telecommunications, Manufacturing & Automotive, Food Beverage & Agriculture, Logistics & Supply Chain, Business Services Consulting & Finance, Energy Utilities & Engineering, Hospitality Tourism & Events, Healthcare & Pharmaceuticals, Retail & Consumer Goods, Government Non-Profit & Real Estate. |
| **All Nodes** dropdown | Filter by which Chrome extension worker scraped the job. Shows all unique `worker_id` values found in Supabase. |
| **All Clients** dropdown | Filter by which client the job was tagged with. |
| **Sort** dropdown | Sort order: `Newest first`, `Oldest first`, `title A-Z`, `company A-Z`. |
| **Delete (X)** button (red) | Appears when rows are selected. Deletes selected jobs from Supabase permanently. |
| **Refresh** button (cyan) | Manually fetches the current page again from Supabase. |

### 8.4 Data Table

A horizontal-scrolling data table showing 50 rows per page.

**Columns visible:**
`id`, `title`, `company`, `client`, `category`, `companydomain`, `location`, `employmenttype`, `salary`, `source`, `dateposted`, `extractedat`, `created_at`, `status`, `description`, `url`

**Row features:**
- **Checkbox column** (leftmost) — Select individual rows. The header checkbox selects/deselects all rows on the current page.
- **Delete icon column** — Click the trash icon on any row to delete that single job from Supabase (with confirmation dialog).
- **URL cells** — Show as clickable cyan links with an external link icon, opening the original job posting in a new tab.
- Long text fields (title, company, description) are truncated with an ellipsis; hover to see the full text in a tooltip.
- Empty fields show a dash.

### 8.5 Pagination
- **Page size:** 50 rows per page.
- Shows: `Rows X-Y of Z (page N/M)`
- Navigation: Left/Right arrow buttons and numbered page buttons. Smart ellipsis for large page counts.
- Changing any filter automatically resets to page 1.

---

## 9. Tab: Blue.cc Workspaces (/blue)

This tab embeds a full Kanban board integration with the **Blue.cc** project management platform.

### 9.1 Connecting Blue.cc
If not yet connected, the tab shows a prompt to add API credentials. The Settings gear icon in the top-right of the Blue.cc panel opens the settings form with three fields:
- **Token ID** — The Blue.cc API token ID.
- **Secret ID** — The Blue.cc API secret.
- **Company ID** (optional) — The Blue.cc company/organization ID. If left blank, it is auto-detected from the API.

Click **Save & Connect** to authenticate and load workspaces.

### 9.2 Workspace Sidebar
A left sidebar lists all available Blue.cc **Workspaces** (called "Projects" in Blue.cc). Each workspace has a colored dot. Click a workspace name to load its Kanban board. Unread @mention notifications show as a red dot on the workspace name.

The sidebar has a collapse toggle and a **Refresh** button at the bottom to re-fetch workspaces and mentions.

### 9.3 Kanban Board
Each workspace displays a horizontal Kanban board with **lists** (columns). Features:
- Each column shows its title, a count badge, and all todo cards.
- Cards are color-coded per column.
- **Drag and drop** — Cards can be dragged from one column to another. The UI updates optimistically and then syncs to Blue.cc via the API.
- Cards show: title (with strikethrough if done), colored tags, comment count icon.

### 9.4 Card Detail Panel
Clicking any card opens a **slide-in right panel** showing:
- Card title with done/not-done checkbox indicator.
- Tags.
- **Description** — The full card text/description body.
- **Comments** section — All comments and threaded replies with author avatars and timestamps.
- **Reply** button — On hover over a comment, allows replying to that specific comment.
- **New Comment textarea** with `@mention` autocomplete:
  - Type `@` followed by letters to search workspace users.
  - A dropdown appears with matching user names. Click to insert the mention.
- **Submit** button — Posts the comment. Comments refresh automatically after posting.

### 9.5 Notifications Bell
The bell icon in the Blue.cc top bar shows unread mention notifications. A red badge shows the count. Clicking the bell opens a dropdown with up to 20 recent mentions, showing:
- Mentioner's name and avatar initials.
- Which workspace the mention was in.
- Time ago.
- Unread mentions have a blue dot and blue background.
- Clicking a mention navigates to the relevant workspace.
- **Refresh** link at the bottom re-fetches mentions.

---

## 10. Tab: Client Enrollment (/clients)

This tab manages **enrolled clients** — organizations that have separate Google Sheets pipelines for their scraped job data.

### 10.1 Enroll New Client (left card)

A form to add a new client:

| Field | Required | Description |
|-------|----------|-------------|
| **Client Name** | Yes | A human-readable label (e.g., `Acme Staffing`). Used to tag jobs and identify the client in all dropdowns. |
| **Apps Script Web App URL** | Yes | The Google Apps Script deployed web app URL (`https://script.google.com/macros/s/.../exec`). This is the webhook endpoint that receives job data and writes it to Google Sheets. Must start with `http://` or `https://`. |
| **Spreadsheet ID** | Optional | The ID string from the Google Sheets URL (the long random string between `/d/` and `/edit`). |
| **Sheet Name** | Optional | The name of the tab inside the spreadsheet (defaults to `Sheet1`). |

Click **Enroll Client** to save. A green success message appears on success. The client list on the right refreshes automatically.

### 10.2 Enrolled Clients List (right card)

A table of all currently enrolled clients showing:
- **Client name** and Apps Script URL (truncated).
- **Sheet settings** — Sheet tab name and Spreadsheet ID.
- **Delete** button (red trash icon) — Removes the client and all their configuration. Shows a confirmation dialog.

A **Refresh** button re-fetches the client list from Supabase.

### 10.3 First-Time Setup (Database Configuration Required)
If the `clients` table does not exist in Supabase yet, an amber warning card appears with the SQL script needed to create the table. There is a **Copy** button to copy the SQL, and a **Verify Table Created** button to re-check after running the SQL in the Supabase SQL Editor.

---

## 11. How the Swarm / Agent System Works

Understanding this helps answer many user questions:

### Step-by-Step Workflow

1. **Set up a Worker ID** — In Engine Settings, each Chrome extension node gets a unique Worker ID (e.g., `Node-A`).
2. **Enable Remote Polling** — Toggle "Enable Remote Polling" ON in Engine Settings. The node will now check Supabase for tasks every 30 seconds.
3. **Enqueue tasks** — In the Bulk Priority Queue tab, type job titles and click Enqueue. Tasks are written to the Supabase BulkQueue table with status `pending`.
4. **Agents execute tasks** — Each node polls for `pending` tasks, locks one (status changes to `running`), opens a new browser tab to the job board search URL, scrapes pages, deduplicates, and saves to Supabase. The task status becomes `completed` or `failed`.
5. **Daily auto-reset** — The system automatically resets all `completed` tasks back to `pending` once per calendar day, making the swarm continuously re-scrape for new job postings. The user can also manually trigger this with the **Reset to Pending** button.
6. **Monitor progress** — The Queue Status panel shows live counts of pending vs. completed tasks. The agent count in the Assigned Worker label shows how many nodes are currently online.

### Task Status Flow
pending -> running -> completed OR failed

### Deduplication
The system uses a deterministic hash of URL + Title + Company to generate a unique job ID. Before saving, each node checks both local storage and Supabase to avoid inserting duplicates. This means the same job will never appear twice even if 10 nodes scrape the same page.

---

## 12. Google Sheets Integration — How to Set It Up

There are two ways to use Google Sheets sync:

### Option A: Quick Manual Sync (Supabase Viewer or Export tab)
1. Create a Google Apps Script in your spreadsheet: Extensions > Apps Script.
2. Paste the webhook script code (provided separately by your admin).
3. Deploy it as a Web App with public access.
4. Copy the deployment URL (https://script.google.com/macros/s/.../exec).
5. In the **Supabase Viewer** tab or **Export & Sync** tab, click "Config", paste the URL, and click "Send to Sheets".

### Option B: Persistent Client Sync (Client Enrollment)
1. Go to the **Client Enrollment** tab.
2. Fill in the client name, Apps Script URL, and sheet details.
3. Click **Enroll Client**.
4. Now this client appears in all sync dropdowns throughout the dashboard.
5. When agents scrape with this client selected in the Enqueue form, jobs are tagged with the client name.
6. Use "Send to Sheets" with that client selected to push only their jobs to their sheet.
7. Selecting **"All Enrolled Clients (Automatic Grouping)"** syncs each client's jobs to their respective sheets in one operation.

---

## 13. Common User Questions & Answers

### "Why are there no agents showing in the Assigned Worker dropdown?"
Agents appear in that dropdown when they are online (i.e., they have sent a heartbeat to Supabase recently). Make sure the extension is open on at least one Chrome browser with a Worker ID configured and "Enable Remote Polling" turned ON.

### "The queue shows tasks as 'pending' but nothing is happening."
- Ensure at least one extension node has "Enable Remote Polling" enabled (Engine Settings tab).
- The node must be running (Chrome must be open with the extension active).
- Check the Engine Settings tab to confirm the Worker ID is set.
- Check that the extension has the correct Supabase credentials configured.

### "How do I stop the scraping immediately?"
Click the red **STOP / KILL ENGINE** button in the Queue Status panel. This sends an abort signal to the extension and disables Remote Polling.

### "How do I re-run all tasks again?"
Click **Reset to Pending** in the Queue Status panel. This sets all completed and failed tasks back to `pending` so agents will process them again.

### "Why do I see fewer jobs in the Extracted Jobs tab than in the Supabase Viewer?"
The Extracted Jobs tab shows only the locally cached jobs in that specific Chrome extension instance. The Supabase Viewer shows ALL jobs from ALL extension nodes combined.

### "How do I export only one client's jobs?"
In the Export & Sync tab, select the client from the "Target Client Sheet" dropdown in the Google Sheets Sync section, then click sync. Or in the Supabase Viewer, use the "All Clients" filter dropdown to filter to one client, then use "Send to Sheets."

### "The 'Send to Sheets' button is greyed out."
Either: (a) there are no jobs matching the current filter (total = 0), or (b) in Custom mode, the Apps Script Web App URL field is empty.

### "How do I add a new client for Google Sheets automation?"
Go to the **Client Enrollment** tab. Fill in the Client Name and the Apps Script Web App URL (minimum required fields). Click Enroll Client.

### "What is 'No-desc filter' in the Supabase Viewer?"
When this toggle is active (amber/ON), any job rows that have an empty `description` field will be excluded before the data is sent to Google Sheets. This keeps the Sheets cleaner by only including jobs with full data.

### "Can I target a specific job board?"
Yes. In the Enqueue form, use the **Target Site** dropdown to choose between `Indeed` and `TrovoLavoro`.

### "I enrolled a client but now I need to update their Sheet configuration."
Currently, to update a client, you must delete the existing client record (click the trash icon in the Client Enrollment tab) and re-enroll them with the updated information.

### "What does 'Apply Location' do?"
It updates the `location` field on every existing task in the queue to the new location you typed. It does NOT create new tasks. It is a bulk update for when you want to change the geographic filter for all existing pending/completed tasks.

### "How many pages does the agent scrape per task?"
This is controlled by the **Pagination Limit** in Engine Settings. The default is 10 pages per task. Set it higher (up to 100) to scrape deeper, or lower to scrape faster.

### "Why is the same job appearing multiple times?"
This should not happen due to the deduplication system. If it does, check that the Worker ID is consistently set (not changing between sessions), as the dedup ID is stored in local storage and Supabase. Contact your admin if duplicates persist.

### "How do I filter jobs by industry type in the Supabase Viewer?"
Use the **"All Categories"** dropdown in the Supabase Viewer toolbar. This is a multi-select that lets you choose one or more industry categories to filter by.

### "How do I see which machine scraped a specific job?"
In the Supabase Viewer, the `worker_id` column shows which extension node scraped each job. You can also use the **"All Nodes"** filter dropdown to show only jobs from a specific machine.

### "What is Blue.cc and do I need it?"
Blue.cc is an optional project management integration. It has no effect on scraping or data collection. It is a built-in Kanban board viewer for teams who use Blue.cc (a task management platform). You only need it if your team uses Blue.cc for tracking recruitment projects.

### "How does the extension know when a new day starts for the daily reset?"
The service worker in the extension tracks the last reset date in Chrome local storage. When the queue is polled and the date has changed since the last reset, it automatically calls the reset function on Supabase to put completed tasks back to pending.

---

## 14. Data Columns Reference

Every job stored in Supabase has these fields:

| Field | Description |
|-------|-------------|
| `id` | Unique deterministic hash ID based on URL + title + company |
| `title` | Job title |
| `company` | Company name |
| `companydomain` | Company website domain (e.g., google.com) |
| `location` | Job location |
| `employmenttype` | Employment type (Full-time, Part-time, Contract, etc.) |
| `salary` | Salary information (extracted from description or structured data) |
| `url` | Direct URL to the job posting |
| `dateposted` | When the job was originally posted |
| `description` | Full job description text |
| `source` | Which job board it came from (indeed, trovolavoro.it, etc.) |
| `extractedat` | When the extension scraped this job |
| `created_at` | When the record was inserted into Supabase |
| `status` | Job status (e.g., active) |
| `worker_id` | Which extension node scraped this job |
| `client` | Associated client name (if task was enqueued with a client) |
| `category` | Industry category auto-classified by the extension |

---

## 15. Troubleshooting Reference

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| Queue shows pending but agents do nothing | Remote Polling OFF | Enable in Engine Settings |
| No agents in dropdown | Extension not running or Worker ID not set | Set Worker ID; keep Chrome open |
| Supabase Viewer shows "Offline" | Network or Supabase credentials issue | Check internet; contact admin |
| "Send to Sheets" does nothing visible | Apps Script URL not set or wrong | Enter correct URL in Config section |
| Client Enrollment shows SQL error | clients table missing from DB | Copy and run the provided SQL in Supabase SQL Editor |
| Blue.cc shows "Not connected" | API credentials not entered | Open Settings in Blue.cc tab and enter Token/Secret |
| Export download is empty | No jobs in Supabase for selected filter | Change filter or check if scraping has run |
| Tasks stuck on "running" | Agent crashed mid-task | Use Reset to Pending button to recover the task |
| No categories showing in filter | Jobs not yet categorized | Categorization happens during enrichment; recent jobs may not have it yet |
