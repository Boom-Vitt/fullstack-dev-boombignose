<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/bundled/ask_the_manual

## Run Locally

**Prerequisites:**  Node.js, Docker (for the Postgres service)


1. Install dependencies:
   `npm install`
2. Copy `.env.local` from the example below and update the placeholders:
   ```bash
   GEMINI_API_KEY=REPLACE_WITH_GEMINI_KEY
   DATABASE_URL="postgresql://askmanual:askmanual@localhost:5432/askmanual?schema=public"
   PORT=4000
   CORS_ORIGIN=http://localhost:5173
   ```
4. Start the database:
   `npm run db:up`
5. Apply the Prisma schema (creates tables and generates the client):
   `npm run prisma:migrate`
6. Start the backend API (new terminal):
   `npm run server:dev`
7. Run the Vite app (separate terminal):
   `npm run dev`
8. Visit `http://localhost:5173`, create an account, and log in. The landing page shows all manuals you’ve uploaded; switch to the Upload tab to add new documents.

## Prisma toolkit

- Regenerate the Prisma client after editing `prisma/schema.prisma`:
  `npm run prisma:generate`
- Inspect and edit data with Prisma Studio:
  `npm run prisma:studio`
- Stop the local database and remove the container:
  `npm run db:down`

## Backend API

- **Base URL:** `http://localhost:4000/api`
- **Health check:** `GET /health`
- **Authentication (email + password, cookie-based sessions):**
  - `POST /auth/signup` & `POST /auth/login`
  - `POST /auth/logout`
  - `GET /auth/me` returns the current session user
- **Manuals CRUD:** `GET/POST/PATCH/DELETE /manuals` (always scoped to the authenticated user). Uploaded manuals persist the Gemini FileSearch store name so you can revisit them later from the landing page.
- **Chat sessions & messages:** `POST /chats` creates a chat tied to a manual, `GET /chats/:id/messages` fetches history, and `POST /chats/:id/messages` stores both user prompts and Gemini responses (including grounding metadata).
- The server reads `DATABASE_URL`, `PORT`, and `CORS_ORIGIN` from `.env.local` (falls back to `.env`). Ensure the Postgres Docker service is running before launching `npm run server:dev`.

## Product flow

- **Landing page (“Talk to a document”)** – lists every manual in your account so you can pick which one to chat with. Manual chat history is saved in Postgres, so refreshing the page will reload the previous conversation.
- **Upload page** – lives on its own tab. Give the manual a friendly name, upload one or more files, and the app will create a Gemini FileSearch store plus a database record. Uploading no longer auto-enters the chat; switch back to the landing tab to start a new conversation with the freshly uploaded manual.
- **Login/Logout/Signup** – handled entirely via the new backend API. The frontend automatically persists cookies and rehydrates the current session on refresh.
