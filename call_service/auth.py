import jwt
from jwt import InvalidTokenError as PyJWTError
from fastapi import Header, HTTPException
from .config import settings

ALGO = "HS256"

def current_user(authorization: str = Header(...)) -> dict:
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGO])
        payload["_token"] = token
        return payload
    except PyJWTError:
        raise HTTPException(401, "Invalid token")