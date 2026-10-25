import httpx
from fastapi import FastAPI, Depends, HTTPException, Header, Response

from .config import settings
from .auth import current_user, require_admin

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

app = FastAPI(title="API Gateway")

USER = settings.USER_SERVICE_URL


async def _forward(method: str, url: str, **kwargs):
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.request(method, url, **kwargs)
    if r.status_code >= 400:
        try:
            detail = r.json().get("detail", r.text)
        except Exception:
            detail = r.text
        raise HTTPException(r.status_code, detail)
    if r.status_code == 204:
        return Response(status_code=204)
    return r.json()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "api_gateway"}


@app.post("/api/auth/login")
async def login(payload: dict):
    return await _forward("POST", f"{USER}/auth/login", json=payload)


@app.get("/api/users")
async def list_users(_=Depends(current_user)):
    return await _forward("GET", f"{USER}/users")


@app.get("/api/users/{user_id}")
async def get_user(user_id: int, _=Depends(current_user)):
    return await _forward("GET", f"{USER}/users/{user_id}")


@app.post("/api/users", status_code=201)
async def create_user(
    payload: dict,
    authorization: str = Header(...),
    _=Depends(require_admin),
):
    return await _forward(
        "POST", f"{USER}/users",
        headers={"Authorization": authorization},
        json=payload,
    )


@app.delete("/api/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    authorization: str = Header(...),
    _=Depends(require_admin),
):
    return await _forward(
        "DELETE", f"{USER}/users/{user_id}",
        headers={"Authorization": authorization},
    )

@app.post("/api/calls")
async def make_call(payload: dict, user=Depends(current_user)):
    caller_id = int(user["sub"])
    callee_id = payload.get("callee_id")
    if not isinstance(callee_id, int):
        raise HTTPException(400, "callee_id required")
    return await _forward(
        "POST",
        f"{settings.CALL_PROVIDER_URL}/calls",
        json={"caller_id": caller_id, "callee_id": callee_id},
    )


@app.post("/api/calls/{call_id}/answer")
async def answer_call(call_id: int, payload: dict, _=Depends(current_user)):
    return await _forward(
        "POST",
        f"{settings.CALL_SERVICE_URL}/calls/{call_id}/answer",
        json=payload,
    )


@app.get("/api/calls/history")
async def call_history(user=Depends(current_user)):
    user_id = int(user["sub"])
    return await _forward("GET", f"{settings.CALL_SERVICE_URL}/calls/history/{user_id}")

# --- Статика frontend ---
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

if FRONTEND_DIR.exists():
    @app.get("/")
    async def index():
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/{filename}.html")
    async def html(filename: str):
        file = FRONTEND_DIR / f"{filename}.html"
        if file.exists():
            return FileResponse(file)
        raise HTTPException(404, "Page not found")

    # Отдаём style.css прямо из корня frontend
    @app.get("/style.css")
    async def css():
        return FileResponse(FRONTEND_DIR / "style.css")

    # JS лежат в папке js (это совпадает с твоей структурой)
    app.mount("/js", StaticFiles(directory=FRONTEND_DIR / "js"), name="js")