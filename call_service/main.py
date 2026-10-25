import json
import httpx
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .db import get_session
from .schemas import CallCreate, CallOut, AnswerIn
from .repo import CallRepo
from .redis_client import r, publish_event, invalidate_history

app = FastAPI(title="Call Service")


async def log_event(level: str, message: str, extra: dict | None = None) -> None:
    if not settings.LOGGING_SERVICE_URL:
        return
    try:
        async with httpx.AsyncClient(timeout=2) as c:
            await c.post(
                f"{settings.LOGGING_SERVICE_URL}/log",
                json={
                    "level": level,
                    "service": "call_service",
                    "message": message,
                    "extra": extra or {},
                },
            )
    except Exception:
        pass


@app.get("/health")
async def health():
    return {"status": "ok", "service": "call_service"}


@app.post("/calls", response_model=CallOut)
async def create_call(data: CallCreate, db: AsyncSession = Depends(get_session)):
    if data.caller_id == data.callee_id:
        raise HTTPException(400, "Cannot call yourself")

    if await CallRepo(db).active_for(data.callee_id):
        raise HTTPException(409, "Callee is busy")

    call = await CallRepo(db).create(data.caller_id, data.callee_id)

    await publish_event(data.callee_id, {
        "event": "incoming_call",
        "call_id": call.id,
        "from": data.caller_id,
        "created_at": call.created_at.isoformat(),
    })

    await invalidate_history(data.caller_id)
    await invalidate_history(data.callee_id)
    await log_event("info", "call_created", {"call_id": call.id})
    return call


@app.post("/calls/{call_id}/answer", response_model=CallOut)
async def answer_call(
    call_id: int,
    data: AnswerIn,
    db: AsyncSession = Depends(get_session),
):
    call = await CallRepo(db).get(call_id)
    if not call:
        raise HTTPException(404, "Call not found")
    if call.status != "ringing":
        raise HTTPException(409, "Call already answered")

    status = "accepted" if data.accepted else "rejected"
    call = await CallRepo(db).set_status(call, status)

    payload = {
        "event": "call_answered",
        "call_id": call.id,
        "status": status,
        "answered_at": call.answered_at.isoformat() if call.answered_at else None,
    }
    await publish_event(call.caller_id, payload)
    await publish_event(call.callee_id, payload)
    await invalidate_history(call.caller_id)
    await invalidate_history(call.callee_id)
    return call


@app.get("/calls/active/{user_id}", response_model=CallOut | None)
async def active_call(user_id: int, db: AsyncSession = Depends(get_session)):
    return await CallRepo(db).active_for(user_id)


@app.get("/calls/history/{user_id}", response_model=list[CallOut])
async def history(user_id: int, db: AsyncSession = Depends(get_session)):
    cache_key = f"history:{user_id}"

    try:
        cached = await r.get(cache_key)
        if cached:
            return [CallOut.model_validate(x) for x in json.loads(cached)]
    except Exception:
        pass

    calls = await CallRepo(db).history(user_id)

    try:
        payload = [CallOut.model_validate(c).model_dump(mode="json") for c in calls]
        await r.setex(cache_key, 30, json.dumps(payload))
    except Exception:
        pass

    return calls