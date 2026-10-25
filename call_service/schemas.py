from datetime import datetime
from pydantic import BaseModel

class CallCreate(BaseModel):
    caller_id: int
    callee_id: int

class CallOut(BaseModel):
    id: int
    caller_id: int
    callee_id: int
    status: str
    created_at: datetime
    answered_at: datetime | None
    model_config = {"from_attributes": True}

class AnswerIn(BaseModel):
    accepted: bool