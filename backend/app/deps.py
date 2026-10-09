from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from .database import get_db
from .models import User
from .security import decode_token

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get("animepride_session")
    if not token:
        raise HTTPException(status_code=401, detail="Sign in required")
    user_id = decode_token(token)
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account is unavailable")
    return user

def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user
