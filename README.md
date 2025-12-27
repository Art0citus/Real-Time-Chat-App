# Real-Time Chat App

A production-ready, extensible real-time chat application built with Node.js (Express + Socket.IO) for the backend and React for the frontend. This README includes setup, development, deployment, architecture, and API/socket conventions tailored to this tech stack.

## Features

- Real-time one-to-one and group messaging
- Persistent message history (pagination)
- Read receipts and delivery acknowledgements
- Typing indicators and presence (online/offline)
- File and image attachments
- Authentication with JWT
- Scalable Socket.IO using Redis adapter (for multi-instance)
- Basic message reactions, editing and deleting (configurable)


## Tech Stack

- Backend: Node.js, Express, Socket.IO
- Frontend: React (Vite or Create React App)
- Database: PostgreSQL (or MongoDB alternative)
- Cache / PubSub: Redis (Socket.IO adapter + presence)
- File Storage: AWS S3 (recommended) or local uploads for development


## Demo

Add a live demo URL or screenshots here:

- Live demo: https://example.com
- Screenshots: put images in `docs/` or `public/` and reference them here


## Architecture

High level:

1. Client authenticates using REST and stores JWT
2. Client opens Socket.IO connection to the server with the JWT
3. Server validates JWT and joins the user to personal and room namespaces/rooms
4. Messages sent via Socket.IO are persisted to the database and broadcast to room members
5. Redis adapter ensures events are propagated across server instances in production


## Prerequisites

- Node.js 18+
- npm (or yarn)
- PostgreSQL (or MongoDB)
- Redis (for production scaling / presence)
- AWS account for S3 (optional for file storage)


## Environment variables

Create a `.env` file in the `server` directory (example):

```
# Server
PORT=4000
NODE_ENV=development

# Auth
JWT_SECRET=supersecret_jwt_key
JWT_EXPIRY=7d

# Database (Postgres example)
DATABASE_URL=postgres://user:password@localhost:5432/chatdb

# Redis
REDIS_URL=redis://localhost:6379

# S3 (optional)
S3_BUCKET_NAME=your-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...

# Optional
FRONTEND_ORIGIN=http://localhost:3000
```

Adjust variable names if your code uses different ones.


## Running locally (development)

This repo assumes a two-folder structure at the repository root:

- `server/` — Node.js + Express + Socket.IO backend
- `client/` — React frontend

### Backend (server)

```bash
cd server
npm install

# run migrations / setup DB if you have them
npm run db:migrate # optional

# start dev server (with nodemon)
npm run dev
```

Typical scripts in `server/package.json`:

```json
{
  "scripts": {
    "dev": "nodemon --watch src --exec ts-node src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "db:migrate": "your-migration-command-here"
  }
}
```

Server will listen on `http://localhost:4000` (or the PORT you set).


### Frontend (client)

```bash
cd client
npm install
npm run dev
# or
npm start
```

Typical scripts in `client/package.json` (Vite):

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

Open `http://localhost:3000` by default.


## Running with Docker

Example `docker-compose.yml` (root):

```yaml
version: "3.8"
services:
  server:
    build: ./server
    env_file:
      - ./server/.env
    ports:
      - "4000:4000"
    depends_on:
      - db
      - redis

  client:
    build: ./client
    ports:
      - "3000:3000"

  db:
    image: postgres:15
    environment:
      POSTGRES_USER: chat
      POSTGRES_PASSWORD: chat
      POSTGRES_DB: chatdb
    volumes:
      - db-data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

volumes:
  db-data:
```

Start:

```bash
docker compose up --build
```


## Socket.IO events (server <-> client)

These are recommended event names and payloads. Match them to your implementation.

- Connection / Auth
  - Client -> Server: `authenticate` { token }
  - Server -> Client: `authenticated` | `auth_error` { message }

- Rooms & Presence
  - Client -> Server: `join_room` { roomId }
  - Client -> Server: `leave_room` { roomId }
  - Server -> Room: `presence_update` { userId, status }

- Messaging
  - Client -> Server: `send_message` { roomId, content, attachments?, tempId? }
  - Server -> Room: `message` { id, roomId, senderId, content, attachments, createdAt }
  - Server -> Sender: `message_ack` { tempId, id }
  - Client -> Server: `message_read` { messageId, roomId }
  - Server -> Room: `message_read` { messageId, readerId, readAt }

- Typing
  - Client -> Server: `typing` { roomId }
  - Client -> Server: `stop_typing` { roomId }
  - Server -> Room: `user_typing` { userId, roomId }

- Delivery, Reactions, Edit/Delete
  - Server -> Room: `message_delivered` { messageId, deliveredTo: [userIds] }
  - Client -> Server: `react_message` { messageId, reaction }
  - Server -> Room: `message_reaction` { messageId, reaction, userId }
  - Client -> Server: `edit_message` { messageId, newContent }
  - Client -> Server: `delete_message` { messageId }

Security notes:
- Attach JWT to the Socket.IO handshake (token in query or auth field) and validate server-side.
- Rate-limit `send_message` and attachment uploads.


## REST API endpoints (example)

These endpoints complement sockets for non-real-time actions (auth, uploads, history):

- POST /api/auth/register — register new user
- POST /api/auth/login — login (returns JWT)
- GET /api/users/me — current user profile
- GET /api/rooms — list rooms the user is part of
- POST /api/rooms — create a new room (group)
- GET /api/rooms/:roomId/messages?limit=&before= — get message history (pagination)
- POST /api/messages/upload — upload attachment (returns URL)
- POST /api/messages/:id/read — mark message as read (optional, can use sockets)

All endpoints that require a user must validate the JWT.


## Database schemas (examples)

Postgres (simplified):

messages
- id UUID PK
- room_id UUID FK
- sender_id UUID FK
- content TEXT
- attachments JSONB (array of {url, filename, mime})
- created_at TIMESTAMP
- updated_at TIMESTAMP
- edited_at TIMESTAMP NULLABLE

rooms
- id UUID PK
- name TEXT
- is_private BOOLEAN
- created_at TIMESTAMP

room_members
- room_id UUID FK
- user_id UUID FK
- role TEXT (owner/admin/member)
- joined_at TIMESTAMP

users
- id UUID PK
- username TEXT UNIQUE
- email TEXT UNIQUE
- password_hash TEXT
- avatar_url TEXT
- last_seen TIMESTAMP

Index messages on (room_id, created_at) for efficient pagination.


## File uploads & storage

- For production: store files in S3 and keep metadata in DB.
- For development: store files locally under `/server/uploads` and serve them statically.
- Protect access to private attachments by signing URLs or checking auth on download endpoints.


## Testing

- Backend unit tests: Jest / Vitest
- Integration tests: Supertest (for REST) + test Socket.IO client (socket.io-client)
- Frontend E2E: Playwright or Cypress

Example:

```bash
# run server tests
cd server
npm run test

# run client tests
cd client
npm run test
```


## Deployment

- Backend: containerize and deploy to any cloud (AWS ECS/EKS, DigitalOcean App Platform, Render, Heroku)
- Frontend: Vercel / Netlify / static hosting
- Use Redis (managed) and Postgres (managed) in production
- Use environment variables for secrets, enable HTTPS, and rotate keys

Scaling tips:
- Use a Redis adapter for Socket.IO to broadcast across instances
- Store session or recent presence in Redis
- Use horizontal auto-scaling behind a load balancer with sticky sessions or socket affinity if not using Redis adapter


## Extending the app

Ideas and common tasks:
- Add message search (Postgres full-text / Elasticsearch)
- Add end-to-end encryption (client-side encryption)
- Add read receipts per-user per-message
- Add message reactions and threaded replies
