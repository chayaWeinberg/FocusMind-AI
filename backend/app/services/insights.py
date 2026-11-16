"""FocusInsights (analytics), FocusCoach (study guidance) and AdaptiveStudy
(goal + next-session plan). Everything is computed from stored data of the
signed-in user; nothing is estimated or invented.

Dates: the browser sends its UTC offset (``tzOffsetMinutes`` as returned by
``Date.prototype.getTimezoneOffset``: UTC minus local time), so "today",
days and weeks follow the learner's clock. Weeks start on Sunday.

Wording: ON_SCREEN time is "time looking toward the screen", never a
concentration or comprehension score.
"""

from collections import defaultdict
from datetime import date, datetime, timedelta

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.courses import LearningSessionRepository, to_object_id
from app.repositories.learning import GoalRepository, PreferencesRepository, QuizRepository, ReplayRepository
from app.schemas.auth import RegisteredUser
from app.schemas.learning import (
    CoachTip,
    CourseTime,
    DayValue,
    GoalIn,
    GoalOut,
    GoalProgress,
    InsightsOut,
    InsightsTotals,
    PlanLesson,
    PlanOut,
    PlanStep,
    Preferences,
    QuizStats,
    ReplayCounts,
    Streak,
    SuggestedSession,
    WeekValue,
)
from app.services.courses import CourseService, ForbiddenError, NotFoundError, is_trackable, utcnow
from app.services.learning_sessions import history_items
from app.services.replay import ReplayService, item_out

ATTENTION_STATES = ("ON_SCREEN", "OFF_SCREEN", "FACE_ABSENT", "UNCERTAIN", "NOT_MEASURED")
MEASURED_FOR_SHARE = ("ON_SCREEN", "OFF_SCREEN", "FACE_ABSENT")
STREAK_MIN_ACTIVE_MS = 60_000  # a day counts for the streak after one minute of active learning
BREAK_SUGGESTION_ACTIVE_MS = 50 * 60_000  # active learning in the last two hours
RESUME_AFTER_DAYS = 3
POINT_BOOKMARK_REVIEW_SECONDS = 30.0


def clamp_offset(minutes: int) -> int:
    return max(-14 * 60, min(14 * 60, int(minutes)))


def mongo_timezone(tz_offset_minutes: int) -> str:
    local = -clamp_offset(tz_offset_minutes)
    sign = "+" if local >= 0 else "-"
    return f"{sign}{abs(local) // 60:02d}:{abs(local) % 60:02d}"


def local_today(tz_offset_minutes: int, now: datetime | None = None) -> date:
    return ((now or utcnow()) - timedelta(minutes=clamp_offset(tz_offset_minutes))).date()


def week_start(day: date) -> date:
    return day - timedelta(days=(day.weekday() + 1) % 7)  # Sunday


def local_midnight_utc(day: date, tz_offset_minutes: int) -> datetime:
    from datetime import timezone

    return datetime(day.year, day.month, day.day, tzinfo=timezone.utc) + timedelta(minutes=clamp_offset(tz_offset_minutes))


def streaks(active_days: set[date], today: date) -> Streak:
    current = 0
    cursor = today if today in active_days else today - timedelta(days=1)
    while cursor in active_days:
        current += 1
        cursor -= timedelta(days=1)
    longest = run = 0
    previous: date | None = None
    for day in sorted(active_days):
        run = run + 1 if previous is not None and day - previous == timedelta(days=1) else 1
        longest = max(longest, run)
        previous = day
    return Streak(current=current, longest=longest, active_today=today in active_days)


class InsightsService:
    def __init__(self, database: AsyncDatabase, user: RegisteredUser) -> None:
        self.database = database
        self.user = user
        self.user_id = ObjectId(user.id)
        self.courses = CourseService(database, user)
        self.sessions = LearningSessionRepository(database)
        self.replay = ReplayRepository(database)
        self.quizzes = QuizRepository(database)

    async def _day_totals(self, timezone: str) -> dict[date, dict]:
        cursor = await self.database.learning_sessions.aggregate([
            {"$match": {"user_id": self.user_id}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$started_at", "timezone": timezone}},
                "active": {"$sum": {"$ifNull": ["$active_ms", 0]}},
                "breaks": {"$sum": {"$ifNull": ["$break_ms", 0]}},
                "count": {"$sum": 1},
            }},
        ])
        return {date.fromisoformat(row["_id"]): row async for row in cursor}

    async def _attention_by_day(self, timezone: str) -> dict[date, dict[str, int]]:
        cursor = await self.database.attention_segments.aggregate([
            {"$match": {"user_id": self.user_id}},
            {"$group": {
                "_id": {
                    "day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at", "timezone": timezone}},
                    "state": "$state",
                },
                "ms": {"$sum": "$duration_ms"},
            }},
        ])
        result: dict[date, dict[str, int]] = defaultdict(dict)
        async for row in cursor:
            result[date.fromisoformat(row["_id"]["day"])][row["_id"]["state"]] = int(row["ms"])
        return result

    async def build(self, tz_offset_minutes: int = 0, days: int = 14, weeks: int = 8) -> InsightsOut:
        await ReplayService(self.database, self.user).refresh_stale()
        timezone = mongo_timezone(tz_offset_minutes)
        today = local_today(tz_offset_minutes)
        this_week = week_start(today)
        day_totals = await self._day_totals(timezone)
        attention_days = await self._attention_by_day(timezone)

        daily = [
            DayValue(date=day.isoformat(), active_ms=int(day_totals.get(day, {}).get("active", 0)))
            for day in (today - timedelta(days=offset) for offset in range(days - 1, -1, -1))
        ]
        weekly = []
        for offset in range(weeks - 1, -1, -1):
            start = this_week - timedelta(weeks=offset)
            span = [start + timedelta(days=index) for index in range(7)]
            states = defaultdict(int)
            for day in span:
                for state, ms in attention_days.get(day, {}).items():
                    states[state] += ms
            weekly.append(WeekValue(
                week_start=start.isoformat(),
                active_ms=int(sum(day_totals.get(day, {}).get("active", 0) for day in span)),
                on_screen_ms=states["ON_SCREEN"],
                measured_ms=sum(states[state] for state in MEASURED_FOR_SHARE),
            ))

        attention = {state: 0 for state in ATTENTION_STATES}
        for states in attention_days.values():
            for state, ms in states.items():
                if state in attention:
                    attention[state] += ms

        cursor = await self.database.learning_sessions.aggregate([
            {"$match": {"user_id": self.user_id}},
            {"$group": {"_id": "$course_id", "active": {"$sum": {"$ifNull": ["$active_ms", 0]}}}},
        ])
        course_time = {row["_id"]: int(row["active"]) async for row in cursor}
        my_courses = await self.courses.my_courses()
        by_course = [
            CourseTime(
                course_id=course.id,
                title=course.title,
                type=course.type,
                active_ms=course_time.get(ObjectId(course.id), 0),
                completed_lessons=course.progress.completed_lessons if course.progress else 0,
                total_lessons=course.progress.total_lessons if course.progress else 0,
                percent=course.progress.percent if course.progress else 0,
            )
            for course in my_courses
        ]
        by_course.sort(key=lambda item: item.active_ms, reverse=True)

        cursor = await self.database.attention_segments.aggregate([
            {"$match": {"user_id": self.user_id}},
            {"$group": {"_id": None, "seconds": {"$sum": {"$subtract": ["$video_end", "$video_start"]}}}},
        ])
        video_rows = await cursor.to_list(None)
        week_start_utc = local_midnight_utc(this_week, tz_offset_minutes)
        completed = await self.database.lesson_progress.count_documents({"user_id": self.user_id, "completed": True})
        completed_week = await self.database.lesson_progress.count_documents(
            {"user_id": self.user_id, "completed": True, "completed_at": {"$gte": week_start_utc}}
        )

        counts = await self.replay.counts(self.user_id)
        auto = {status: counts.get(("auto", status), 0) for status in ("new", "reviewed", "dismissed")}
        quiz = await self.quizzes.attempt_stats(self.user_id)
        active_days = {day for day, row in day_totals.items() if row.get("active", 0) >= STREAK_MIN_ACTIVE_MS}
        recent = await self.sessions.recent(self.user_id, 10)

        return InsightsOut(
            totals=InsightsTotals(
                active_ms=int(sum(row["active"] for row in day_totals.values())),
                break_ms=int(sum(row["breaks"] for row in day_totals.values())),
                video_seconds=round(float(video_rows[0]["seconds"]) if video_rows else 0.0, 1),
                session_count=int(sum(row["count"] for row in day_totals.values())),
                lessons_completed=completed,
                lessons_completed_this_week=completed_week,
                active_ms_today=int(day_totals.get(today, {}).get("active", 0)),
                active_ms_this_week=weekly[-1].active_ms if weekly else 0,
            ),
            daily=daily,
            weekly=weekly,
            by_course=by_course,
            attention=attention,
            replay=ReplayCounts(
                suggested=sum(auto.values()),
                pending=auto["new"],
                reviewed=auto["reviewed"],
                dismissed=auto["dismissed"],
                bookmarks=counts.get(("bookmark", "new"), 0) + counts.get(("bookmark", "reviewed"), 0),
                bookmarks_pending=counts.get(("bookmark", "new"), 0),
            ),
            quizzes=QuizStats(
                attempts=int(quiz["count"]),
                average_percent=round(100 * quiz["score"] / quiz["total"]) if quiz["total"] else None,
            ),
            streak=streaks(active_days, today),
            recent_sessions=await history_items(self.database, self.sessions, recent),
        )


class PreferencesService:
    def __init__(self, database: AsyncDatabase, user: RegisteredUser) -> None:
        self.repository = PreferencesRepository(database)
        self.user_id = ObjectId(user.id)

    async def get(self) -> Preferences:
        stored = await self.repository.find(self.user_id) or {}
        return Preferences(**{key: stored[key] for key in Preferences.model_fields if key in stored})

    async def save(self, data: Preferences) -> Preferences:
        await self.repository.save(self.user_id, data.model_dump(), utcnow())
        return await self.get()


# --- AdaptiveStudy ----------------------------------------------------------------


class StudyService:
    def __init__(self, database: AsyncDatabase, user: RegisteredUser) -> None:
        self.database = database
        self.user = user
        self.user_id = ObjectId(user.id)
        self.courses = CourseService(database, user)
        self.goals = GoalRepository(database)

    async def _learnable_course(self, course_id: ObjectId | str) -> dict:
        course = await self.courses.course_for_view(str(course_id))
        if not await self.courses.can_learn(course):
            raise ForbiddenError("Enroll in the course before setting a study goal for it.")
        return course

    @staticmethod
    def _goal_out(goal: dict, course: dict) -> GoalOut:
        target = goal.get("target_date")
        return GoalOut(
            course_id=str(course["_id"]),
            course_title=course["title"],
            session_minutes=goal["session_minutes"],
            weekly_minutes=goal.get("weekly_minutes"),
            target_date=date.fromisoformat(target) if isinstance(target, str) else target,
            updated_at=goal["updated_at"],
        )

    async def _current(self) -> tuple[dict, dict] | None:
        goal = await self.goals.find(self.user_id)
        if goal is None:
            return None
        try:
            course = await self._learnable_course(goal["course_id"])
        except (NotFoundError, ForbiddenError):
            return None  # the course is gone or no longer learnable: the goal is not shown
        return goal, course

    async def get_goal(self) -> GoalOut | None:
        current = await self._current()
        return self._goal_out(*current) if current else None

    async def save_goal(self, data: GoalIn) -> GoalOut:
        course = await self._learnable_course(data.course_id)
        goal = await self.goals.save(self.user_id, {
            "course_id": course["_id"],
            "session_minutes": data.session_minutes,
            "weekly_minutes": data.weekly_minutes,
            # stored as text: BSON has no date-only type
            "target_date": data.target_date.isoformat() if data.target_date else None,
        }, utcnow())
        return self._goal_out(goal, course)

    async def delete_goal(self) -> None:
        await self.goals.delete(self.user_id)

    async def plan(self, tz_offset_minutes: int = 0) -> PlanOut:
        current = await self._current()
        if current is None:
            return PlanOut(goal=None, progress=None, unfinished_lessons=[], pending_replay=[], suggested_session=None)
        goal, course = current
        await ReplayService(self.database, self.user).refresh_stale()
        lessons = await self.courses.lessons.list_for_course(course["_id"])
        progress = await self.courses.progress.for_course(self.user_id, course["_id"])
        order = {lesson["_id"]: lesson["order"] for lesson in lessons}
        titles = {lesson["_id"]: lesson["title"] for lesson in lessons}
        pending = [
            item for item in await ReplayRepository(self.database).find_items(
                self.user_id, {"course_id": course["_id"], "status": "new"}
            )
            if item["lesson_id"] in order
        ]
        pending.sort(key=lambda item: (order[item["lesson_id"]], item["start_seconds"]))
        pending_per_lesson: dict[ObjectId, int] = defaultdict(int)
        for item in pending:
            pending_per_lesson[item["lesson_id"]] += 1

        unfinished: list[PlanLesson] = []
        for lesson in lessons:
            row = progress.get(lesson["_id"], {})
            if row.get("completed"):
                continue
            video = lesson.get("video", {})
            duration = lesson.get("duration_seconds") or row.get("duration_seconds")
            position = float(row.get("position_seconds", 0) or 0)
            unfinished.append(PlanLesson(
                lesson_id=str(lesson["_id"]),
                title=lesson["title"],
                order=lesson["order"],
                has_video=video.get("source_type", "none") != "none",
                trackable=is_trackable(video),
                duration_seconds=duration,
                position_seconds=position,
                remaining_seconds=max(0.0, duration - position) if duration else None,
                pending_replay=pending_per_lesson.get(lesson["_id"], 0),
            ))

        budget = goal["session_minutes"] * 60
        steps: list[PlanStep] = []
        planned = 0.0
        unknown = False
        for item in pending:
            end = item.get("end_seconds")
            seconds = (end - item["start_seconds"]) if end else POINT_BOOKMARK_REVIEW_SECONDS
            if planned + seconds > budget:
                break
            steps.append(PlanStep(
                type="replay" if item["kind"] == "auto" else "bookmark",
                lesson_id=str(item["lesson_id"]),
                lesson_title=titles[item["lesson_id"]],
                item_id=str(item["_id"]),
                start_seconds=item["start_seconds"],
                seconds=round(seconds, 1),
            ))
            planned += seconds
        for lesson in (entry for entry in unfinished if entry.has_video):
            step_type = "continue" if lesson.position_seconds > 0 else "lesson"
            if lesson.remaining_seconds is None:
                if not steps or planned < budget * 0.75:
                    steps.append(PlanStep(type=step_type, lesson_id=lesson.lesson_id, lesson_title=lesson.title, seconds=None))
                    unknown = True
                break  # nothing can be planned reliably after a lesson of unknown length
            if steps and planned + lesson.remaining_seconds > budget:
                break
            steps.append(PlanStep(
                type=step_type, lesson_id=lesson.lesson_id, lesson_title=lesson.title,
                start_seconds=lesson.position_seconds or None, seconds=round(lesson.remaining_seconds, 1),
            ))
            planned += lesson.remaining_seconds

        today = local_today(tz_offset_minutes)
        week_start_utc = local_midnight_utc(week_start(today), tz_offset_minutes)
        cursor = await self.database.learning_sessions.aggregate([
            {"$match": {"user_id": self.user_id, "course_id": course["_id"], "started_at": {"$gte": week_start_utc}}},
            {"$group": {"_id": None, "active": {"$sum": {"$ifNull": ["$active_ms", 0]}}}},
        ])
        rows = await cursor.to_list(None)
        done_minutes = round((rows[0]["active"] if rows else 0) / 60_000)
        total = len(lessons)
        completed = total - len(unfinished)
        goal_out = self._goal_out(goal, course)
        days_left = (goal_out.target_date - today).days if goal_out.target_date else None
        lessons_left = total - completed
        per_week = None
        if days_left is not None and lessons_left > 0:
            per_week = round(lessons_left / max(days_left, 1) * 7, 1)

        return PlanOut(
            goal=goal_out,
            progress=GoalProgress(
                completed_lessons=completed,
                total_lessons=total,
                percent=round(100 * completed / total) if total else 0,
                weekly_target_minutes=goal.get("weekly_minutes"),
                weekly_done_minutes=done_minutes,
                target_date=goal_out.target_date,
                days_left=days_left,
                lessons_per_week_needed=per_week,
            ),
            unfinished_lessons=unfinished,
            pending_replay=[item_out(item, titles[item["lesson_id"]], course["title"]) for item in pending],
            suggested_session=SuggestedSession(
                budget_seconds=budget,
                planned_seconds=round(planned, 1),
                has_unknown_durations=unknown,
                exceeds_budget=planned > budget,
                steps=steps,
            ) if steps else None,
        )


# --- FocusCoach -----------------------------------------------------------------


class CoachService:
    """Deterministic, explainable study tips. Each tip carries its evidence."""

    def __init__(self, database: AsyncDatabase, user: RegisteredUser) -> None:
        self.database = database
        self.user = user
        self.user_id = ObjectId(user.id)
        self.courses = CourseService(database, user)

    async def tips(self, tz_offset_minutes: int = 0, limit: int = 6) -> list[CoachTip]:
        await ReplayService(self.database, self.user).refresh_stale()
        now = utcnow()
        tips: list[CoachTip] = []
        lessons_cache: dict[ObjectId, dict | None] = {}

        async def lesson_of(lesson_id: ObjectId) -> dict | None:
            if lesson_id not in lessons_cache:
                lessons_cache[lesson_id] = await self.database.lessons.find_one({"_id": lesson_id})
            return lessons_cache[lesson_id]

        my_courses = await self.courses.my_courses()
        course_titles = {ObjectId(course.id): course.title for course in my_courses}

        # 1. A long stretch of active learning in the last two hours.
        recent = await self.database.learning_sessions.find(
            {"user_id": self.user_id, "last_seen_at": {"$gte": now - timedelta(minutes=15)},
             "started_at": {"$gte": now - timedelta(hours=2)}}
        ).to_list(None)
        recent_active = sum(row.get("active_ms", 0) for row in recent)
        if recent_active >= BREAK_SUGGESTION_ACTIVE_MS:
            tips.append(CoachTip(kind="take_break", priority=100, evidence={"activeMinutes": round(recent_active / 60_000)}))

        # 2. Pending review suggestions and bookmarks, per lesson.
        items = await self.database.replay_items.find({"user_id": self.user_id, "status": "new"}).to_list(1000)
        per_lesson: dict[tuple[ObjectId, str], list[dict]] = defaultdict(list)
        for item in items:
            per_lesson[(item["lesson_id"], item["kind"])].append(item)
        progress_rows = {
            row["lesson_id"]: row
            async for row in self.database.lesson_progress.find({"user_id": self.user_id})
        }
        for (lesson_id, kind), group in per_lesson.items():
            lesson = await lesson_of(lesson_id)
            if lesson is None or lesson["course_id"] not in course_titles:
                continue
            first = min(group, key=lambda item: item["start_seconds"])
            seconds = sum(((item.get("end_seconds") or item["start_seconds"]) - item["start_seconds"]) for item in group)
            evidence = {"count": len(group), "seconds": round(seconds), "firstStart": round(first["start_seconds"], 1)}
            if kind == "bookmark":
                tips.append(self._tip("return_to_bookmark", 60, lesson, course_titles, evidence))
                continue
            completed = progress_rows.get(lesson_id, {}).get("completed")
            if completed:
                following = await self.database.lessons.find_one(
                    {"course_id": lesson["course_id"], "order": {"$gt": lesson["order"]}}, sort=[("order", 1)]
                )
                if following and not progress_rows.get(following["_id"], {}).get("completed"):
                    evidence["nextLessonTitle"] = following["title"]
                    tips.append(self._tip("review_before_next", 90, lesson, course_titles, evidence))
                    continue
            tips.append(self._tip("review_flagged", 80, lesson, course_titles, evidence))

        # 3. Unfinished lessons with a saved position (most recent first).
        started = sorted(
            (row for row in progress_rows.values() if not row.get("completed") and row.get("position_seconds", 0) > 0),
            key=lambda row: row.get("updated_at") or now, reverse=True,
        )
        for row in started[:2]:
            lesson = await lesson_of(row["lesson_id"])
            if lesson is None or lesson["course_id"] not in course_titles:
                continue
            tips.append(self._tip("continue_lesson", 75, lesson, course_titles, {
                "positionSeconds": round(row["position_seconds"]),
                "durationSeconds": round(row["duration_seconds"]) if row.get("duration_seconds") else None,
                "daysAgo": (now - row["updated_at"]).days if row.get("updated_at") else None,
            }))

        # 4. Quizzes answered with mistakes (latest attempt per lesson).
        for attempt in await QuizRepository(self.database).latest_attempts(self.user_id):
            if attempt["score"] >= attempt["total"]:
                continue
            lesson = await lesson_of(attempt["lesson_id"])
            if lesson is None or lesson["course_id"] not in course_titles:
                continue
            tips.append(self._tip("retry_quiz", 55, lesson, course_titles, {
                "wrong": attempt["total"] - attempt["score"], "total": attempt["total"],
            }))

        # 5. Weekly study goal behind schedule.
        goal = await GoalRepository(self.database).find(self.user_id)
        if goal and goal.get("weekly_minutes") and goal["course_id"] in course_titles:
            today = local_today(tz_offset_minutes)
            start = week_start(today)
            cursor = await self.database.learning_sessions.aggregate([
                {"$match": {"user_id": self.user_id, "course_id": goal["course_id"],
                            "started_at": {"$gte": local_midnight_utc(start, tz_offset_minutes)}}},
                {"$group": {"_id": None, "active": {"$sum": {"$ifNull": ["$active_ms", 0]}}}},
            ])
            rows = await cursor.to_list(None)
            done = (rows[0]["active"] if rows else 0) / 60_000
            expected = goal["weekly_minutes"] * ((today - start).days + 1) / 7
            if done < expected * 0.8 and done < goal["weekly_minutes"]:
                tips.append(CoachTip(
                    kind="goal_behind", priority=70, course_id=str(goal["course_id"]),
                    course_title=course_titles[goal["course_id"]],
                    evidence={"doneMinutes": round(done), "targetMinutes": goal["weekly_minutes"], "expectedMinutes": round(expected)},
                ))

        # 6. Courses with unfinished lessons that were not touched for a while.
        for course in my_courses:
            if not course.progress or not course.progress.total_lessons or course.progress.percent >= 100:
                continue
            course_id = ObjectId(course.id)
            touched = [row.get("updated_at") for row in progress_rows.values() if row.get("course_id") == course_id and row.get("updated_at")]
            last = max(touched) if touched else None
            if last is not None and now - last < timedelta(days=RESUME_AFTER_DAYS):
                continue
            tips.append(CoachTip(
                kind="resume_course", priority=50 if last else 40, course_id=course.id, course_title=course.title,
                lesson_id=course.progress.continue_lesson_id,
                evidence={
                    "daysAgo": (now - last).days if last else None,
                    "completed": course.progress.completed_lessons,
                    "total": course.progress.total_lessons,
                },
            ))

        if not my_courses:
            tips.append(CoachTip(kind="start_learning", priority=30, evidence={}))

        tips.sort(key=lambda tip: tip.priority, reverse=True)
        unique: list[CoachTip] = []
        seen: set[tuple[str, str | None]] = set()
        for tip in tips:
            key = (tip.kind, tip.lesson_id or tip.course_id)
            if key in seen:
                continue
            seen.add(key)
            unique.append(tip)
        return unique[:limit]

    @staticmethod
    def _tip(kind: str, priority: int, lesson: dict, course_titles: dict, evidence: dict) -> CoachTip:
        return CoachTip(
            kind=kind, priority=priority,
            lesson_id=str(lesson["_id"]), course_id=str(lesson["course_id"]),
            lesson_title=lesson["title"], course_title=course_titles.get(lesson["course_id"]),
            evidence=evidence,
        )


__all__ = ["CoachService", "InsightsService", "PreferencesService", "StudyService", "to_object_id"]
