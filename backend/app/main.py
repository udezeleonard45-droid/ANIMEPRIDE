from contextlib import asynccontextmanager
from collections import defaultdict, deque
from time import monotonic
from urllib.parse import urlparse
import httpx
from fastapi import FastAPI, Depends, HTTPException, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from .config import settings
from .database import Base, engine, get_db
from .models import User, Anime, Episode, WatchlistItem, Review, Progress, News
from .schemas import RegisterIn, LoginIn, UserOut, AnimeCreate, EpisodeCreate, ReviewIn, ProgressIn, NewsIn
from .security import hash_password, verify_password, create_token
from .deps import get_current_user, require_admin
from .serializers import anime_out, news_out, review_out, progress_out

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="Animepride API", version="1.0.0", lifespan=lifespan, docs_url="/api/docs")
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin], allow_credentials=True,
                   allow_methods=["GET","POST","PUT","DELETE","OPTIONS"], allow_headers=["Content-Type","X-Requested-With"])

# Lightweight per-process auth throttling. Use a shared rate limiter at the edge for multi-replica production.
_attempts = defaultdict(deque)
def throttle(request: Request):
    key = request.client.host if request.client else "unknown"
    now = monotonic()
    bucket = _attempts[key]
    while bucket and now - bucket[0] > 60:
        bucket.popleft()
    if len(bucket) >= 30:
        raise HTTPException(429, "Too many attempts. Try again shortly.")
    bucket.append(now)

def set_session_cookie(response: Response, user_id: int):
    response.set_cookie("animepride_session", create_token(user_id), httponly=True,
        secure=settings.cookie_secure, samesite=settings.cookie_samesite,
        max_age=settings.jwt_expire_minutes * 60, path="/")

def safe_video_url(value: str) -> str:
    if not value:
        return ""
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        raise HTTPException(422, "Video URL must be a valid HTTPS URL you are authorized to use")
    return value

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "animepride-api"}

@app.post("/api/auth/register", response_model=UserOut, status_code=201)
def register(data: RegisterIn, response: Response, request: Request, db: Session = Depends(get_db)):
    throttle(request)
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "Email is already registered")
    if db.scalar(select(User).where(User.username == data.username)):
        raise HTTPException(409, "Username is already taken")
    user = User(email=email, username=data.username, password_hash=hash_password(data.password))
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email or username is already in use")
    set_session_cookie(response, user.id)
    return user

@app.post("/api/auth/login", response_model=UserOut)
def login(data: LoginIn, response: Response, request: Request, db: Session = Depends(get_db)):
    throttle(request)
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if not user or not verify_password(data.password, user.password_hash) or not user.is_active:
        raise HTTPException(401, "Email or password is incorrect")
    set_session_cookie(response, user.id)
    return user

@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie("animepride_session", path="/", httponly=True,
                           secure=settings.cookie_secure, samesite=settings.cookie_samesite)
    return {"ok": True}

@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user

@app.get("/api/anime/featured")
def featured(db: Session = Depends(get_db)):
    local = db.scalars(select(Anime).where(Anime.is_published == True).order_by(Anime.created_at.desc()).limit(12)).all()
    if local:
        return {"source": "catalogue", "data": [anime_out(a) for a in local]}
    # External metadata fallback. Jikan provides information, not episode streams.
    try:
        with httpx.Client(timeout=8.0) as client:
            r = client.get(f"{settings.jikan_base_url}/top/anime", params={"limit": 12})
            r.raise_for_status()
            data = r.json().get("data", [])
        return {"source": "jikan", "data": [jikan_out(x) for x in data]}
    except (httpx.HTTPError, ValueError):
        return {"source": "fallback", "data": []}

def jikan_out(x):
    return {"id": None, "external_mal_id": x.get("mal_id"), "title": x.get("title") or "Untitled",
            "synopsis": x.get("synopsis") or "", "image_url": ((x.get("images") or {}).get("jpg") or {}).get("large_image_url") or "",
            "genres": [g.get("name") for g in x.get("genres", []) if g.get("name")],
            "year": x.get("year"), "status": x.get("status") or "Unknown", "video_url": "", "video_type": "mp4"}

@app.get("/api/anime/search")
def search_anime(q: str = Query(min_length=1, max_length=100), db: Session = Depends(get_db)):
    q = q.strip()
    if not q:
        return {"source": "catalogue", "data": []}
    local = db.scalars(select(Anime).where(Anime.is_published == True, Anime.title.ilike(f"%{q}%")).limit(24)).all()
    if local:
        return {"source": "catalogue", "data": [anime_out(a) for a in local]}
    try:
        with httpx.Client(timeout=8.0) as client:
            r = client.get(f"{settings.jikan_base_url}/anime", params={"q": q, "limit": 18, "sfw": "true"})
            r.raise_for_status()
        return {"source": "jikan", "data": [jikan_out(x) for x in r.json().get("data", [])]}
    except (httpx.HTTPError, ValueError):
        return {"source": "fallback", "data": []}

@app.get("/api/anime/{anime_id}")
def get_anime(anime_id: int, db: Session = Depends(get_db)):
    anime = db.get(Anime, anime_id)
    if not anime or not anime.is_published:
        raise HTTPException(404, "Anime not found in the local catalogue")
    return anime_out(anime)

@app.get("/api/anime/{anime_id}/episodes")
def get_episodes(anime_id: int, db: Session = Depends(get_db)):
    anime = db.get(Anime, anime_id)
    if not anime or not anime.is_published:
        raise HTTPException(404, "Anime not found")
    rows = db.scalars(select(Episode).where(Episode.anime_id == anime_id, Episode.is_published == True).order_by(Episode.episode_number.asc())).all()
    return [{"id": e.id, "anime_id": e.anime_id, "episode_number": e.episode_number, "title": e.title,
             "video_url": e.video_url, "video_type": e.video_type, "duration_seconds": e.duration_seconds}
            for e in rows]

@app.get("/api/anime/{anime_id}/reviews")
def get_reviews(anime_id: int, db: Session = Depends(get_db)):
    rows = db.scalars(select(Review).where(Review.anime_id == anime_id).order_by(Review.created_at.desc()).limit(100)).all()
    return [review_out(x) for x in rows]

@app.post("/api/anime/{anime_id}/reviews")
def save_review(anime_id: int, data: ReviewIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    anime = db.get(Anime, anime_id)
    if not anime or not anime.is_published:
        raise HTTPException(404, "Reviews are available for catalogue titles only")
    review = db.scalar(select(Review).where(Review.user_id == user.id, Review.anime_id == anime_id))
    if review:
        review.rating, review.body, review.username = data.rating, data.body.strip(), user.username
    else:
        review = Review(user_id=user.id, anime_id=anime_id, rating=data.rating, body=data.body.strip(), username=user.username)
        db.add(review)
    db.commit()
    db.refresh(review)
    return review_out(review)

@app.get("/api/news")
def list_news(db: Session = Depends(get_db)):
    rows = db.scalars(select(News).where(News.is_published == True).order_by(News.created_at.desc()).limit(20)).all()
    return [news_out(n) for n in rows]

@app.get("/api/me/watchlist")
def get_watchlist(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(select(WatchlistItem).where(WatchlistItem.user_id == user.id).order_by(WatchlistItem.created_at.desc())).all()
    return [anime_out(row.anime) for row in rows if row.anime and row.anime.is_published]

@app.post("/api/me/watchlist/{anime_id}")
def add_watchlist(anime_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    anime = db.get(Anime, anime_id)
    if not anime or not anime.is_published:
        raise HTTPException(404, "Catalogue title not found")
    exists = db.scalar(select(WatchlistItem).where(WatchlistItem.user_id == user.id, WatchlistItem.anime_id == anime_id))
    if not exists:
        db.add(WatchlistItem(user_id=user.id, anime_id=anime_id))
        db.commit()
    return {"ok": True}

@app.delete("/api/me/watchlist/{anime_id}")
def remove_watchlist(anime_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.scalar(select(WatchlistItem).where(WatchlistItem.user_id == user.id, WatchlistItem.anime_id == anime_id))
    if row:
        db.delete(row)
        db.commit()
    return {"ok": True}

@app.get("/api/me/progress")
def get_progress(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(select(Progress).where(Progress.user_id == user.id).order_by(Progress.updated_at.desc()).limit(50)).all()
    return [progress_out(p) | {"anime": anime_out(p.anime)} for p in rows if p.anime]

@app.put("/api/me/progress/{anime_id}")
def update_progress(anime_id: int, data: ProgressIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    anime = db.get(Anime, anime_id)
    if not anime or not anime.is_published:
        raise HTTPException(404, "A published catalogue title is required")
    has_episode = db.scalar(select(Episode.id).where(Episode.anime_id == anime_id, Episode.is_published == True).limit(1))
    if not anime.video_url and not has_episode:
        raise HTTPException(404, "A published catalogue title with an authorized video is required")
    row = db.scalar(select(Progress).where(Progress.user_id == user.id, Progress.anime_id == anime_id))
    if not row:
        row = Progress(user_id=user.id, anime_id=anime_id)
        db.add(row)
    row.position_seconds, row.duration_seconds = data.position_seconds, data.duration_seconds
    db.commit()
    db.refresh(row)
    return progress_out(row)

@app.get("/api/admin/overview")
def admin_overview(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return {"users": db.scalar(select(func.count(User.id))) or 0,
            "anime": db.scalar(select(func.count(Anime.id))) or 0,
            "reviews": db.scalar(select(func.count(Review.id))) or 0,
            "news": db.scalar(select(func.count(News.id))) or 0}

@app.get("/api/admin/anime")
def admin_list_anime(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return [anime_out(a) for a in db.scalars(select(Anime).order_by(Anime.created_at.desc())).all()]

@app.post("/api/admin/anime", status_code=201)
def admin_create_anime(data: AnimeCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    payload = data.model_dump()
    payload["video_url"] = safe_video_url(payload["video_url"]) if payload["video_url"] else ""
    anime = Anime(**payload)
    db.add(anime); db.commit(); db.refresh(anime)
    return anime_out(anime)

@app.put("/api/admin/anime/{anime_id}")
def admin_update_anime(anime_id: int, data: AnimeCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    anime = db.get(Anime, anime_id)
    if not anime:
        raise HTTPException(404, "Anime not found")
    payload = data.model_dump()
    payload["video_url"] = safe_video_url(payload["video_url"]) if payload["video_url"] else ""
    for k, v in payload.items():
        setattr(anime, k, v)
    db.commit(); db.refresh(anime)
    return anime_out(anime)

@app.delete("/api/admin/anime/{anime_id}")
def admin_delete_anime(anime_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    anime = db.get(Anime, anime_id)
    if not anime:
        raise HTTPException(404, "Anime not found")
    db.delete(anime); db.commit()
    return {"ok": True}

@app.get("/api/admin/anime/{anime_id}/episodes")
def admin_list_episodes(anime_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.scalars(select(Episode).where(Episode.anime_id == anime_id).order_by(Episode.episode_number.asc())).all()
    return [{"id": e.id, "anime_id": e.anime_id, "episode_number": e.episode_number, "title": e.title,
             "video_url": e.video_url, "video_type": e.video_type, "duration_seconds": e.duration_seconds, "is_published": e.is_published}
            for e in rows]

@app.post("/api/admin/anime/{anime_id}/episodes", status_code=201)
def admin_create_episode(anime_id: int, data: EpisodeCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    anime = db.get(Anime, anime_id)
    if not anime:
        raise HTTPException(404, "Anime not found")
    payload = data.model_dump()
    payload["video_url"] = safe_video_url(payload["video_url"])
    episode = Episode(anime_id=anime_id, **payload)
    db.add(episode); db.commit(); db.refresh(episode)
    return {"id": episode.id, "anime_id": episode.anime_id, "episode_number": episode.episode_number, "title": episode.title, "video_url": episode.video_url, "video_type": episode.video_type, "duration_seconds": episode.duration_seconds, "is_published": episode.is_published}

@app.delete("/api/admin/episodes/{episode_id}")
def admin_delete_episode(episode_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    episode = db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(404, "Episode not found")
    db.delete(episode); db.commit(); return {"ok": True}

@app.get("/api/admin/news")
def admin_list_news(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return [news_out(n) | {"is_published": n.is_published, "source_url": n.source_url}
            for n in db.scalars(select(News).order_by(News.created_at.desc())).all()]

@app.post("/api/admin/news", status_code=201)
def admin_create_news(data: NewsIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    n = News(**data.model_dump()); db.add(n); db.commit(); db.refresh(n); return news_out(n)

@app.delete("/api/admin/news/{news_id}")
def admin_delete_news(news_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    n = db.get(News, news_id)
    if not n: raise HTTPException(404, "News not found")
    db.delete(n); db.commit(); return {"ok": True}

@app.get("/api/admin/users")
def admin_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return [{"id": u.id, "email": u.email, "username": u.username, "role": u.role,
             "is_active": u.is_active, "created_at": u.created_at.isoformat() if u.created_at else None}
            for u in db.scalars(select(User).order_by(User.created_at.desc()).limit(500)).all()]

@app.put("/api/admin/users/{user_id}/status")
def admin_user_status(user_id: int, active: bool, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    target = db.get(User, user_id)
    if not target: raise HTTPException(404, "User not found")
    if target.id == admin.id and not active: raise HTTPException(400, "You cannot disable your own account")
    target.is_active = active; db.commit()
    return {"ok": True, "is_active": target.is_active}
