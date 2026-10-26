import asyncio
import jwt
from jwt import PyJWTError
import redis.asyncio as aioredis
from fastapi import WebSocket, WebSocketDisconnect
from .config import settings

ALGO = "HS256"

async def listen_pubsub(ws: WebSocket, pubsub):
    # Слушаем события из Redis и отправляем в браузер
    async for msg in pubsub.listen():
        if msg["type"] == "message":
            await ws.send_text(msg["data"])

async def listen_client(ws: WebSocket):
    # Держим соединение открытым, пока клиент не закроет вкладку
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass

async def websocket_endpoint(ws: WebSocket, token: str):
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGO])
        user_id = int(payload["sub"])
    except (PyJWTError, KeyError, ValueError):
        await ws.close(code=1008)  # Невалидный токен
        return

    await ws.accept()
    
    # Подключаемся к Redis и подписываемся на канал конкретного пользователя
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.subscribe(f"user:{user_id}:events")

    pub_task = asyncio.create_task(listen_pubsub(ws, pubsub))
    cli_task = asyncio.create_task(listen_client(ws))

    try:
        await asyncio.wait([pub_task, cli_task], return_when=asyncio.FIRST_COMPLETED)
    finally:
        pub_task.cancel()
        cli_task.cancel()
        await pubsub.unsubscribe(f"user:{user_id}:events")
        await pubsub.aclose()
        await r.aclose()