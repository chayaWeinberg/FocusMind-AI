from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.models.user import UserDocument


class UserRepository:
    def __init__(self, database: AsyncDatabase) -> None:
        self._users = database["users"]

    async def create_user(self, user: UserDocument) -> ObjectId:
        result = await self._users.insert_one(user)
        return result.inserted_id

    async def find_by_email(self, email: str) -> UserDocument | None:
        return await self._users.find_one({"email": email})

    async def find_by_id(self, user_id: str) -> UserDocument | None:
        if not ObjectId.is_valid(user_id):
            return None
        return await self._users.find_one({"_id": ObjectId(user_id)})
