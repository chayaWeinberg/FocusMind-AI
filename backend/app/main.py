from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.auth import router as auth_router
from app.core.config import settings
from app.db.database import close_db, initialize_db, ping_db


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await initialize_db(
        settings.mongo_uri, settings.mongo_db_name, settings.mongo_timeout_ms
    )
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
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
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


@app.get("/api/health", tags=["health"])
async def health() -> JSONResponse:
    database_ok = await ping_db()
    return JSONResponse(
        status_code=200 if database_ok else 503,
        content={"status": "ok" if database_ok else "degraded", "database": database_ok},
    )


app.include_router(auth_router)
