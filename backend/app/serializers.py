from .models import Anime, News, Review, Progress

def anime_out(a: Anime):
    return {"id": a.id, "title": a.title, "synopsis": a.synopsis, "image_url": a.image_url,
            "genres": [g.strip() for g in a.genres.split(",") if g.strip()], "year": a.year,
            "status": a.status, "video_url": a.video_url, "video_type": a.video_type,
            "is_published": a.is_published, "external_mal_id": a.external_mal_id}

def news_out(n: News):
    return {"id": n.id, "title": n.title, "excerpt": n.excerpt, "image_url": n.image_url,
            "source_url": n.source_url, "created_at": n.created_at.isoformat() if n.created_at else None}

def review_out(r: Review):
    return {"id": r.id, "anime_id": r.anime_id, "username": r.username, "rating": r.rating,
            "body": r.body, "created_at": r.created_at.isoformat() if r.created_at else None}

def progress_out(p: Progress):
    return {"anime_id": p.anime_id, "position_seconds": p.position_seconds,
            "duration_seconds": p.duration_seconds, "updated_at": p.updated_at.isoformat() if p.updated_at else None}
