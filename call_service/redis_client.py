import json
from redis.asyncio import Redis
from .config import settings

r: Redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)

async def publish_event(user_id: int, event: dict) -> None:
    try:
        await r.publish(f"user:{user_id}:events", json.dumps(event))
    except Exception:
        pass

async def invalidate_history(user_id: int) -> None:
    try:
        await r.delete(f"history:{user_id}")
    except Exception:
        pass