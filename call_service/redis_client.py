import json
import redis.asyncio as aioredis
from .config import settings

# ОБЯЗАТЕЛЬНО должны быть таймауты
r = aioredis.from_url(
    settings.REDIS_URL, 
    decode_responses=True, 
    socket_connect_timeout=2, 
    socket_timeout=2
)

async def publish_event(user_id: int, event: dict) -> None:
    try:
        await r.publish(f"user:{user_id}:events", json.dumps(event))
    except Exception as e:
        print(f"Redis publish error: {e}", flush=True)

async def invalidate_history(user_id: int) -> None:
    try:
        await r.delete(f"history:{user_id}")
    except Exception as e:
        print(f"Redis invalidate error: {e}", flush=True)