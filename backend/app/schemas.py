from pydantic import BaseModel, EmailStr, Field, ConfigDict, HttpUrl
from typing import Optional

class RegisterIn(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=10, max_length=128)

class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class UserOut(BaseModel):
    id: int
    email: EmailStr
    username: str
    role: str
    model_config = ConfigDict(from_attributes=True)

class AnimeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    synopsis: str = Field(default="", max_length=12000)
    image_url: str = Field(default="", max_length=1000)
    genres: str = Field(default="", max_length=500)
    year: Optional[int] = None
    status: str = Field(default="Unknown", max_length=40)
    video_url: str = Field(default="", max_length=1000)
    video_type: str = Field(default="mp4", pattern="^(mp4|hls)$")
    is_published: bool = True


class EpisodeCreate(BaseModel):
    episode_number: int = Field(ge=1, le=10000)
    title: str = Field(default="", max_length=240)
    video_url: str = Field(min_length=1, max_length=1000)
    video_type: str = Field(default="mp4", pattern="^(mp4|hls)$")
    duration_seconds: int = Field(default=0, ge=0, le=864000)
    is_published: bool = True

class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=10)
    body: str = Field(default="", max_length=2000)

class ProgressIn(BaseModel):
    position_seconds: int = Field(ge=0, le=864000)
    duration_seconds: int = Field(default=0, ge=0, le=864000)

class NewsIn(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    excerpt: str = Field(default="", max_length=1000)
    image_url: str = Field(default="", max_length=1000)
    source_url: str = Field(default="", max_length=1000)
    is_published: bool = True
