Keep Home ERP 📦

Keep is a high-density, operational Home ERP (Enterprise Resource Planning) platform. It is designed to map the unstructured reality of physical household inventory into a structured, predictive digital twin.

Instead of reactive purchasing and stockouts, Keep provides an opinionated workflow to track Master Data, physical storage Chambers, and an immutable ledger of consumption events.

🧠 The Philosophy (Why this exists)

Whether you are managing a global supply chain or a household pantry, the core problem is the same: disconnected data leads to operational failure. Most home inventory apps are glorified grocery lists. Keep is built like an enterprise operational terminal:

High-Density UI: CSS Masonry layouts visually map to the physical size of your storage chambers, eliminating dead space and reducing cognitive load.

Time to Value: Rapid ingestion pathways (Starter Kits, Global Registry) prevent the "cold start" problem of manual data entry.

Immutable Ledger: Inventory isn't just a number; it's a sum of historical transactions (Inbound, Outbound, Transfers), laying the groundwork for predictive burn-rate analytics.

🏗️ Core Architecture

Keep's data architecture is built on three foundational nodes:

Master Data 
(Goods): The global definition of an object (e.g., "Chemex Filters - 100ct"), tracking specific reorder points and default storage locations.

(Stores): Physical boundaries in your environment (e.g., "Primary Fridge", "Garage Racks").

Ledger (Movements): A strict append-only record of every physical state change.

💻 Tech Stack

Framework: Next.js (App Router)

Language: TypeScript / React

Styling: Tailwind CSS + Lucide Icons

Database & Auth: Supabase (PostgreSQL)

Security: Strict Row-Level Security (RLS) & Role-Based Access Control (RBAC) via Supabase RPCs.

🚀 Local Deployment / Getting Started

To run Keep locally, you will need Node.js and a free Supabase account.

1. Clone the Repository

git clone [https://github.com/noah-drake/keep-home-erp.git](https://github.com/noah-drake/keep-home-erp.git)
cd keep-home-erp
npm install


2. Configure Supabase

Create a new Supabase project.

Run the SQL schema found in /supabase/schema.sql (Note: you will want to export your schema and save it to this folder later) to generate the tables, views, and RPC functions.

Get your API keys from Project Settings -> API.

3. Set Environment Variables

Create a file named .env.local in the root directory and add your Supabase keys:

NEXT_PUBLIC_SUPABASE_URL=[https://your-project-url.supabase.co](https://your-project-url.supabase.co)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key


(Do not commit this file. It is ignored by .gitignore)

4. Run the Development Server

npm run dev


Open http://localhost:3000 with your browser. Create an account to initialize your first Plant.

🛡️ Security & RBAC

Keep implements strict multi-tenant data isolation.

Plants (Organizations): All data is gated by a plant_id.

Admins: Can rename plants, generate magic invite links, and execute destructive actions.

Viewers: Have read/write access to execute inventory transactions but cannot alter the Plant structure.

Database RLS: Security is enforced at the Postgres level; a compromised client cannot query another Plant's data.

📜 License

This project is licensed under the MIT License - see the LICENSE file for details.
(Data entered into the system remains private to the host DBA).