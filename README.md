# Animepride

A responsive black-and-red anime discovery website starter for Visual Studio Code.

## Features
- React + Vite responsive frontend
- Anime cards, search, genre filtering, detail modal, browser-local watchlist
- Demo built-in HTML video player
- FastAPI backend with online anime metadata search/top anime through Jikan API
- Health endpoint and interactive API docs
- Sample news and recommendations sections

## Requirements
Install Node.js LTS, npm, and Python 3.10+.

## Start frontend
```bash
cd frontend
npm install
npm run dev
```
Open the URL printed by Vite, usually http://localhost:5173.

## Start backend (Windows PowerShell, second terminal)
```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
If `py` is unavailable, use `python`. If activation is blocked, run:
`.venv\Scripts\python.exe -m pip install -r requirements.txt`
`.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000`

## Backend (macOS/Linux)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend checks:
- http://127.0.0.1:8000/health
- http://127.0.0.1:8000/docs

## Internet metadata
The backend retrieves anime metadata from Jikan API. API availability and rate limits can change. Keep source attribution and follow the provider's terms. The frontend falls back to its starter catalogue when the backend is unavailable.

## Important limitations
This is a starter/demo, not a production-ready streaming platform. Sign-in and admin UI are previews only and do not implement secure authentication. Watchlists are stored in the current browser only. The video player uses a public sample video, not an anime episode. Before publishing, replace it with videos you own or are authorized to distribute, and implement proper authentication, database storage, admin authorization, security, and hosting.
