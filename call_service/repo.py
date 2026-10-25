from datetime import datetime, timezone
from sqlalchemy import select, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Call

class CallRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, call_id: int) -> Call | None:
        return await self.db.get(Call, call_id)

    async def create(self, caller_id: int, callee_id: int) -> Call:
        call = Call(caller_id=caller_id, callee_id=callee_id, status="ringing")
        self.db.add(call)
        await self.db.commit()
        await self.db.refresh(call)
        return call

    async def set_status(self, call: Call, status: str) -> Call:
        call.status = status
        if status in ("accepted", "rejected"):
            call.answered_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(call)
        return call

    async def history(self, user_id: int, limit: int = 50) -> list[Call]:
        result = await self.db.execute(
            select(Call)
            .where(or_(Call.caller_id == user_id, Call.callee_id == user_id))
            .order_by(desc(Call.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def active_for(self, user_id: int) -> Call | None:
        result = await self.db.execute(
            select(Call)
            .where(Call.callee_id == user_id, Call.status == "ringing")
            .order_by(desc(Call.created_at))
            .limit(1)
        )
        return result.scalar_one_or_none()