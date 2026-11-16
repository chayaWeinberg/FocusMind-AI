"""QuizFlow: manual multiple-choice review questions per lesson.

Visibility:
- a learner's own questions are private to them (any lesson they may learn);
- questions written by a content manager on a catalog lesson are *shared*
  with every learner of that lesson.
Correct answers are never sent before answering, except to the question's
author. Attempts are graded on the server and stored per user. Quizzes are
optional: they never block lesson completion.

There is no automatic question generation: lessons have no transcript or
analyzed content, and questions about a video that was never analyzed would
be invented.
"""

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.courses import to_object_id
from app.repositories.learning import QuizRepository, ReplayRepository
from app.schemas.auth import RegisteredUser
from app.schemas.learning import (
    AttemptIn,
    AttemptOut,
    AttemptResult,
    CourseLearningSummary,
    LessonLearningSummary,
    LessonQuizOut,
    QuestionCreate,
    QuestionOut,
)
from app.services.courses import CourseService, InvalidInputError, NotFoundError, utcnow


def attempt_out(attempt: dict) -> AttemptOut:
    return AttemptOut(
        id=str(attempt["_id"]),
        created_at=attempt["created_at"],
        score=attempt["score"],
        total=attempt["total"],
        percent=round(100 * attempt["score"] / attempt["total"]) if attempt["total"] else 0,
        results=[
            AttemptResult(
                question_id=str(result["question_id"]),
                prompt=result["prompt"],
                options=result["options"],
                choice=result["choice"],
                correct_index=result["correct_index"],
                correct=result["correct"],
                explanation=result.get("explanation", ""),
            )
            for result in attempt["results"]
        ],
    )


class QuizService:
    def __init__(self, database: AsyncDatabase, user: RegisteredUser) -> None:
        self.database = database
        self.user_id = ObjectId(user.id)
        self.courses = CourseService(database, user)
        self.quizzes = QuizRepository(database)

    async def _lesson(self, lesson_id: str) -> tuple[dict, dict]:
        lesson, course = await self.courses.lesson_for_view(lesson_id)
        if not (self.courses.can_manage(course) or await self.courses.can_learn(course)):
            # Same rule as learning: enroll first.
            await self.courses.lesson_for_learning(lesson_id)
        return lesson, course

    def _question_out(self, question: dict) -> QuestionOut:
        mine = question["author_id"] == self.user_id
        return QuestionOut(
            id=str(question["_id"]),
            prompt=question["prompt"],
            options=question["options"],
            mine=mine,
            shared=bool(question.get("shared")),
            correct_index=question["correct_index"] if mine else None,
            explanation=question.get("explanation", "") if mine else None,
        )

    async def lesson_quiz(self, lesson_id: str) -> LessonQuizOut:
        lesson, course = await self._lesson(lesson_id)
        questions = await self.quizzes.visible_questions(self.user_id, lesson["_id"])
        attempts = await self.quizzes.attempts(self.user_id, lesson["_id"], limit=1)
        count = await self.database.quiz_attempts.count_documents({"user_id": self.user_id, "lesson_id": lesson["_id"]})
        return LessonQuizOut(
            lesson_id=str(lesson["_id"]),
            can_author=True,
            can_share=course["type"] == "catalog" and self.courses.is_manager,
            questions=[self._question_out(question) for question in questions],
            attempt_count=count,
            last_attempt=attempt_out(attempts[0]) if attempts else None,
        )

    async def add_question(self, lesson_id: str, data: QuestionCreate) -> QuestionOut:
        lesson, course = await self._lesson(lesson_id)
        question = {
            "lesson_id": lesson["_id"],
            "course_id": course["_id"],
            "author_id": self.user_id,
            "shared": course["type"] == "catalog" and self.courses.is_manager,
            "prompt": data.prompt,
            "options": data.options,
            "correct_index": data.correct_index,
            "explanation": data.explanation,
            "created_at": utcnow(),
        }
        question["_id"] = await self.quizzes.insert_question(question)
        return self._question_out(question)

    async def delete_question(self, question_id: str) -> None:
        object_id = to_object_id(question_id)
        question = await self.quizzes.find_question(object_id) if object_id else None
        if question is None or question["author_id"] != self.user_id:
            raise NotFoundError("Question not found.")
        await self.quizzes.delete_question(question["_id"])

    async def submit(self, lesson_id: str, data: AttemptIn) -> AttemptOut:
        lesson, course = await self._lesson(lesson_id)
        questions = {question["_id"]: question for question in await self.quizzes.visible_questions(self.user_id, lesson["_id"])}
        results = []
        seen: set[ObjectId] = set()
        for answer in data.answers:
            object_id = to_object_id(answer.question_id)
            question = questions.get(object_id) if object_id else None
            if question is None or object_id in seen:
                raise InvalidInputError("Every answer must refer to a different question of this lesson.")
            if answer.choice >= len(question["options"]):
                raise InvalidInputError("The chosen option does not exist.")
            seen.add(object_id)
            results.append({
                "question_id": question["_id"],
                "prompt": question["prompt"],
                "options": question["options"],
                "choice": answer.choice,
                "correct_index": question["correct_index"],
                "correct": answer.choice == question["correct_index"],
                "explanation": question.get("explanation", ""),
            })
        attempt = {
            "user_id": self.user_id,
            "lesson_id": lesson["_id"],
            "course_id": course["_id"],
            "results": results,
            "score": sum(1 for result in results if result["correct"]),
            "total": len(results),
            "created_at": utcnow(),
        }
        attempt["_id"] = await self.quizzes.insert_attempt(attempt)
        return attempt_out(attempt)

    async def history(self, lesson_id: str, limit: int = 10) -> list[AttemptOut]:
        lesson, _ = await self._lesson(lesson_id)
        return [attempt_out(row) for row in await self.quizzes.attempts(self.user_id, lesson["_id"], max(1, min(limit, 50)))]

    async def course_summary(self, course_id: str) -> CourseLearningSummary:
        """Per-lesson review backlog and quiz state for the course page."""
        course = await self.courses.course_for_view(course_id)
        lessons = await self.courses.lessons.list_for_course(course["_id"])
        ids = [lesson["_id"] for lesson in lessons]
        items = await ReplayRepository(self.database).find_items(self.user_id, {"course_id": course["_id"]})
        question_counts = await self.quizzes.question_counts(self.user_id, ids)
        latest = {row["lesson_id"]: row for row in await self.quizzes.latest_attempts(self.user_id) if row["course_id"] == course["_id"]}
        summaries = []
        for lesson in lessons:
            mine = [item for item in items if item["lesson_id"] == lesson["_id"]]
            attempt = latest.get(lesson["_id"])
            summaries.append(LessonLearningSummary(
                lesson_id=str(lesson["_id"]),
                pending_replay=sum(1 for item in mine if item["kind"] == "auto" and item["status"] == "new"),
                reviewed_replay=sum(1 for item in mine if item["kind"] == "auto" and item["status"] == "reviewed"),
                bookmarks=sum(1 for item in mine if item["kind"] == "bookmark"),
                question_count=question_counts.get(lesson["_id"], 0),
                last_quiz_percent=round(100 * attempt["score"] / attempt["total"]) if attempt and attempt["total"] else None,
            ))
        return CourseLearningSummary(
            course_id=str(course["_id"]),
            pending_replay=sum(summary.pending_replay for summary in summaries),
            lessons=summaries,
        )
