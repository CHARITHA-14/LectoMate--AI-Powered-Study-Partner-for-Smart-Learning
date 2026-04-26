# Lectomate — AI-Powered Study Assistant

Upload documents → get AI-generated notes, flashcards, quizzes, and a personal AI tutor chatbot.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router v6 |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) |
| AI | Google Gemini 1.5 Flash |
| Auth | JWT (bcryptjs) |

---

## Local Development

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongod`)
- A Google Gemini API key ([get one free](https://aistudio.google.com/app/apikey))

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/lectomate.git
cd lectomate

# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..
```

### 2. Configure environment

```bash
# Backend
cp server/.env.example server/.env
# Edit server/.env — set MONGODB_URI and OPENAI_API_KEY

# Frontend (optional for local dev)
cp .env.example .env
# VITE_API_URL is not needed locally — defaults to http://localhost:3001
```

### 3. Run

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deployment

### Architecture

```
┌─────────────────────┐     HTTPS      ┌──────────────────────┐
│   Vercel / Netlify  │ ─────────────► │  Railway / Render    │
│   (React frontend)  │                │  (Express backend)   │
└─────────────────────┘                └──────────┬───────────┘
                                                   │
                                        ┌──────────▼───────────┐
                                        │   MongoDB Atlas      │
                                        │   (free M0 cluster)  │
                                        └──────────────────────┘
```

---

### Step 1 — MongoDB Atlas (free database)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) → **Create free account**
2. Create a **free M0 cluster** (any region)
3. Under **Database Access** → Add a user with password
4. Under **Network Access** → Add IP `0.0.0.0/0` (allow all — needed for Railway/Render)
5. Click **Connect** → **Drivers** → copy the connection string:
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/lectomate?retryWrites=true&w=majority
   ```
   Save this — you'll need it in Step 2.

---

### Step 2 — Deploy Backend on Railway (free)

1. Go to [railway.app](https://railway.app) → **Login with GitHub**
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository → set **Root Directory** to `server`
4. Railway auto-detects Node.js and runs `npm start`
5. Go to **Variables** tab → add these environment variables:

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `3001` |
   | `MONGODB_URI` | your Atlas connection string from Step 1 |
   | `OPENAI_API_KEY` | your Gemini API key |
   | `JWT_SECRET` | any long random string (e.g. `openssl rand -hex 32`) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `MAX_FILE_SIZE` | `10485760` |
   | `UPLOAD_DIR` | `uploads` |
   | `FRONTEND_URL` | *(leave blank for now — fill in after Step 3)* |

6. Go to **Settings** → **Networking** → **Generate Domain**
7. Copy your Railway URL (e.g. `https://lectomate-api.up.railway.app`)
8. Come back and set `FRONTEND_URL` to your Vercel URL (after Step 3)

---

### Step 3 — Deploy Frontend on Vercel (free)

1. Go to [vercel.com](https://vercel.com) → **Login with GitHub**
2. Click **Add New Project** → import your repository
3. Vercel auto-detects Vite. Settings should be:
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Root Directory**: `.` (project root)
4. Under **Environment Variables** → add:

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | your Railway URL from Step 2 (e.g. `https://lectomate-api.up.railway.app`) |

5. Click **Deploy**
6. Copy your Vercel URL (e.g. `https://lectomate.vercel.app`)
7. Go back to Railway → update `FRONTEND_URL` to this Vercel URL

---

### Step 4 — Push your code to GitHub

```bash
# In your project root
git init
git add .
git commit -m "Initial commit — Lectomate AI Study Assistant"

# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/lectomate.git
git branch -M main
git push -u origin main
```

Both Vercel and Railway will auto-redeploy on every push to `main`.

---

## Environment Variables Reference

### Frontend (`.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Production only | Full URL of your backend (no trailing slash) |

### Backend (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Server port (Railway sets this automatically) |
| `NODE_ENV` | Yes | `development` or `production` |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `OPENAI_API_KEY` | Yes | Google Gemini API key |
| `JWT_SECRET` | Yes | Long random secret for signing tokens |
| `JWT_EXPIRES_IN` | Yes | Token expiry (e.g. `7d`) |
| `FRONTEND_URL` | Yes | Frontend URL for CORS |
| `MAX_FILE_SIZE` | No | Max upload size in bytes (default 10MB) |
| `UPLOAD_DIR` | No | Upload directory name (default `uploads`) |

---

## Features

- **Document Upload** — PDF, DOCX, TXT support
- **AI Notes** — Structured summaries with key terms highlighted
- **Flashcards** — AI-generated with spaced repetition tracking
- **Quizzes** — Multiple-choice and true/false with explanations
- **AI Chatbot** — Per-document context, embedded PDF viewer
- **Student Profile** — Avatar upload, account settings, progress tracking
- **Client-side routing** — Every page has a unique URL

## License

MIT
