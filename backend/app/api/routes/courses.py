"""Courses, lessons, enrollment, progress and video endpoints.

Every endpoint requires a signed-in user (session cookie). Service errors
(CourseError subclasses) are turned into JSON responses by the handler
registered in app.main.
"""

from typing import Annotated

from fastapi import APIRouter, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from starlette.requests import ClientDisconnect

from app.api.dependencies import CurrentUser, Database
from app.schemas.courses import (
    CourseCreate,
    CourseDetail,
    CourseOut,
    CourseProgress,
    CourseUpdate,
    LessonContext,
    LessonCreate,
    LessonOrder,
    LessonOut,
    LessonProgressOut,
    LessonUpdate,
    LessonVideoUrl,
    ProgressUpdate,
)
from app.services import video_storage
from app.services.courses import CourseService, InvalidInputError, NotFoundError

router = APIRouter(prefix="/api", tags=["courses"])


def service(database: Database, user: CurrentUser) -> CourseService:
    return CourseService(database, user)


# --- courses ----------------------------------------------------------------


@router.get("/courses/catalog", response_model=list[CourseOut])
async def list_catalog(
    database: Database,
    user: CurrentUser,
    q: Annotated[str | None, Query(max_length=100)] = None,
    category: Annotated[str | None, Query(max_length=60)] = None,
) -> list[CourseOut]:
    return await service(database, user).list_catalog(q, category)


@router.get("/courses/catalog/categories", response_model=list[str])
async def catalog_categories(database: Database, user: CurrentUser) -> list[str]:
    return await service(database, user).catalog_categories()


@router.get("/courses/mine", response_model=list[CourseOut])
async def my_courses(database: Database, user: CurrentUser) -> list[CourseOut]:
    return await service(database, user).my_courses()


@router.post("/courses", response_model=CourseDetail, status_code=status.HTTP_201_CREATED)
async def create_course(data: CourseCreate, database: Database, user: CurrentUser) -> CourseDetail:
    return await service(database, user).create_course(data)


@router.get("/courses/{course_id}", response_model=CourseDetail)
async def course_detail(course_id: str, database: Database, user: CurrentUser) -> CourseDetail:
    return await service(database, user).course_detail(course_id)


@router.patch("/courses/{course_id}", response_model=CourseDetail)
async def update_course(
    course_id: str, data: CourseUpdate, database: Database, user: CurrentUser
) -> CourseDetail:
    return await service(database, user).update_course(course_id, data)


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(course_id: str, database: Database, user: CurrentUser) -> Response:
    await service(database, user).delete_course(course_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/courses/{course_id}/enroll", response_model=CourseDetail)
async def enroll(course_id: str, response: Response, database: Database, user: CurrentUser) -> CourseDetail:
    detail, created = await service(database, user).enroll(course_id)
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return detail


@router.get("/courses/{course_id}/progress", response_model=CourseProgress)
async def course_progress(course_id: str, database: Database, user: CurrentUser) -> CourseProgress:
    return await service(database, user).course_progress(course_id)


# --- lessons ----------------------------------------------------------------


@router.post("/courses/{course_id}/lessons", response_model=LessonOut, status_code=status.HTTP_201_CREATED)
async def add_lesson(course_id: str, data: LessonCreate, database: Database, user: CurrentUser) -> LessonOut:
    return await service(database, user).add_lesson(course_id, data)


@router.put("/courses/{course_id}/lessons/order", response_model=CourseDetail)
async def reorder_lessons(
    course_id: str, data: LessonOrder, database: Database, user: CurrentUser
) -> CourseDetail:
    return await service(database, user).reorder_lessons(course_id, data.lesson_ids)


@router.get("/lessons/{lesson_id}", response_model=LessonContext)
async def lesson_context(lesson_id: str, database: Database, user: CurrentUser) -> LessonContext:
    return await service(database, user).lesson_context(lesson_id)


@router.patch("/lessons/{lesson_id}", response_model=LessonOut)
async def update_lesson(lesson_id: str, data: LessonUpdate, database: Database, user: CurrentUser) -> LessonOut:
    return await service(database, user).update_lesson(lesson_id, data)


@router.delete("/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lesson(lesson_id: str, database: Database, user: CurrentUser) -> Response:
    await service(database, user).delete_lesson(lesson_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- lesson videos ----------------------------------------------------------


@router.put("/lessons/{lesson_id}/video", response_model=LessonOut)
async def upload_video(
    lesson_id: str,
    request: Request,
    database: Database,
    user: CurrentUser,
    duration_seconds: Annotated[float | None, Query(alias="durationSeconds", gt=0, le=24 * 3600)] = None,
) -> LessonOut:
    """Raw request body = the video file (streamed to disk, never buffered).

    Optional headers: ``X-File-Name`` (URL-encoded, display only).
    """
    length_header = request.headers.get("content-length")
    declared_length = int(length_header) if length_header and length_header.isdigit() else None
    try:
        return await service(database, user).upload_video(
            lesson_id,
            request.stream(),
            declared_length,
            request.headers.get("x-file-name"),
            duration_seconds,
        )
    except ClientDisconnect:
        raise InvalidInputError("The upload was interrupted.") from None


@router.put("/lessons/{lesson_id}/video-url", response_model=LessonOut)
async def set_video_url(
    lesson_id: str, data: LessonVideoUrl, database: Database, user: CurrentUser
) -> LessonOut:
    return await service(database, user).set_external_video(lesson_id, data.url, data.duration_seconds)


@router.delete("/lessons/{lesson_id}/video", response_model=LessonOut)
async def remove_video(lesson_id: str, database: Database, user: CurrentUser) -> LessonOut:
    return await service(database, user).remove_video(lesson_id)


@router.api_route("/videos/{asset_id}/stream", methods=["GET", "HEAD"])
async def stream_video(asset_id: str, request: Request, database: Database, user: CurrentUser) -> Response:
    asset = await service(database, user).asset_for_stream(asset_id)
    try:
        path = video_storage.storage_path(asset["storage_name"])
        size = path.stat().st_size
    except (OSError, ValueError):
        raise NotFoundError("The video file is not available.") from None

    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-transform, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
    }
    try:
        byte_range = video_storage.parse_range(request.headers.get("range"), size)
    except video_storage.RangeNotSatisfiableError:
        return Response(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            headers={**headers, "Content-Range": f"bytes */{size}"},
        )

    if byte_range is None:
        start, end, status_code = 0, size - 1, status.HTTP_200_OK
    else:
        (start, end), status_code = byte_range, status.HTTP_206_PARTIAL_CONTENT
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    headers["Content-Length"] = str(end - start + 1)

    if request.method == "HEAD":
        return Response(status_code=status_code, headers=headers, media_type=asset["content_type"])
    return StreamingResponse(
        video_storage.iter_file(path, start, end),
        status_code=status_code,
        headers=headers,
        media_type=asset["content_type"],
    )


# --- progress ---------------------------------------------------------------


@router.get("/lessons/{lesson_id}/progress", response_model=LessonProgressOut)
async def get_progress(lesson_id: str, database: Database, user: CurrentUser) -> LessonProgressOut:
    return await service(database, user).get_progress(lesson_id)


@router.put("/lessons/{lesson_id}/progress", response_model=LessonProgressOut)
async def save_progress(
    lesson_id: str, data: ProgressUpdate, database: Database, user: CurrentUser
) -> LessonProgressOut:
    return await service(database, user).save_progress(lesson_id, data)


@router.post("/lessons/{lesson_id}/complete", response_model=LessonProgressOut)
async def complete_lesson(lesson_id: str, database: Database, user: CurrentUser) -> LessonProgressOut:
    return await service(database, user).complete_lesson(lesson_id)
