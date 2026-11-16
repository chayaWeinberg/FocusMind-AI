"""ReplayAI, Smart Timer preferences, FocusInsights, FocusCoach, AdaptiveStudy,
QuizFlow, catalog administration and privacy endpoints.

All endpoints require a signed-in user; every query is scoped to that user.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Query, Response, status

from app.api.dependencies import CurrentUser, Database
from app.schemas.courses import CourseDetail
from app.schemas.learning import (
    AttemptIn,
    AttemptOut,
    BookmarkCreate,
    CatalogAdminCourse,
    CatalogCourseCreate,
    CoachTip,
    CourseLearningSummary,
    DeletionResult,
    GoalIn,
    GoalOut,
    InsightsOut,
    LessonQuizOut,
    LessonReplayOut,
    PlanOut,
    Preferences,
    PrivacySummary,
    QuestionCreate,
    QuestionOut,
    ReplayItemOut,
    ReplayStatusUpdate,
)
from app.services.courses import CourseService
from app.services.insights import CoachService, InsightsService, PreferencesService, StudyService
from app.services.privacy import PrivacyService
from app.services.quiz import QuizService
from app.services.replay import ReplayService, rules_payload

router = APIRouter(prefix="/api", tags=["learning"])

TzOffset = Annotated[int, Query(alias="tzOffsetMinutes", ge=-14 * 60, le=14 * 60)]


# --- ReplayAI -----------------------------------------------------------------


@router.get("/lessons/{lesson_id}/replay", response_model=LessonReplayOut)
async def lesson_replay(lesson_id: str, database: Database, user: CurrentUser) -> LessonReplayOut:
    return await ReplayService(database, user).for_lesson(lesson_id)


@router.post("/lessons/{lesson_id}/bookmarks", response_model=ReplayItemOut, status_code=status.HTTP_201_CREATED)
async def add_bookmark(lesson_id: str, data: BookmarkCreate, database: Database, user: CurrentUser) -> ReplayItemOut:
    return await ReplayService(database, user).add_bookmark(lesson_id, data)


@router.get("/replay", response_model=list[ReplayItemOut])
async def replay_overview(
    database: Database,
    user: CurrentUser,
    status_filter: Annotated[Literal["pending", "new", "reviewed", "dismissed", "all"], Query(alias="status")] = "all",
    course_id: Annotated[str | None, Query(alias="courseId", max_length=40)] = None,
    kind: Annotated[Literal["auto", "bookmark"] | None, Query()] = None,
) -> list[ReplayItemOut]:
    return await ReplayService(database, user).overview(status_filter, course_id, kind)


@router.get("/replay/rules")
async def replay_rules(user: CurrentUser) -> dict[str, float]:
    return rules_payload()


@router.patch("/replay/{item_id}", response_model=ReplayItemOut)
async def update_replay_item(item_id: str, data: ReplayStatusUpdate, database: Database, user: CurrentUser) -> ReplayItemOut:
    return await ReplayService(database, user).set_status(item_id, data.status)


@router.delete("/replay/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bookmark(item_id: str, database: Database, user: CurrentUser) -> Response:
    await ReplayService(database, user).delete_bookmark(item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Smart Timer preferences ---------------------------------------------------


@router.get("/me/preferences", response_model=Preferences)
async def get_preferences(database: Database, user: CurrentUser) -> Preferences:
    return await PreferencesService(database, user).get()


@router.put("/me/preferences", response_model=Preferences)
async def save_preferences(data: Preferences, database: Database, user: CurrentUser) -> Preferences:
    return await PreferencesService(database, user).save(data)


# --- FocusInsights & FocusCoach ------------------------------------------------


@router.get("/insights", response_model=InsightsOut)
async def insights(
    database: Database,
    user: CurrentUser,
    tz_offset: TzOffset = 0,
    days: Annotated[int, Query(ge=7, le=60)] = 14,
) -> InsightsOut:
    return await InsightsService(database, user).build(tz_offset, days)


@router.get("/coach", response_model=list[CoachTip])
async def coach(database: Database, user: CurrentUser, tz_offset: TzOffset = 0) -> list[CoachTip]:
    return await CoachService(database, user).tips(tz_offset)


# --- AdaptiveStudy -------------------------------------------------------------


@router.get("/study/goal", response_model=GoalOut | None)
async def get_goal(database: Database, user: CurrentUser) -> GoalOut | None:
    return await StudyService(database, user).get_goal()


@router.put("/study/goal", response_model=GoalOut)
async def save_goal(data: GoalIn, database: Database, user: CurrentUser) -> GoalOut:
    return await StudyService(database, user).save_goal(data)


@router.delete("/study/goal", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(database: Database, user: CurrentUser) -> Response:
    await StudyService(database, user).delete_goal()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/study/plan", response_model=PlanOut)
async def study_plan(database: Database, user: CurrentUser, tz_offset: TzOffset = 0) -> PlanOut:
    return await StudyService(database, user).plan(tz_offset)


# --- QuizFlow ------------------------------------------------------------------


@router.get("/lessons/{lesson_id}/quiz", response_model=LessonQuizOut)
async def lesson_quiz(lesson_id: str, database: Database, user: CurrentUser) -> LessonQuizOut:
    return await QuizService(database, user).lesson_quiz(lesson_id)


@router.post("/lessons/{lesson_id}/quiz/questions", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def add_question(lesson_id: str, data: QuestionCreate, database: Database, user: CurrentUser) -> QuestionOut:
    return await QuizService(database, user).add_question(lesson_id, data)


@router.delete("/quiz/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(question_id: str, database: Database, user: CurrentUser) -> Response:
    await QuizService(database, user).delete_question(question_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/lessons/{lesson_id}/quiz/attempts", response_model=AttemptOut, status_code=status.HTTP_201_CREATED)
async def submit_attempt(lesson_id: str, data: AttemptIn, database: Database, user: CurrentUser) -> AttemptOut:
    return await QuizService(database, user).submit(lesson_id, data)


@router.get("/lessons/{lesson_id}/quiz/attempts", response_model=list[AttemptOut])
async def attempt_history(
    lesson_id: str, database: Database, user: CurrentUser, limit: Annotated[int, Query(ge=1, le=50)] = 10
) -> list[AttemptOut]:
    return await QuizService(database, user).history(lesson_id, limit)


@router.get("/courses/{course_id}/learning-summary", response_model=CourseLearningSummary)
async def course_learning_summary(course_id: str, database: Database, user: CurrentUser) -> CourseLearningSummary:
    return await QuizService(database, user).course_summary(course_id)


# --- catalog administration (content managers only) ----------------------------


@router.get("/admin/catalog", response_model=list[CatalogAdminCourse])
async def admin_catalog(database: Database, user: CurrentUser) -> list[dict]:
    return await CourseService(database, user).admin_catalog()


@router.post("/admin/catalog", response_model=CourseDetail, status_code=status.HTTP_201_CREATED)
async def create_catalog_course(data: CatalogCourseCreate, database: Database, user: CurrentUser) -> CourseDetail:
    return await CourseService(database, user).create_catalog_course(data.title, data.description, data.category, data.status)


# --- privacy -------------------------------------------------------------------


@router.get("/privacy/summary", response_model=PrivacySummary)
async def privacy_summary(database: Database, user: CurrentUser) -> PrivacySummary:
    return await PrivacyService(database, user).summary()


@router.delete("/privacy/learning-data", response_model=DeletionResult)
async def delete_learning_data(
    database: Database,
    user: CurrentUser,
    older_than_days: Annotated[int | None, Query(alias="olderThanDays", ge=1, le=3650)] = None,
    include_bookmarks: Annotated[bool, Query(alias="includeBookmarks")] = False,
    include_quiz_attempts: Annotated[bool, Query(alias="includeQuizAttempts")] = False,
) -> DeletionResult:
    return await PrivacyService(database, user).delete(older_than_days, include_bookmarks, include_quiz_attempts)
