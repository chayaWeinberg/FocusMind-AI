from datetime import datetime
from typing import NotRequired, TypedDict

from bson import ObjectId


class UserDocument(TypedDict):
    _id: NotRequired[ObjectId]
    display_name: str
    email: str
    hashed_password: str
    created_at: datetime
