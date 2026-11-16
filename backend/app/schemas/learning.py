"""Schemas for ReplayAI, Smart Timer, FocusInsights, FocusCoach,
AdaptiveStudy, QuizFlow, catalog administration and privacy controls.
JSON uses camelCase, like the rest of the API."""

from datetime import date, datetime
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.schemas.courses import ApiModel, CourseOut, RequestModel, _strip

ReplayStatus = Literal["new", "reviewed", "dismissed"]


# --- ReplayAI ------------------------------------------------------------------


class ReplayStatusUpdate(RequestModel):
    status: ReplayStatus


class BookmarkCreate(RequestModel):
    start_seconds: float = Field(ge=0, le=24 * 3600)
    end_seconds: float | None = Field(default=None, gt=0, le=24 * 3600)
    note: str = Field(default="", max_length=300)

    @field_validator("note", mode="before")
    @classmethod
    def _trim(cls, value: object) -> object:
        return _strip(value)

    @model_validator(mode="after")
    def ordered(self) -> "BookmarkCreate":
        if self.end_seconds is not None and self.end_seconds <= self.start_seconds:
            raise ValueError("endSeconds must be after startSeconds.")
        return self


class ReplayItemOut(ApiModel):
    id: str
    lesson_id: str
    course_id: str
    kind: Literal["auto", "bookmark"]
    start_seconds: float
    end_seconds: float | None
    status: ReplayStatus
    reasons: dict[str, int]
    event_count: int
    session_count: int
    off_screen_seconds: float
    face_absent_seconds: float
    note: str
    reopened: bool  # new evidence arrived after it was marked reviewed
    created_at: datetime
    updated_at: datetime
    reviewed_at: datetime | None
    lesson_title: str | None = None
    course_title: str | None = None


class LessonReplayOut(ApiModel):
    lesson_id: str
    trackable: bool
    duration_seconds: float | None
    analyzed_segments: int
    items: list[ReplayItemOut]
    rules: dict[str, float]


# --- Smart Timer ---------------------------------------------------------------


class SessionHeartbeat(RequestModel):
    active_ms: int = Field(ge=0, le=24 * 3600 * 1000)
    break_ms: int = Field(default=0, ge=0, le=24 * 3600 * 1000)


class SessionHistoryItem(ApiModel):
    id: str
    lesson_id: str
    course_id: str
    lesson_title: str
    course_title: str
    started_at: datetime
    ended_at: datetime | None
    last_seen_at: datetime | None
    active_ms: int
    break_ms: int
    video_seconds: float
    segment_count: int
    trackable: bool
    status: Literal["active", "ended", "interrupted"]


class Preferences(RequestModel):
    study_minutes: int = Field(default=25, ge=5, le=180)
    break_minutes: int = Field(default=5, ge=1, le=60)
    break_reminders: bool = True


# --- FocusInsights -------------------------------------------------------------


class DayValue(ApiModel):
    date: str
    active_ms: int


class WeekValue(ApiModel):
    week_start: str
    active_ms: int
    on_screen_ms: int
    measured_ms: int


class CourseTime(ApiModel):
    course_id: str
    title: str
    type: str
    active_ms: int
    completed_lessons: int
    total_lessons: int
    percent: int


class InsightsTotals(ApiModel):
    active_ms: int
    break_ms: int
    video_seconds: float
    session_count: int
    lessons_completed: int
    lessons_completed_this_week: int
    active_ms_today: int
    active_ms_this_week: int


class ReplayCounts(ApiModel):
    suggested: int
    pending: int
    reviewed: int
    dismissed: int
    bookmarks: int
    bookmarks_pending: int


class QuizStats(ApiModel):
    attempts: int
    average_percent: int | None


class Streak(ApiModel):
    current: int
    longest: int
    active_today: bool


class InsightsOut(ApiModel):
    totals: InsightsTotals
    daily: list[DayValue]
    weekly: list[WeekValue]
    by_course: list[CourseTime]
    attention: dict[str, int]
    replay: ReplayCounts
    quizzes: QuizStats
    streak: Streak
    recent_sessions: list[SessionHistoryItem]


# --- FocusCoach ----------------------------------------------------------------


class CoachTip(ApiModel):
    kind: Literal[
        "take_break", "review_before_next", "review_flagged", "continue_lesson",
        "return_to_bookmark", "retry_quiz", "goal_behind", "resume_course", "start_learning",
    ]
    priority: int
    lesson_id: str | None = None
    course_id: str | None = None
    lesson_title: str | None = None
    course_title: str | None = None
    evidence: dict[str, float | int | str | None] = {}


# --- AdaptiveStudy -------------------------------------------------------------


class GoalIn(RequestModel):
    course_id: str
    session_minutes: int = Field(ge=10, le=240)
    weekly_minutes: int | None = Field(default=None, ge=10, le=40 * 60)
    target_date: date | None = None


class GoalOut(ApiModel):
    course_id: str
    course_title: str
    session_minutes: int
    weekly_minutes: int | None
    target_date: date | None
    updated_at: datetime


class PlanLesson(ApiModel):
    lesson_id: str
    title: str
    order: int
    has_video: bool
    trackable: bool
    duration_seconds: float | None
    position_seconds: float
    remaining_seconds: float | None
    pending_replay: int


class PlanStep(ApiModel):
    type: Literal["replay", "continue", "lesson", "bookmark"]
    lesson_id: str
    lesson_title: str
    item_id: str | None = None
    start_seconds: float | None = None
    seconds: float | None  # None: duration unknown


class SuggestedSession(ApiModel):
    budget_seconds: int
    planned_seconds: float
    has_unknown_durations: bool
    exceeds_budget: bool
    steps: list[PlanStep]


class GoalProgress(ApiModel):
    completed_lessons: int
    total_lessons: int
    percent: int
    weekly_target_minutes: int | None
    weekly_done_minutes: int
    target_date: date | None
    days_left: int | None
    lessons_per_week_needed: float | None


class PlanOut(ApiModel):
    goal: GoalOut | None
    progress: GoalProgress | None
    unfinished_lessons: list[PlanLesson]
    pending_replay: list[ReplayItemOut]
    suggested_session: SuggestedSession | None


# --- QuizFlow ------------------------------------------------------------------


class QuestionCreate(RequestModel):
    prompt: str = Field(min_length=3, max_length=300)
    options: list[str] = Field(min_length=2, max_length=6)
    correct_index: int = Field(ge=0, le=5)
    explanation: str = Field(default="", max_length=500)

    @field_validator("prompt", "explanation", mode="before")
    @classmethod
    def _trim(cls, value: object) -> object:
        return _strip(value)

    @field_validator("options")
    @classmethod
    def _options(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values]
        if any(not value or len(value) > 200 for value in cleaned):
            raise ValueError("Every option needs 1-200 characters.")
        if len({value.casefold() for value in cleaned}) != len(cleaned):
            raise ValueError("Options must be different from each other.")
        return cleaned

    @model_validator(mode="after")
    def _correct(self) -> "QuestionCreate":
        if self.correct_index >= len(self.options):
            raise ValueError("correctIndex must point to one of the options.")
        return self


class QuestionOut(ApiModel):
    id: str
    prompt: str
    options: list[str]
    mine: bool
    shared: bool
    # Only for the question's author (they wrote it); learners get it after answering.
    correct_index: int | None = None
    explanation: str | None = None


class AnswerIn(RequestModel):
    question_id: str
    choice: int = Field(ge=0, le=5)


class AttemptIn(RequestModel):
    answers: list[AnswerIn] = Field(min_length=1, max_length=200)


class AttemptResult(ApiModel):
    question_id: str
    prompt: str
    options: list[str]
    choice: int
    correct_index: int
    correct: bool
    explanation: str


class AttemptOut(ApiModel):
    id: str
    created_at: datetime
    score: int
    total: int
    percent: int
    results: list[AttemptResult]


class LessonQuizOut(ApiModel):
    lesson_id: str
    can_author: bool
    can_share: bool  # content managers write questions for every learner of a catalog lesson
    questions: list[QuestionOut]
    attempt_count: int
    last_attempt: AttemptOut | None


class LessonLearningSummary(ApiModel):
    lesson_id: str
    pending_replay: int
    reviewed_replay: int
    bookmarks: int
    question_count: int
    last_quiz_percent: int | None


class CourseLearningSummary(ApiModel):
    course_id: str
    pending_replay: int
    lessons: list[LessonLearningSummary]


# --- catalog administration -----------------------------------------------------


class CatalogCourseCreate(RequestModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=2000)
    category: str = Field(default="", max_length=60)
    status: Literal["published", "draft"] = "draft"

    @field_validator("title", "description", "category", mode="before")
    @classmethod
    def _trim(cls, value: object) -> object:
        return _strip(value)


class CatalogAdminCourse(CourseOut):
    enrollment_count: int
    lessons_without_video: int


# --- privacy -------------------------------------------------------------------


class PrivacySummary(ApiModel):
    sessions: int
    segments: int
    suggestions: int
    bookmarks: int
    quiz_attempts: int
    oldest_session_at: datetime | None
    retention_days: int


class DeletionResult(ApiModel):
    sessions: int
    segments: int
    suggestions: int
    bookmarks: int
    quiz_attempts: int
