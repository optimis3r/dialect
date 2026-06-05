# DIALECT — Intelligent Debate Matchmaking & Skill-Adaptive Learning Platform

## Overview

DIALECT is an interactive debate platform designed to address two common barriers to public speaking:

* Difficulty finding opponents of similar skill levels
* Fear of public speaking and social judgment

The platform enables users to participate in **Text, Voice, and Video debates**, while an adaptive matchmaking engine pairs participants based on skill ratings. After each debate, an AI-powered analysis engine generates personalized feedback on vocabulary usage, communication quality, and speaking effectiveness.

A unique **Ghost Mode** allows users to debate anonymously, encouraging participation from individuals who may experience stage fright or social anxiety.

---

## Key Features

### Intelligent Matchmaking

* Elo-based skill rating system
* Real-time matchmaking queues
* Dynamic rating tolerance expansion
* Fair pairing across multiple debate modes

### Multi-Modal Debates

* Text-based debates with timed turns
* Voice debates using WebRTC
* Video debates using WebRTC
* Real-time communication with low latency

### AI-Powered Coaching

* Automated post-debate evaluation
* Vocabulary and lexical diversity analysis
* Weak-word detection and replacement suggestions
* Sentiment analysis
* Personalized improvement recommendations

### Accessibility & User Experience

* Anonymous Ghost Mode
* Public identity mode with rankings
* Global leaderboard
* Debate history and analytics
* AI practice opponent for solo training

### Moderation & Safety

* Profanity filtering
* User reporting system
* Administrative moderation dashboard
* Debate session review tools

---

## System Architecture

```text
React + Vite Frontend
          │
          ▼
   Socket.io Layer
          │
          ▼
 Node.js + Express API
          │
 ┌────────┴────────┐
 ▼                 ▼
MongoDB      AI/NLP Engine
                   │
            Ollama / OpenAI
```

---

## Tech Stack

| Category                | Technologies                       |
| ----------------------- | ---------------------------------- |
| Frontend                | React, Vite, React Router          |
| Backend                 | Node.js, Express                   |
| Database                | MongoDB, Mongoose                  |
| Authentication          | JWT, bcrypt                        |
| Real-Time Communication | Socket.io                          |
| Voice & Video           | WebRTC                             |
| AI/NLP                  | Ollama, OpenAI, Sentiment Analysis |
| Deployment              | Railway, Vercel, MongoDB Atlas     |

---

## Technical Highlights

### Adaptive Elo Matchmaking

Implemented a modified Elo rating system that dynamically expands matchmaking thresholds over time, reducing queue durations while maintaining competitive fairness.

### Real-Time Communication Infrastructure

Built a complete Socket.io event system supporting:

* Matchmaking
* Debate synchronization
* Live messaging
* Session management
* Reconnection handling

### WebRTC Integration

Implemented peer-to-peer audio and video communication using:

* SDP offer/answer exchange
* ICE candidate negotiation
* STUN server configuration
* Connection recovery mechanisms

### AI Evaluation Pipeline

Developed an automated debate assessment engine capable of:

* Lexical diversity scoring
* Vocabulary quality measurement
* Weak-word identification
* Sentiment classification
* Comparative performance reporting

---

## Project Structure

```text
dialect/
├── frontend/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   └── context/
│
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── models/
│   └── socket/
│
└── database/
```

---

## Getting Started

### Prerequisites

* Node.js 18+
* MongoDB
* npm

### Installation

```bash
git clone <repository-url>
cd dialect

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Run the Application

```bash
# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

---

## Future Enhancements

* AI-generated debate topics
* Speech delivery analysis
* Argument quality scoring
* Tournament mode
* Team debates
* Advanced analytics dashboard
* Mobile application support

---

## Learning Outcomes

This project involved practical experience with:

* Distributed real-time systems
* WebRTC networking
* Adaptive ranking algorithms
* Full-stack application development
* AI-assisted user feedback systems
* Authentication and authorization
* Scalable event-driven architectures

---

## Contributors

* Sumedh Jamadagni
* Rishikesh Mahato
* Tanuj Kulkarni

**NIT Warangal**
