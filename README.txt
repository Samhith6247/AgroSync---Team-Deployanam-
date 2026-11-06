AgroSync — React + Vite project

Project files
- index.html: Vite page entry point
- src/main.jsx: React startup and CSS import
- src/App.jsx: React components, page routing, catalog, basket and demo interactions
- style.css: all site styling
- public/agrosync-logo.png: header logo asset

Run locally
1. Install Node.js (LTS) if needed.
2. Open this outputs folder in VS Code.
3. Open Terminal > New Terminal and run:

   npm install
   npm run dev

4. Open the local address Vite prints in the terminal.

This app uses React and Vite. Don't open index.html by double-clicking; use the Vite
development server. To build a deployable version, run npm run build; output is written
to dist/.

Role workflow
- Farmer accounts submit harvest details from their Farmer workspace.
- Mandal Operators review pending lots and approve the grade, quantity, and marketplace price.
- Approved lots appear in Marketplace. Consumers can add produce to their basket and place an order.
- Community-delivery orders appear in the Delivery Agent queue and move through accepted, picked up, and delivered.

Supabase setup
1. Keep VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the local .env file. The app also accepts the older VITE_SUPABASE_ANON_KEY variable.
2. Run supabase-workflow.sql in the Supabase SQL Editor.
3. Farmer and Consumer roles can self-register. Create Mandal Operator and Delivery Agent accounts through a trusted admin process; staff roles come from Supabase app_metadata and are stored in profiles.
4. Start the app with npm run dev. The standalone workflow-demo.js uses browser localStorage and is only a same-browser demo; it does not write to Supabase.
