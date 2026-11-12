# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
The RecruitScout internal operations team (the owner and agents such as "Silvio"). They run the platform daily as power users: steering the scraping swarm, managing client Google Sheets, curating the recruiter directory and sending job leads to recruitment agencies. They want speed, control and confidence that nothing risky happens without them.

## Product Purpose
RecruitScout finds new job vacancies at scale (Indeed Italy and Spain, Trovolavoro) and turns them into two outputs: live job feeds in each client's Google Sheet, and lead emails offering matching vacancies to Italian recruitment agencies. Success means fresh, deduplicated jobs reaching the right sheets and recruiters with minimal manual work.

## Positioning
A distributed scraping swarm (Chrome extension agents claiming tasks from a shared queue, optionally signed in with stored Indeed accounts), combined with lead matching that pairs each vacancy with recruiters by specialty and location.

## Operating Context
- Chrome extension (popup and background agent) on several operators' machines; agents claim tasks from the Supabase `BulkQueue`.
- Command center dashboard, served both as the extension's options page and as a hosted web app (Docker + nginx, 72.60.215.34).
- Self-hosted Supabase (PostgREST, auth, edge functions) behind a Caddy HTTPS proxy.
- Integrations: Google Sheets (OAuth and Apps Script), Plunk email, Blue.cc project boards, OpenAI for the Assistant.
- Slow, lossy network path to the server (~245 ms round trip): data volume matters.

## Capabilities and Constraints
- The Assistant may act on everything in the platform, but deletes, bulk changes, outgoing emails and Sheets syncs, and agent controls require an explicit Approve click. Routine changes run immediately.
- Sign-in, passwords, Indeed cookies, API keys and Google OAuth consent stay human-only.
- Lead emails are written in Italian; the UI is in English.
- The OpenAI key must live on the server, never in a client bundle.

## Brand Commitments
- Glacier design system (Microsoft Fluent 2 based, Deep sea accent, Onest and JetBrains Mono) across the frontend, enforced by `scripts/check-glacier.mjs`.
- Approved exception: the Assistant page may have its own futuristic visual layer (for example aurora gradients, glow and glass) beyond Glacier's usual rules. Confirmed by the owner on 2026-11-13.
- Copy: sentence case, no emoji or exclamation marks in UI text.

## Evidence on Hand
Live data only (jobs, clients, recruiters, queue, email logs). No testimonials, customer names or metrics may be invented for the UI.

## Product Principles
1. Operators stay in control: nothing risky happens without a visible, deliberate approval.
2. Show the work: every action the Assistant takes is visible, named in plain language and auditable.
3. Fast on a slow link: send and render the least data needed.
4. One system: the same actions and rules as the rest of the dashboard, not a parallel product.
