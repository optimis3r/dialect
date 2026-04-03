# DIALECT — Intelligent Debate Matchmaking & Skill-Adaptive Platform

> **Debate-based Intelligent Adaptive Learning and Evaluation using Communication Technologies**
>
> Team: Sumedh Jamadagni (A76) · Rishikesh Mahato (A88) · Tanuj Kulkarni (A78)  
> NIT Warangal · Software Engineering Project · 2025–26

---

## Demo Setup Notes

- Local frontend runtime should use `VITE_SERVER_URL=http://localhost:5000`.
- The default setup is completely free and local:
  - AI opponent replies use Ollama
  - Debate reports use local NLP
  - AI voice playback uses browser speech synthesis fallback
  - Voice practice transcription uses browser speech recognition
- Optional hosted-AI overrides:
  - `OPENAI_MODEL`
  - `OPENAI_REPORT_MODEL`
  - `OPENAI_AI_OPPONENT_MODEL`
  - `OPENAI_TTS_MODEL` (recommended `gpt-4o-mini-tts`)
  - `OPENAI_TTS_VOICE` (default `coral`)
  - `OPENAI_TRANSCRIBE_MODEL` (recommended `gpt-4o-mini-transcribe`)
  - `OPENAI_BASE_URL`
- Recommended free local model: `qwen2.5:3b`

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Prerequisites](#4-prerequisites)
5. [Quick Start](#5-quick-start)
6. [Environment Variables](#6-environment-variables)
7. [Feature Walkthrough](#7-feature-walkthrough)
8. [REST API Reference](#8-rest-api-reference)
9. [Socket.io Events Reference](#9-socketio-events-reference)
10. [WebRTC Flow](#10-webrtc-flow)
11. [Elo Matchmaking Algorithm](#11-elo-matchmaking-algorithm)
12. [AI / NLP Analysis Engine](#12-ai--nlp-analysis-engine)
13. [Admin Panel](#13-admin-panel)
14. [Deployment Notes](#14-deployment-notes)
15. [SRS Traceability](#15-srs-traceability)

---

## 1. Project Overview

DIALECT is a full-stack web platform that enables structured debates between users in **Text**, **Voice**, and **Video** modes. It uses a modified Elo rating system for fair matchmaking, a **Ghost Mode** for anonymous participation (reducing public-speaking anxiety), and an AI analysis pipeline that defaults to free local NLP/Ollama with optional OpenAI integration if you explicitly enable it later.

### Core Capabilities
| Feature | Status | SRS Ref |
|---|---|---|
| User registration & JWT auth | ✅ Complete | REQ-4.1 |
| Ghost / Public identity mode | ✅ Complete | REQ-4.2 |
| Elo-based real-time matchmaking | ✅ Complete | REQ-4.3 |
| Text debate with turn timer | ✅ Complete | REQ-4.4 |
| Voice debate (WebRTC) | ✅ Complete | REQ-4.5 |
| Video debate (WebRTC) | ✅ Complete | REQ-4.6 |
| Free local debate coaching with optional hosted AI | ✅ Complete | REQ-4.7 |
| Global leaderboard (Public Mode) | ✅ Complete | REQ-4.8 |
| Play Against AI (text practice mode) | ✅ Complete | REQ-4.4 / REQ-4.7 |
| Profanity auto-filter | ✅ Complete | §5.2 |
| Flag / moderation system | ✅ Complete | §5.2 |
| Admin panel | ✅ Complete | §5.2 |
| Debate history & AI reports | ✅ Complete | REQ-4.7.3 |

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, React Router 6, Vite 5 |
| **Styling** | Pure CSS variables (no Tailwind/MUI — custom design system) |
| **Real-time** | Socket.io 4 (WebSocket) |
| **Audio/Video** | WebRTC (browser-native) with STUN servers |
| **Backend** | Node.js 18+, Express 4 |
| **Database** | MongoDB 7 + Mongoose 8 |
| **Auth** | JWT (jsonwebtoken) + bcryptjs |
| **AI / NLP** | Ollama local LLM (free) + `sentiment` + custom lexical analysis |
| **Matchmaking** | In-memory queue, Elo ±150 with 50-point tolerance expansion |

---

## 3. Folder Structure

```
dialect/
├── backend/
│   ├── src/
│   │   ├── server.js            # Express + Socket.io entry point
│   │   ├── models/
│   │   │   ├── User.js          # User schema (Elo, mode, history)
│   │   │   └── DebateSession.js # Session schema (transcript, AI report, flags)
│   │   ├── controllers/
│   │   │   └── authController.js
│   │   ├── middleware/
│   │   │   └── auth.js          # JWT protect + adminOnly guards
│   │   ├── routes/
│   │   │   ├── auth.js          # /api/auth/*
│   │   │   ├── debate.js        # /api/debate/*
│   │   │   └── leaderboard.js   # /api/leaderboard/*
│   │   ├── services/
│   │   │   ├── nlpService.js       # Local lexical diversity + sentiment fallback
│   │   │   ├── openaiService.js    # OpenAI Responses API helper
│   │   │   ├── aiReportService.js  # Rich coaching report generation
│   │   │   ├── aiOpponentService.js# Play Against AI turn generation
│   │   │   └── matchmakingService.js # In-memory queue
│   │   └── socket/
│   │       └── socketHandler.js # All Socket.io logic
│   ├── scripts/
│   │   └── seed-admin.js        # Creates first admin account
│   ├── .env                     # Environment config
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── main.jsx             # React entry point
    │   ├── App.jsx              # Router + providers
    │   ├── context/
    │   │   ├── AuthContext.jsx  # Global user state
    │   │   └── SocketContext.jsx# Global socket connection
    │   ├── hooks/
    │   │   └── useWebRTC.js     # WebRTC peer connection hook
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   └── Guards.jsx       # RequireAuth, RedirectIfAuth
    │   ├── pages/
    │   │   ├── AuthPage.jsx     # Login + Register
    │   │   ├── Dashboard.jsx    # User home
    │   │   ├── Lobby.jsx        # Matchmaking queue
    │   │   ├── DebateRoom.jsx   # Full debate (text/voice/video)
    │   │   ├── ReportPage.jsx   # AI post-debate report
    │   │   ├── Leaderboard.jsx  # Global rankings
    │   │   ├── History.jsx      # Past debates
    │   │   └── AdminPanel.jsx   # Moderation dashboard
    │   ├── styles/
    │   │   └── globals.css      # CSS variables + utility classes
    │   └── utils/
    │       └── api.js           # Axios instance with auth interceptor
    ├── .env                     # VITE_SERVER_URL
    ├── index.html
    └── package.json
```

---

## 4. Prerequisites

| Tool | Minimum Version |
|---|---|
| Node.js | 18.x |
| npm | 9.x |
| MongoDB | 6.x (local) or MongoDB Atlas |
| Modern Browser | Chrome 90+, Firefox 88+, Edge |

MongoDB must be running before you start the backend.

```bash
# Start MongoDB locally (macOS/Linux)
mongod --dbpath /usr/local/var/mongodb

# Or with systemd (Ubuntu)
sudo systemctl start mongod
```

---

## 5. Quick Start

### Step 1 — Clone and install

```bash
git clone <repo-url>
cd dialect

# Install backend
cd backend && npm install

# Install frontend
cd ../frontend && npm install
```

### Step 2 — Configure environment

```bash
# Backend — edit backend/.env (already pre-configured for local dev)
# Frontend — edit frontend/.env (already pre-configured for local dev)
```

### Step 3 — Create admin account

```bash
cd backend
node scripts/seed-admin.js
# Output: ✅ Admin created — username: admin  password: Admin@1234
```

### Step 4 — Start servers (two terminals)

```bash
# Terminal 1 — Backend (port 5000)
cd backend && npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

### Step 5 — Open in browser

```
http://localhost:5173
```

Register two accounts in two browser tabs to test matchmaking.

---

## 6. Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Express server port |
| `MONGO_URI` | `mongodb://localhost:27017/dialect` | MongoDB connection string |
| `JWT_SECRET` | `dialect_super_secret...` | Secret for JWT signing — **change in production** |
| `JWT_EXPIRES_IN` | `24h` | Token expiry |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin |
| `AI_PROVIDER` | `ollama` | Default AI provider for free local debate turns |
| `AI_OPPONENT_PROVIDER` | `AI_PROVIDER` | Provider for AI debate replies |
| `AI_REPORT_PROVIDER` | `local-nlp` | Provider for debate reports |
| `AI_VOICE_PROVIDER` | `browser` | Provider for server speech helpers |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Local Ollama server URL |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Default local Ollama model |
| `OLLAMA_AI_OPPONENT_MODEL` | `OLLAMA_MODEL` | Optional override for AI debate turns |
| `OPENAI_API_KEY` | â€” | Optional only if you intentionally switch providers back to OpenAI |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Default OpenAI model for server-side requests |
| `OPENAI_REPORT_MODEL` | `OPENAI_MODEL` | Optional override for post-debate reports |
| `OPENAI_AI_OPPONENT_MODEL` | `OPENAI_MODEL` | Optional override for Play Against AI turns |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Optional override for compatible gateways |
| `NODE_ENV` | `development` | Environment flag |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_SERVER_URL` | `http://https://dialect.up.railway.app0` | Backend URL for Socket.io |

---

## 7. Feature Walkthrough

### Registration & Auth
- Register with username + email + password
- New accounts default to **Ghost Mode** (alias like `Debater_4821`)
- JWT stored in `localStorage`, auto-attached to all API calls
- 24-hour token expiry; auto-redirect to `/login` on 401

### Ghost / Public Mode
- Toggle from the Dashboard → Identity Mode card
- Ghost Mode: opponents only see your alias; hidden from leaderboard
- Public Mode: real username shown; appears on global leaderboard
- **Constraint (BR-06):** Must complete ≥1 debate before switching to Public

### Matchmaking (Lobby)
- Select debate mode: Text / Voice / Video
- Select topic (10 options + General)
- Joins a Socket.io queue; matched with opponent within ±150 ELO
- Tolerance expands by +50 every 60 seconds (shown in UI)
- Both users receive `match:found` event with `roomId`
- **Play Against AI** creates an instant text-only practice room from the lobby or dashboard
- AI practice debates are deliberately **unrated**, but their transcripts and reports are still saved

### Debate Room
- **Text mode:** Turn-based chat with 2-minute turn timer per round (5 rounds)
  - Real-time vocabulary hints as you type (weak words highlighted with suggestions)
  - Profanity auto-filtered before broadcast
  - Forfeit or flag opponent at any time
- **Voice mode:** WebRTC P2P audio — mic mute control, speaking indicators
- **Video mode:** WebRTC P2P video+audio — camera + mic toggles
- Disconnect protection: 60-second grace period before forfeit

### AI Performance Report
- Generated automatically on debate end
- In the default free setup, the backend generates reports with local NLP so the flow completes without paid APIs
- If you later switch providers back to OpenAI, the app can still use richer hosted coaching
- **Lexical Diversity Score** (0–100): unique-word ratio × 150, capped at 100
- **Vocabulary Score**: combined lexical diversity + weak-word penalty
- **Weak Words**: overused simple words detected (e.g. "good", "very", "thing")
- **Suggestions**: specific replacement words for each weak word
- **Sentiment Analysis**: positive / slightly positive / neutral / slightly negative / negative
- **Head-to-Head Comparison**: bar chart comparing both debaters' scores
- Winner determined by vocabulary score (gap > 5 points; otherwise draw)

### Elo Rating System
- Standard Elo formula: K=32, expected score based on rating difference
- Winner gains more points for defeating higher-rated opponents
- Ghost Mode debates still update ELO (hidden from leaderboard)
- Minimum ELO floor: 100

---

## 8. REST API Reference

All protected routes require: `Authorization: Bearer <token>`

### Auth (`/api/auth`)

| Method | Endpoint | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/register` | ❌ | `{username, email, password}` | Register new user |
| POST | `/login` | ❌ | `{email, password}` | Login, returns JWT |
| GET | `/me` | ✅ | — | Get current user |
| PATCH | `/mode` | ✅ | `{mode: "ghost"|"public"}` | Switch identity mode |
| GET | `/profile/:id` | ✅ | — | Get user profile |

### Debate (`/api/debate`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/session/:roomId` | ✅ | Get session details (participants only) |
| GET | `/history` | ✅ | Get current user's last 20 debates |
| GET | `/report/:roomId` | ✅ | Get AI report for a completed debate |

### Leaderboard (`/api/leaderboard`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | ✅ | Top 100 Public Mode users by ELO |
| GET | `/admin/flags` | ✅ Admin | All flagged debate sessions |
| POST | `/admin/ban/:userId` | ✅ Admin | `{reason}` — Ban a user |

---

## 9. Socket.io Events Reference

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `queue:join` | `{topic, mode}` | Join matchmaking queue |
| `queue:leave` | — | Leave queue |
| `ai:match:create` | `{topic, language, difficulty, persona}` | Start an unrated Play Against AI room |
| `room:join` | `{roomId}` | Join debate room after match |
| `debate:send_message` | `{roomId, content}` | Send text message (text mode) |
| `debate:forfeit` | `{roomId}` | Forfeit current debate |
| `debate:flag` | `{roomId, reason, category}` | Report opponent |
| `debate:reconnect` | `{roomId}` | Reconnect after drop |
| `webrtc:offer` | `{roomId, offer}` | Forward WebRTC SDP offer |
| `webrtc:answer` | `{roomId, answer}` | Forward WebRTC SDP answer |
| `webrtc:ice_candidate` | `{roomId, candidate}` | Forward ICE candidate |
| `webrtc:ready` | `{roomId}` | Signal peer-ready for WebRTC |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `queue:joined` | `{queueSize}` | Confirmed in queue |
| `queue:left` | — | Confirmed left queue |
| `match:found` | `{roomId, topic, mode, opponentAlias, side, matchType, isRated}` | Match found |
| `debate:started` | `{topic, mode, aliasA, aliasB, firstTurn, turnDuration, maxRounds, matchType, isRated}` | Debate begins |
| `debate:message` | `{alias, content, filtered, round, side, timestamp}` | New message broadcast |
| `debate:turn_change` | `{turn, round, timedOut}` | Turn switched |
| `debate:timer` | `{remaining, turn}` | Countdown tick (every second) |
| `debate:ended` | `{winner, reason, eloChangeA, eloChangeB, newEloA, newEloB, report, ...}` | Debate finished |
| `debate:opponent_disconnected` | `{timeout}` | Opponent dropped (60s grace) |
| `debate:opponent_reconnected` | — | Opponent reconnected |
| `flag:confirmed` | `{message}` | Flag submission confirmed |
| `webrtc:offer` | `{offer, from}` | Relayed SDP offer |
| `webrtc:answer` | `{answer, from}` | Relayed SDP answer |
| `webrtc:ice_candidate` | `{candidate, from}` | Relayed ICE candidate |
| `webrtc:peer_ready` | `{from}` | Peer ready for WebRTC |
| `error` | `{message}` | Server-side error |

---

## 10. WebRTC Flow

```
User A (Initiator)                  Server                   User B
      |                               |                          |
      |-- webrtc:ready -------------->|                          |
      |                               |-- webrtc:peer_ready ---->|
      |                               |                          |
      |  (User B creates PC)          |                          |
      |                               |<-- webrtc:ready ---------|
      |<-- webrtc:peer_ready ---------|                          |
      |                               |                          |
      | (User A creates offer)        |                          |
      |-- webrtc:offer -------------->|-- webrtc:offer --------->|
      |                               |                          |
      |                    (User B creates answer)               |
      |                               |<-- webrtc:answer --------|
      |<-- webrtc:answer -------------|                          |
      |                               |                          |
      |<---- ICE candidates --------->|<---- ICE candidates ---->|
      |                               |                          |
      |<=========== P2P Audio/Video Connection ===============>|
```

STUN servers: `stun.l.google.com:19302`, `stun1.l.google.com:19302`

For production add a TURN relay server for restricted networks.

---

## 11. Elo Matchmaking Algorithm

```
K  = 32
Expected(A) = 1 / (1 + 10^((ratingB - ratingA) / 400))

If A wins:
  A_change = round(K × (1 − Expected(A)))   → positive
  B_change = round(K × (0 − Expected(A)))   → negative

Draw: no change (future enhancement)
```

Queue tolerance starts at ±150 ELO and expands by +50 every 60 seconds.  
ELO floor is 100 (can never drop below).

---

## 12. AI / NLP Analysis Engine

Located in `backend/src/services/nlpService.js`. All analysis is server-side.

### Lexical Diversity Score
```
tokens     = all words (3+ chars, lowercase)
unique     = Set(tokens)
TTR        = unique.size / tokens.length     (Type-Token Ratio)
score      = min(TTR × 150, 100)
```

### Vocabulary Score
```
vocabScore = (lexicalDiversity × 0.7) + ((10 − weakWordCount) × 3)
```

### Weak Word Detection
28 common weak words detected: `good, bad, nice, big, small, very, really, just, many, few, thing, stuff, get, make, like, okay, fine, great, cool, awesome, terrible, horrible, said, say, used, do, a lot, some`.

Each weak word maps to 2–4 strong alternatives shown in the report.

### Sentiment Analysis
Uses the `sentiment` npm package (AFINN-based):
- score > 3 → positive
- score 1–3 → slightly positive
- score 0 → neutral
- score −1 to −3 → slightly negative
- score < −3 → negative

### Winner Determination
- If `vocabScoreA − vocabScoreB > 5` → A wins
- If `vocabScoreB − vocabScoreA > 5` → B wins
- Otherwise → draw

---

## 13. Admin Panel

Access via `/admin` (requires `role: "admin"` in DB).

**Create admin:**
```bash
cd backend && node scripts/seed-admin.js
# Credentials: admin / Admin@1234
```

**Tabs:**
1. **Flagged Sessions** — All debates with user reports; links to AI report
2. **Users** — All public-mode users with IDs (for banning)
3. **Ban User** — Paste User ID + reason → immediate account lock

---

## 14. Deployment Notes

### Backend (e.g. Railway, Render, EC2)
1. Set all env variables (especially `JWT_SECRET`, `MONGO_URI`, `CLIENT_URL`)
2. MongoDB Atlas recommended for cloud DB
3. `npm start` runs `node src/server.js`

### Frontend (e.g. Vercel, Netlify)
1. Set `VITE_SERVER_URL=https://your-backend-url.com`
2. `npm run build` → deploy `dist/` folder
3. Configure SPA fallback (all routes → `index.html`)

### HTTPS (Required for WebRTC in production)
WebRTC requires a secure context. Both frontend and backend must be served over HTTPS in production.

### TURN Server (Optional but recommended)
For voice/video behind NAT/firewalls, add TURN credentials in `frontend/src/hooks/useWebRTC.js`:
```js
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'user',
      credential: 'pass'
    }
  ]
};
```

---

## 15. SRS Traceability

| SRS Requirement | Implementation File(s) |
|---|---|
| REQ-4.1 User Authentication | `authController.js`, `auth.js` (route), `AuthPage.jsx` |
| REQ-4.2 Ghost / Public Mode | `User.js` (model), `authController.js#updateMode`, `Dashboard.jsx` |
| REQ-4.3 Elo Matchmaking | `matchmakingService.js`, `socketHandler.js#createRoom` |
| REQ-4.4 Text Debate | `socketHandler.js`, `DebateRoom.jsx` |
| REQ-4.5 Voice Debate | `useWebRTC.js`, `socketHandler.js` (WebRTC signaling) |
| REQ-4.6 Video Debate | `useWebRTC.js`, `DebateRoom.jsx` (VideoPanel) |
| REQ-4.7 AI Vocabulary Analysis | `nlpService.js`, `ReportPage.jsx` |
| REQ-4.7.3 Post-Debate Report | `debate.js` (route), `ReportPage.jsx` |
| REQ-4.8 Leaderboard | `leaderboard.js` (route + controller), `Leaderboard.jsx` |
| §5.2 Profanity Filter | `nlpService.js#filterProfanity`, `socketHandler.js` |
| §5.2 Flag / Moderation | `socketHandler.js#debate:flag`, `AdminPanel.jsx` |
| BR-02 Ghost Mode anonymity | `User.js#ghostAlias`, `socketHandler.js` (alias in session) |
| BR-03 Leaderboard Public only | `leaderboard.js` (`mode: 'public'` filter) |
| §5.4 Reconnect within 60s | `socketHandler.js#disconnect` (60s timeout + reconnect) |

---

*DIALECT v1.0 — NIT Warangal Software Engineering, 2026*
