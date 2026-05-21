# Real-Time 1:1 Chat App

A production-ready 1-to-1 real-time chat application built with **React + Tailwind**, **Node.js + Express + Socket.IO**, and **Supabase Postgres**.

## Features

- JWT auth (register / login) with bcrypt password hashing
- Real-time messaging via Socket.IO
- Online / offline presence
- Typing indicators
- Seen / read receipts with unread counts
- Persistent chat history (Supabase)
- Last-message preview in sidebar
- Auto-scroll, timestamps, loading states, toast notifications
- Mobile-responsive WhatsApp-style UI

## Folder Structure

```
wp/
├── backend/
│   ├── src/
│   │   ├── config/        # env + supabase client
│   │   ├── controllers/   # route handlers
│   │   ├── middleware/    # auth, errors
│   │   ├── routes/        # express routers
│   │   ├── socket/        # socket.io handler
│   │   └── utils/         # jwt helpers
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/           # axios instances
│   │   ├── components/    # UI components
│   │   ├── context/       # Auth + Socket providers
│   │   ├── hooks/         # custom hooks
│   │   ├── pages/         # Login / Register / Chat
│   │   └── utils/         # helpers
│   ├── index.html
│   ├── package.json
│   └── .env.example
└── supabase/
    └── schema.sql         # tables + indexes + RLS-friendly schema
```

## Setup

### 1. Database (Supabase)

1. Create a project at https://supabase.com.
2. In the SQL editor, paste and run [supabase/schema.sql](supabase/schema.sql).
3. From **Project Settings -> API**, copy:
   - `Project URL`
   - `service_role` key (server-side only)

### 2. Backend

```bash
cd backend
cp .env.example .env       # fill in values
npm install
npm run dev
```

`.env` values:

```
PORT=5000
CLIENT_URL=http://localhost:5173
JWT_SECRET=replace-with-a-long-random-string
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...   # service_role key
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

`.env` values:

```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Open http://localhost:5173, register two accounts in two browsers (or one in incognito), pick the other user from the sidebar, and start chatting.

## Deployment

### Backend (Render / Railway / Fly.io)

- Build command: `npm install`
- Start command: `npm start`
- Set the same env vars from `.env`
- Make sure the host allows WebSocket upgrades (all three do by default)

### Frontend (Vercel / Netlify)

- Build command: `npm run build`
- Output directory: `dist`
- Env vars: `VITE_API_URL`, `VITE_SOCKET_URL` (point to deployed backend)

### Database

Supabase is already hosted — just make sure your backend's `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` point to the prod project.

## API

| Method | Endpoint                              | Auth | Purpose                              |
|--------|---------------------------------------|------|--------------------------------------|
| POST   | `/api/auth/register`                  | -    | Create account                       |
| POST   | `/api/auth/login`                     | -    | Login, returns JWT                   |
| GET    | `/api/auth/me`                        | yes  | Current user                         |
| GET    | `/api/users`                          | yes  | List all other users                 |
| GET    | `/api/conversations`                  | yes  | List my conversations (with previews)|
| POST   | `/api/conversations`                  | yes  | Get-or-create a conversation         |
| GET    | `/api/messages/:conversationId`       | yes  | Full chat history                    |
| POST   | `/api/messages`                       | yes  | Send a message                       |
| PATCH  | `/api/messages/:conversationId/read`  | yes  | Mark conversation as read            |

## Socket Events

Client -> Server: `join`, `send_message`, `typing`, `stop_typing`, `mark_read`
Server -> Client: `receive_message`, `typing`, `stop_typing`, `online_users`, `messages_read`
