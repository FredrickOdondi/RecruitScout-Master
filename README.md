# RecruitScout-Master 🕵️‍♂️

RecruitScout is a production-ready, autonomous Chrome Extension and Command Center designed for high-volume job listing extraction. It transforms any job board into a structured data source using a combination of schema-aware parsing, platform-specific extractors, and a powerful heuristic engine.

## 🚀 Key Features

- **Autonomous Scraping Swarm**: Supports multi-agent coordination via a centralized Supabase queue.
- **Universal Extraction Engine**: 
  - **Schema.org Parser**: Instant extraction from sites using standard job metadata.
  - **Heuristic Engine**: Visual analysis of DOM structures to identify job details on unknown platforms.
  - **Deep Scraping**: Specifically optimized for Indeed (multi-region) and LinkedIn.
- **Intelligent Enrichment**:
  - **Domain Resolution**: Automatically finds company websites using Clearbit and Wikidata APIs.
  - **NLP Skills Extraction**: Parses job descriptions to identify required skill sets.
  - **Salary Normalization**: Standardizes salary ranges into common currencies and timeframes.
- **Cross-Node Deduplication**: Prevents redundant work across multiple scraping agents by checking global job IDs in real-time.
- **Command Center Dashboard**: A modern React-based web interface to monitor agents, manage the bulk queue, and export data.

## 🛠 Tech Stack

- **Extension Framework**: Vite + CRXJS (Manifest V3)
- **Frontend**: React 18, Tailwind CSS, Lucide Icons
- **Backend/Database**: Supabase (PostgreSQL + Realtime)
- **Languages**: TypeScript (Strict mode)
- **Integrations**: Google Sheets API, Clearbit, Wikidata

## 🏗 Architecture

- `src/background`: The "Brain" - handles state management, remote queue polling, and enrichment logic.
- `src/content`: The "Eyes" - coordinates extraction modules and handles page-level interactions.
- `src/content/crawler`: Handles pagination, infinite scroll, and navigation.
- `src/content/extraction`: Contains the Heuristic Engine and platform-specific extractors.
- `src/dashboard`: The Command Center web application.
- `src/shared`: Shared types, constants, and utility functions used across all layers.

## 📋 Setup & Installation

### Extension
1. Clone the repository.
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`
4. In Chrome, go to `chrome://extensions/`
5. Enable "Developer mode" and click "Load unpacked".
6. Select the `dist` directory.

### Command Center
1. Navigate to the dashboard directory or run the dev server from the root.
2. Ensure your Supabase environment variables are configured in `src/shared/supabase.ts`.

## 🤖 Remote Agent Mode
To run RecruitScout as a headless agent:
1. Open the Extension Options/Popup.
2. Enable **"Polling Enabled"**.
3. Set a **"Worker ID"** (e.g., `agent-01`).
4. The extension will now automatically pull tasks from the Supabase `BulkQueue` and execute them in a background tab.

## 📄 License
MIT License - Copyright (c) 2026 Fredrick Odondi
