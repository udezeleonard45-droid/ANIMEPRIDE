import sys
from sqlalchemy import select
from .database import SessionLocal
from .models import User

def main():
    if len(sys.argv) != 2:
        print("Usage: python -m app.make_admin email@example.com")
        raise SystemExit(2)
    email = sys.argv[1].lower()
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            print("No account found for that email. Register first.")
            raise SystemExit(1)
        user.role = "admin"
        db.commit()
        print(f"Admin role granted to {user.username} ({user.email}). Sign out and back in.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
