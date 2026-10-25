from pydantic import BaseModel, Field

class MakeCallIn(BaseModel):
    caller_id: int = Field(gt=0)
    callee_id: int = Field(gt=0)