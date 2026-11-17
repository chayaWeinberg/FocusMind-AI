"""Request/response schemas for courses, lessons, progress and learning
sessions. JSON uses camelCase (like the auth API); Python uses snake_case."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel

ATTENTION_STATES = ("ON_SCREEN", "OFF_SCREEN", "FACE_ABSENT", "UNCERTAIN", "NOT_MEASURED")


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RequestModel(ApiModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


def _strip(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


# --- requests -------------------------------------------------------------


class CourseCreate(RequestModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=2000)
    category: str = Field(default="", max_length=60)

    @field_validator("title", "description", "category", mode="before")
    @classmethod
    def _trim(cls, value: object) -> object:
        return _strip(value)


class CourseUpdate(RequestModel):
    title: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    category: str | None = Field(default=None, max_length=60)
    # Catalog courses only (content managers): publish / unpublish.
    status: Literal["published", "draft"] | None = None

    @field_validator("title", "description", "category", mode="before")
    @classmethod
    def _trim(cls, value: object) -> object:
        return _strip(value)


class LessonCreate(RequestModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=2000)
    external_url: str | None = Field(default=None, max_length=2048)
    duration_seconds: float | None = Field(default=None, gt=0, le=24 * 3600)

    @field_validator("title", "description", "external_url", mode="before")
    @classmethod
    def _trim(cls, value: object) -> object:
        return _strip(value)


class LessonUpdate(RequestModel):
    title: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    duration_seconds: float | None = Field(default=None, gt=0, le=24 * 3600)

    @field_validator("title", "description", mode="before")
    @classmethod
    def _trim(cls, value: object) -> object:
        return _strip(value)


class LessonVideoUrl(RequestModel):
    url: str = Field(min_length=8, max_length=2048)
    duration_seconds: float | None = Field(default=None, gt=0, le=24 * 3600)
    # "page": the link is a web page that shows the video (opened externally).
    kind: Literal["video", "page"] = "video"

    @field_validator("url", mode="before")
    @classmethod
    def _trim(cls, value: object) -> object:
        return _strip(value)


class LessonOrder(RequestModel):
    lesson_ids: list[str] = Field(min_length=1, max_length=500)


class ProgressUpdate(RequestModel):
    position_seconds: float = Field(ge=0, le=24 * 3600)
    duration_seconds: float | None = Field(default=None, gt=0, le=24 * 3600)
    ended: bool = False


class SessionCreate(RequestModel):
    lesson_id: str


class SegmentIn(RequestModel):
    seq: int = Field(ge=0, le=1_000_000)
    session_start_ms: int = Field(ge=0, le=24 * 3600 * 1000)
    session_end_ms: int = Field(ge=0, le=24 * 3600 * 1000)
    video_start: float = Field(ge=0, le=24 * 3600)
    video_end: float = Field(ge=0, le=24 * 3600)
    playback_rate: float = Field(gt=0, le=16)
    state: Literal["ON_SCREEN", "OFF_SCREEN", "FACE_ABSENT", "UNCERTAIN", "NOT_MEASURED"]
    duration_ms: int = Field(gt=0, le=10 * 60 * 1000)
    concentration: int | None = Field(default=None, ge=0, le=100)

    @model_validator(mode="after")
    def ordered_times(self) -> "SegmentIn":
        if self.session_end_ms < self.session_start_ms:
            raise ValueError("sessionEndMs must not be before sessionStartMs.")
        if self.video_end < self.video_start:
            raise ValueError("videoEnd must not be before videoStart (a seek starts a new segment).")
        return self


class SegmentBatch(RequestModel):
    segments: list[SegmentIn] = Field(min_length=1, max_length=200)


class SessionEnd(RequestModel):
    active_ms: int = Field(ge=0, le=24 * 3600 * 1000)
    break_ms: int = Field(default=0, ge=0, le=24 * 3600 * 1000)


# --- responses ------------------------------------------------------------


class CourseProgress(ApiModel):
    completed_lessons: int
    total_lessons: int
    percent: int
    continue_lesson_id: str | None


class LessonVideoOut(ApiModel):
    source_type: Literal["none", "upload", "external"]
    provider: Literal["direct", "youtube", "page"] | None = None
    url: str | None = None  # external URL, or the authorized stream URL for uploads
    embed_url: str | None = None
    original_name: str | None = None
    size_bytes: int | None = None
    trackable: bool  # playback position can be read and restored
    source_name: str | None = None  # attribution of curated catalog videos
    source_url: str | None = None
    license: str | None = None
    demo: bool = False  # a short original demonstration video generated for FocusMind
    academy: bool = False  # a full original FocusMind Academy lesson, played and tracked here


class NetFreeStatus(ApiModel):
    # "blocked": the video itself was measured as blocked; "page_only": the
    # source page opens but its video is blocked; "playable": the video was
    # seen playing; "unverified": not measured.
    status: Literal["playable", "page_only", "blocked", "unverified"]
    detail: str | None = None
    checked_at: str | None = None


class LessonResource(ApiModel):
    """The real educational video behind a catalog lesson, with its source."""

    provider: str
    source_title: str
    language: str
    license: str | None = None
    page_url: str
    youtube_url: str | None = None
    direct_url: str | None = None
    duration_seconds: float | None = None  # only when verified at the source
    netfree: NetFreeStatus


class LessonReference(ApiModel):
    """An optional external resource for the lesson (e.g. the full lecture)."""

    name: str | None = None
    url: str
    license: str | None = None


class LessonProgressOut(ApiModel):
    position_seconds: float
    duration_seconds: float | None
    completed: bool
    completed_at: datetime | None
    updated_at: datetime | None


class LessonOut(ApiModel):
    id: str
    course_id: str
    title: str
    description: str
    order: int
    duration_seconds: float | None
    video: LessonVideoOut
    reference: LessonReference | None = None
    resource: LessonResource | None = None
    progress: LessonProgressOut | None = None


class CourseOut(ApiModel):
    id: str
    title: str
    description: str
    category: str
    type: Literal["catalog", "personal"]
    status: Literal["published", "draft"]
    difficulty: Literal["beginner", "intermediate", "advanced"] | None = None
    is_owner: bool
    enrolled: bool
    lesson_count: int
    academy: bool = False  # FocusMind Academy: every lesson plays inside FocusMind
    external_library: bool = False  # lessons are external lecture links (no tracking)
    progress: CourseProgress | None = None
    created_at: datetime
    updated_at: datetime


class CourseDetail(CourseOut):
    lessons: list[LessonOut]
    can_edit: bool
    can_learn: bool


class CourseSummary(ApiModel):
    id: str
    title: str
    type: Literal["catalog", "personal"]
    can_edit: bool


class LessonContext(ApiModel):
    lesson: LessonOut
    course: CourseSummary
    previous_lesson_id: str | None
    next_lesson_id: str | None
    lesson_number: int
    lesson_total: int
    can_learn: bool


class SessionOut(ApiModel):
    id: str
    lesson_id: str
    course_id: str
    started_at: datetime
    ended_at: datetime | None
    active_ms: int
    break_ms: int = 0
    segment_count: int
    trackable: bool = True


class SegmentOut(ApiModel):
    seq: int
    session_start_ms: int
    session_end_ms: int
    video_start: float
    video_end: float
    playback_rate: float
    state: str
    duration_ms: int
    concentration: int | None


class SessionDetail(SessionOut):
    segments: list[SegmentOut]
