"""Learning sessions and attention segments (owner-only, ReplayAI-ready)."""

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser, Database
from app.schemas.courses import SegmentBatch, SessionCreate, SessionDetail, SessionEnd, SessionOut
from app.services.learning_sessions import LearningSessionService

router = APIRouter(prefix="/api/learning-sessions", tags=["learning sessions"])


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def start_session(data: SessionCreate, database: Database, user: CurrentUser) -> SessionOut:
    return await LearningSessionService(database, user).start(data.lesson_id)


@router.post("/{session_id}/segments")
async def add_segments(
    session_id: str, batch: SegmentBatch, database: Database, user: CurrentUser
) -> dict[str, int]:
    accepted = await LearningSessionService(database, user).add_segments(session_id, batch)
    return {"accepted": accepted}


@router.post("/{session_id}/end", response_model=SessionOut)
async def end_session(session_id: str, data: SessionEnd, database: Database, user: CurrentUser) -> SessionOut:
    return await LearningSessionService(database, user).end(session_id, data.active_ms)


@router.get("/{session_id}", response_model=SessionDetail)
async def session_detail(session_id: str, database: Database, user: CurrentUser) -> SessionDetail:
    return await LearningSessionService(database, user).detail(session_id)
