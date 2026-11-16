import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError

from app.api.routes.auth import router as auth_router
from app.api.routes.courses import router as courses_router
from app.api.routes.learning import router as learning_router
from app.api.routes.learning_sessions import router as learning_sessions_router
from app.core.config import settings
from app.db.database import close_db, get_database, initialize_db, ping_db
from app.seed.catalog import seed_catalog
from app.services import video_storage
from app.services.courses import CourseError
from app.services.privacy import apply_retention

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await initialize_db(
        settings.mongo_uri, settings.mongo_db_name, settings.mongo_timeout_ms
    )
    removed = video_storage.cleanup_stale_uploads()
    if removed:
        logger.info("Removed %d interrupted video uploads.", removed)
    if settings.seed_catalog:
        await seed_catalog(get_database())
    if settings.attention_retention_days:
        expired = await apply_retention(get_database(), settings.attention_retention_days)
        if expired:
            logger.info("Retention removed %d old learning sessions.", expired)
    try:
        yield
    finally:
        await close_db()


app = FastAPI(
    title="FocusMind AI",
    lifespan=lifespan,
    # Interactive API docs are a development convenience only.
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.environment == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Range", "X-File-Name"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"],
)


@app.exception_handler(RequestValidationError)
async def handle_request_validation_error(
    _, exception: RequestValidationError
) -> JSONResponse:
    # "input" and "ctx" are deliberately omitted so submitted passwords are
    # never echoed back in validation errors.
    errors = [
        {
            "loc": error["loc"],
            "msg": error["msg"],
            "type": error["type"],
        }
        for error in exception.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})


@app.exception_handler(CourseError)
async def handle_course_error(_, error: CourseError) -> JSONResponse:
    return JSONResponse(status_code=error.status_code, content={"detail": error.detail})


@app.exception_handler(PyMongoError)
async def handle_database_error(_, error: PyMongoError) -> JSONResponse:
    logger.error("Database error (%s).", type(error).__name__)
    return JSONResponse(status_code=503, content={"detail": "Service temporarily unavailable."})


@app.get("/api/health", tags=["health"])
async def health() -> JSONResponse:
    database_ok = await ping_db()
    return JSONResponse(
        status_code=200 if database_ok else 503,
        content={"status": "ok" if database_ok else "degraded", "database": database_ok},
    )


app.include_router(auth_router)
app.include_router(courses_router)
app.include_router(learning_sessions_router)
app.include_router(learning_router)
