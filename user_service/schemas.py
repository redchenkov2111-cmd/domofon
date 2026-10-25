from datetime import datetime
from pydantic import BaseModel, Field

class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    apartment_number: str = Field(pattern=r"^\d{1,5}$")
    phone: str = Field(pattern=r"^\+?\d{10,15}$")
    password: str = Field(min_length=4)
    role: str = Field(default="resident", pattern=r"^(admin|resident)$")

class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    apartment_number: str | None = Field(default=None, pattern=r"^\d{1,5}$")
    phone: str | None = Field(default=None, pattern=r"^\+?\d{10,15}$")
    password: str | None = Field(default=None, min_length=4)

class UserOut(BaseModel):
    id: int
    name: str
    apartment_number: str
    phone: str
    role: str
    created_at: datetime
    model_config = {"from_attributes": True}

class LoginIn(BaseModel):
    phone: str
    password: str

class TokenOut(BaseModel):
    token: str
    user: UserOut