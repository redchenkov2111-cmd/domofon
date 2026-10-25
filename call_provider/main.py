import httpx
from fastapi import FastAPI, HTTPException

from .config import settings
from .schemas import MakeCallIn

app = FastAPI(title="Call Provider (Facade)")


async def log_event(level: str, message: str, extra: dict | None = None) -> None:
    if not settings.LOGGING_SERVICE_URL:
        return
    try:
        async with httpx.AsyncClient(timeout=2) as c:
            await c.post(
                f"{settings.LOGGING_SERVICE_URL}/log",
                json={"level": level, "service": "call_provider",
                      "message": message, "extra": extra or {}},
            )
    except Exception:
        pass


@app.get("/health")
async def health():
    return {"status": "ok", "service": "call_provider"}


@app.post("/calls")
async def make_call(data: MakeCallIn):
    """
    Facade: скрывает от клиента, что для одного звонка нужны
    три HTTP-вызова к двум разным микросервисам.
    """
    if data.caller_id == data.callee_id:
        raise HTTPException(400, "Cannot call yourself")

    async with httpx.AsyncClient(timeout=5) as client:
        # 1. Проверяем, что вызывающий существует
        r = await client.get(f"{settings.USER_SERVICE_URL}/users/{data.caller_id}")
        if r.status_code != 200:
            raise HTTPException(404, "Caller not found")
        caller = r.json()

        # 2. Проверяем, что вызываемый существует
        r = await client.get(f"{settings.USER_SERVICE_URL}/users/{data.callee_id}")
        if r.status_code != 200:
            raise HTTPException(404, "Callee not found")
        callee = r.json()

        # 3. Проверяем, что вызываемый не занят
        r = await client.get(f"{settings.CALL_SERVICE_URL}/calls/active/{data.callee_id}")
        if r.status_code == 200 and r.json() is not None:
            raise HTTPException(409, "Callee is busy")

        # 4. Поручить Call Service создать звонок
        r = await client.post(
            f"{settings.CALL_SERVICE_URL}/calls",
            json={"caller_id": data.caller_id, "callee_id": data.callee_id},
        )
        if r.status_code >= 400:
            try:
                detail = r.json().get("detail", r.text)
            except Exception:
                detail = r.text
            raise HTTPException(r.status_code, detail)
        call = r.json()

    await log_event(
        "info",
        "call_routed_via_facade",
        {"call_id": call["id"], "caller": caller["name"], "callee": callee["name"]},
    )
    return call