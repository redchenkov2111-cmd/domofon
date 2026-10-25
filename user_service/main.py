import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
import jwt
from jwt.exceptions import PyJWTError as JWTError

from .config import settings
from .db import get_session, SessionLocal
from .schemas import UserCreate, UserUpdate, UserOut, LoginIn, TokenOut
from .repo import UserRepo
from .security import verify_password, create_token, ALGO


async def log_event(level: str, message: str, extra: dict | None = None) -> None:
    if not settings.LOGGING_SERVICE_URL:
        return
    try:
        async with httpx.AsyncClient(timeout=2) as c:
            await c.post(
                f"{settings.LOGGING_SERVICE_URL}/log",
                json={
                    "level": level,
                    "service": "user_service",
                    "message": message,
                    "extra": extra or {},
                },
            )
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with SessionLocal() as db:
        repo = UserRepo(db)
        if not await repo.list():
            await repo.create(UserCreate(
                name="Администратор",
                apartment_number="1",
                phone="+70000000000",
                password="admin123",
                role="admin",
            ))
            print("Seeded admin user: +70000000000 / admin123")
    yield


app = FastAPI(title="User Service", lifespan=lifespan)


def require_admin(authorization: str = Header(...)):
    try:
        token = authorization.removeprefix("Bearer ").strip()
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGO])
        if payload.get("role") != "admin":
            raise HTTPException(403, "Admin required")
        return payload
    except JWTError:
        raise HTTPException(401, "Invalid token")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "user_service"}


@app.post("/auth/login", response_model=TokenOut)
async def login(data: LoginIn, db: AsyncSession = Depends(get_session)):
    user = await UserRepo(db).by_phone(data.phone)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    await log_event("info", "user_login", {"user_id": user.id})
    return TokenOut(
        token=create_token(user.id, user.role),
        user=UserOut.model_validate(user),
    )


@app.get("/users", response_model=list[UserOut])
async def list_users(db: AsyncSession = Depends(get_session)):
    return await UserRepo(db).list()


@app.get("/users/{user_id}", response_model=UserOut)
async def get_user(user_id: int, db: AsyncSession = Depends(get_session)):
    user = await UserRepo(db).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


@app.post("/users", response_model=UserOut, status_code=201)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
):
    repo = UserRepo(db)
    if await repo.by_phone(data.phone):
        raise HTTPException(409, "Phone already exists")
    user = await repo.create(data)
    await log_event("info", "user_created", {"id": user.id, "name": user.name})
    return user


@app.put("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    data: UserUpdate,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
):
    repo = UserRepo(db)
    user = await repo.get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    updated = await repo.update(user, data)
    await log_event("info", "user_updated", {"id": user_id})
    return updated


@app.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
):
    repo = UserRepo(db)
    user = await repo.get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    await repo.delete(user)
    await log_event("info", "user_deleted", {"id": user_id})