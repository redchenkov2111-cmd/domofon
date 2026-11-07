import json
from datetime import datetime
from typing import Any
from fastapi import FastAPI, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from .db import get_session

app = FastAPI(title="Logging Service")


class LogIn(BaseModel):
    level: str = "info"
    service: str
    message: str
    extra: dict[str, Any] | None = None


class LogOut(BaseModel):
    id: int
    level: str
    service: str
    message: str
    extra: dict | None
    created_at: datetime


@app.get("/health")
async def health():
    return {"status": "ok", "service": "logging_service"}


@app.post("/log", status_code=202)
async def write_log(data: LogIn, db: AsyncSession = Depends(get_session)):
    await db.execute(
        text(
            "INSERT INTO logs (level, service, message, extra) "
            "VALUES (:l, :s, :m, CAST(:e AS jsonb))"
        ),
        {
            "l": data.level,
            "s": data.service,
            "m": data.message,
            "e": None if data.extra is None else json.dumps(data.extra),
        },
    )
    await db.commit()
    print(f"[{data.level}] {data.service}: {data.message}", flush=True)
    return {"ok": True}


@app.get("/logs", response_model=list[LogOut])
async def list_logs(
    service: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_session),
):
    q = "SELECT id, level, service, message, extra, created_at FROM logs "
    params: dict[str, Any] = {"n": limit}
    if service:
        q += "WHERE service = :s "
        params["s"] = service
    q += "ORDER BY id DESC LIMIT :n"
    rows = (await db.execute(text(q), params)).mappings().all()
    return [dict(r) for r in rows]