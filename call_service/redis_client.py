import json
import redis.asyncio as aioredis
from .config import settings

r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

async def publish_event(user_id: int, event: dict) -> None:
    """Публикует событие в канал пользователя. Пока никто не слушает — безопасно."""
    await r.publish(f"user:{user_id}:events", json.dumps(event))

async def invalidate_history(user_id: int) -> None:
    """Сбрасывает кэш истории пользователя (после нового звонка история устарела)."""
    await r.delete(f"history:{user_id}")