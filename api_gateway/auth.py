from fastapi import Header, HTTPException
from jose import jwt, JWTError
from .config import settings

ALGO = "HS256"

def _decode(authorization: str) -> dict:
    token = authorization.removeprefix("Bearer ").strip()
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGO])
    except JWTError:
        raise HTTPException(401, "Invalid token")

def current_user(authorization: str = Header(...)) -> dict:
    return _decode(authorization)

def require_admin(authorization: str = Header(...)) -> dict:
    payload = _decode(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(403, "Admin required")
    return payload