from fastapi import Header, HTTPException
import jwt
from jwt.exceptions import PyJWTError as JWTError
from .config import settings

ALGO = "HS256"

def _decode(authorization: str | None) -> dict:
    if not authorization:
        raise HTTPException(401, "Not authenticated")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGO])
    except JWTError:
        raise HTTPException(401, "Invalid token")

def current_user(authorization: str | None = Header(default=None)) -> dict:
    payload = _decode(authorization)
    payload["_token"] = authorization.removeprefix("Bearer ").strip()
    return payload

def require_admin(authorization: str | None = Header(default=None)) -> dict:
    payload = _decode(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(403, "Admin required")
    payload["_token"] = authorization.removeprefix("Bearer ").strip()
    return payload