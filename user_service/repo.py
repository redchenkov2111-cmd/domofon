from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import User
from .schemas import UserCreate, UserUpdate
from .security import hash_password

class UserRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, user_id: int) -> User | None:
        return await self.db.get(User, user_id)

    async def by_phone(self, phone: str) -> User | None:
        result = await self.db.execute(select(User).where(User.phone == phone))
        return result.scalar_one_or_none()

    async def list(self) -> list[User]:
        result = await self.db.execute(select(User).order_by(User.id))
        return list(result.scalars().all())

    async def create(self, data: UserCreate) -> User:
        user = User(
            name=data.name,
            apartment_number=data.apartment_number,
            phone=data.phone,
            password_hash=hash_password(data.password),
            role=data.role,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update(self, user: User, data: UserUpdate) -> User:
        if data.name is not None:
            user.name = data.name
        if data.apartment_number is not None:
            user.apartment_number = data.apartment_number
        if data.phone is not None:
            user.phone = data.phone
        if data.password is not None:
            user.password_hash = hash_password(data.password)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def delete(self, user: User) -> None:
        await self.db.delete(user)
        await self.db.commit()