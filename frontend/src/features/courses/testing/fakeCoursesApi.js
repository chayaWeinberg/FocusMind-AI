// In-memory stand-in for the courses API, used by frontend tests through a
// mocked `fetch`. It mirrors the server's response shapes (camelCase) and its
// completion rule (ended or >= 90 % of the duration).

let counter = 0;
const nextId = (prefix) => `${prefix}${(counter += 1).toString(16).padStart(6, '0')}`;

function json(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

export function createFakeCoursesApi({ user = { id: 'u1', displayName: 'נועה', email: 'noa@example.com' } } = {}) {
  const courses = new Map();
  const lessons = new Map();
  const progress = new Map(); // lessonId -> progress
  const enrolled = new Set();
  const requests = [];
  const sessions = new Map();
  const replayItems = new Map(); // id -> item (camelCase, like the server)
  const questions = new Map();
  const attempts = [];
  let preferences = { studyMinutes: 25, breakMinutes: 5, breakReminders: true };
  let goal = null;
  let insights = null; // tests may set a full insights payload
  let coachTips = [];

  const lessonsOf = (courseId) => [...lessons.values()]
    .filter((lesson) => lesson.courseId === courseId)
    .sort((a, b) => a.order - b.order);

  function courseProgress(courseId) {
    const items = lessonsOf(courseId);
    const completed = items.filter((lesson) => progress.get(lesson.id)?.completed).length;
    const next = items.find((lesson) => !progress.get(lesson.id)?.completed) || items.at(-1);
    return {
      completedLessons: completed,
      totalLessons: items.length,
      percent: items.length ? Math.round((100 * completed) / items.length) : 0,
      continueLessonId: next?.id ?? null,
    };
  }

  const lessonOut = (lesson) => ({ ...lesson, progress: progress.get(lesson.id) ?? null });
  const canLearn = (course) => course.type === 'personal' || enrolled.has(course.id);

  function courseOut(course) {
    return {
      ...course,
      isOwner: course.type === 'personal',
      enrolled: course.type === 'catalog' && enrolled.has(course.id),
      lessonCount: lessonsOf(course.id).length,
      progress: courseProgress(course.id),
    };
  }

  const detail = (course) => ({
    ...courseOut(course),
    lessons: lessonsOf(course.id).map(lessonOut),
    canEdit: course.type === 'personal',
    canLearn: canLearn(course),
  });

  function videoFromUrl(url) {
    if (/youtu/.test(url)) {
      return { sourceType: 'external', provider: 'youtube', url, embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0', trackable: false };
    }
    if (!/^https:\/\/.+\.(mp4|webm)$/.test(url)) return null;
    return { sourceType: 'external', provider: 'direct', url, embedUrl: null, trackable: true };
  }

  function emptyInsights() {
    const days = Array.from({ length: 14 }, (_, index) => ({ date: `2026-11-${String(index + 1).padStart(2, '0')}`, activeMs: 0 }));
    const weeks = Array.from({ length: 8 }, (_, index) => ({
      weekStart: `2026-09-${String(index * 3 + 1).padStart(2, '0')}`, activeMs: 0, onScreenMs: 0, measuredMs: 0,
    }));
    return {
      totals: {
        activeMs: 0, breakMs: 0, videoSeconds: 0, sessionCount: 0, lessonsCompleted: 0,
        lessonsCompletedThisWeek: 0, activeMsToday: 0, activeMsThisWeek: 0,
      },
      daily: days,
      weekly: weeks,
      byCourse: [],
      attention: { ON_SCREEN: 0, OFF_SCREEN: 0, FACE_ABSENT: 0, UNCERTAIN: 0, NOT_MEASURED: 0 },
      replay: { suggested: 0, pending: 0, reviewed: 0, dismissed: 0, bookmarks: 0, bookmarksPending: 0 },
      quizzes: { attempts: 0, averagePercent: null },
      streak: { current: 0, longest: 0, activeToday: false },
      recentSessions: [],
    };
  }

  function studyPlan() {
    if (!goal) return { goal: null, progress: null, unfinishedLessons: [], pendingReplay: [], suggestedSession: null };
    const items = lessonsOf(goal.courseId);
    const unfinished = items.filter((lesson) => !progress.get(lesson.id)?.completed).map((lesson) => {
      const position = progress.get(lesson.id)?.positionSeconds || 0;
      return {
        lessonId: lesson.id, title: lesson.title, order: lesson.order, hasVideo: lesson.video.sourceType !== 'none',
        trackable: Boolean(lesson.video.trackable), durationSeconds: lesson.durationSeconds, positionSeconds: position,
        remainingSeconds: lesson.durationSeconds ? lesson.durationSeconds - position : null, pendingReplay: 0,
      };
    });
    const first = unfinished.find((lesson) => lesson.hasVideo);
    const done = items.length - unfinished.length;
    return {
      goal,
      progress: {
        completedLessons: done, totalLessons: items.length, percent: items.length ? Math.round((100 * done) / items.length) : 0,
        weeklyTargetMinutes: goal.weeklyMinutes ?? null, weeklyDoneMinutes: 0, targetDate: goal.targetDate ?? null,
        daysLeft: null, lessonsPerWeekNeeded: null,
      },
      unfinishedLessons: unfinished,
      pendingReplay: [],
      suggestedSession: first ? {
        budgetSeconds: goal.sessionMinutes * 60, plannedSeconds: first.remainingSeconds ?? 0,
        hasUnknownDurations: first.remainingSeconds === null, exceedsBudget: false,
        steps: [{
          type: first.positionSeconds ? 'continue' : 'lesson', lessonId: first.lessonId, lessonTitle: first.title,
          itemId: null, startSeconds: null, seconds: first.remainingSeconds,
        }],
      } : null,
    };
  }

  const api = {
    user,
    courses,
    lessons,
    progress,
    requests,
    sessions,
    replayItems,
    questions,
    attempts,
    setInsights(value) { insights = value; },
    setCoachTips(value) { coachTips = value; },
    get preferences() { return preferences; },
    get goal() { return goal; },
    addReplayItem(fields) {
      const id = nextId('r');
      const lesson = lessons.get(fields.lessonId);
      const item = {
        id, kind: 'auto', status: 'new', reasons: { sustained_off_screen: 1 }, eventCount: 1, sessionCount: 1,
        offScreenSeconds: 6, faceAbsentSeconds: 0, note: '', reopened: false, endSeconds: null,
        createdAt: '2026-11-14T10:00:00Z', updatedAt: '2026-11-14T10:00:00Z', reviewedAt: null,
        courseId: lesson?.courseId, lessonTitle: lesson?.title, courseTitle: courses.get(lesson?.courseId)?.title,
        ...fields,
      };
      replayItems.set(id, item);
      return item;
    },
    addQuestion(lessonId, fields) {
      const id = nextId('q');
      const question = { id, lessonId, prompt: 'שאלה', options: ['א', 'ב'], correctIndex: 0, explanation: '', mine: true, shared: false, ...fields };
      questions.set(id, question);
      return question;
    },
    addCourse(fields) {
      const id = nextId('c');
      const now = '2026-11-14T10:00:00Z';
      const course = { id, title: 'קורס', description: '', category: '', type: 'personal', status: 'published', createdAt: now, updatedAt: now, ...fields };
      courses.set(id, course);
      return course;
    },
    addLesson(courseId, fields = {}) {
      const id = nextId('l');
      const lesson = {
        id,
        courseId,
        title: 'שיעור',
        description: '',
        order: lessonsOf(courseId).length,
        durationSeconds: null,
        video: { sourceType: 'none', trackable: false },
        ...fields,
      };
      lessons.set(id, lesson);
      return lesson;
    },
    enroll(courseId) {
      enrolled.add(courseId);
    },
    lastBody(method, pattern) {
      const match = [...requests].reverse().find((item) => item.method === method && pattern.test(item.url));
      return match ? match.body : undefined;
    },
    async fetch(url, options = {}) {
      const method = options.method || 'GET';
      const body = options.body ? JSON.parse(options.body) : undefined;
      requests.push({ method, url, body, keepalive: options.keepalive });
      const path = url.split('?')[0];
      const params = new URLSearchParams(url.split('?')[1] || '');
      let match;

      if (path === '/api/auth/me') return json(200, user);
      if (path === '/api/courses/mine') {
        return json(200, [...courses.values()]
          .filter((course) => course.type === 'personal' || enrolled.has(course.id))
          .map(courseOut));
      }
      if (path === '/api/courses/catalog/categories') {
        return json(200, [...new Set([...courses.values()].filter((c) => c.type === 'catalog').map((c) => c.category))].sort());
      }
      if (path === '/api/courses/catalog') {
        const q = (params.get('q') || '').toLowerCase();
        const category = params.get('category');
        return json(200, [...courses.values()]
          .filter((course) => course.type === 'catalog')
          .filter((course) => !q || `${course.title} ${course.description}`.toLowerCase().includes(q))
          .filter((course) => !category || course.category === category)
          .map(courseOut));
      }
      if (path === '/api/courses' && method === 'POST') {
        if (!body.title || body.title.length < 2) return json(422, { detail: [] });
        return json(201, detail(api.addCourse({ ...body, type: 'personal' })));
      }
      if ((match = path.match(/^\/api\/courses\/([^/]+)\/enroll$/))) {
        const course = courses.get(match[1]);
        const created = !enrolled.has(course.id);
        enrolled.add(course.id);
        return json(created ? 201 : 200, detail(course));
      }
      if ((match = path.match(/^\/api\/courses\/([^/]+)\/lessons\/order$/))) {
        body.lessonIds.forEach((id, index) => { lessons.get(id).order = index; });
        return json(200, detail(courses.get(match[1])));
      }
      if ((match = path.match(/^\/api\/courses\/([^/]+)\/lessons$/))) {
        let video = { sourceType: 'none', trackable: false };
        if (body.externalUrl) {
          video = videoFromUrl(body.externalUrl);
          if (!video) return json(422, { detail: 'Unsupported link. Use a direct link to a video file (.mp4 or .webm) or a YouTube video link.' });
        }
        return json(201, lessonOut(api.addLesson(match[1], { title: body.title, description: body.description || '', video })));
      }
      if ((match = path.match(/^\/api\/courses\/([^/]+)$/))) {
        const course = courses.get(match[1]);
        if (!course) return json(404, { detail: 'Course not found.' });
        if (method === 'PATCH') {
          Object.assign(course, body);
          return json(200, detail(course));
        }
        if (method === 'DELETE') {
          courses.delete(course.id);
          return json(204, null);
        }
        return json(200, detail(course));
      }
      if ((match = path.match(/^\/api\/lessons\/([^/]+)\/video-url$/))) {
        const lesson = lessons.get(match[1]);
        const video = videoFromUrl(body.url);
        if (!video) return json(422, { detail: 'Only secure https links are supported.' });
        lesson.video = video;
        return json(200, lessonOut(lesson));
      }
      if ((match = path.match(/^\/api\/lessons\/([^/]+)\/progress$/))) {
        const lesson = lessons.get(match[1]);
        const course = courses.get(lesson.courseId);
        if (!canLearn(course)) return json(403, { detail: 'Enroll in the course to learn this lesson.' });
        const previous = progress.get(lesson.id);
        const duration = body.durationSeconds || lesson.durationSeconds;
        const complete = previous?.completed || body.ended || (duration && body.positionSeconds >= 0.9 * duration);
        const saved = {
          positionSeconds: body.positionSeconds,
          durationSeconds: duration ?? null,
          completed: Boolean(complete),
          completedAt: complete ? previous?.completedAt || '2026-11-14T10:05:00Z' : null,
          updatedAt: '2026-11-14T10:05:00Z',
        };
        progress.set(lesson.id, saved);
        return json(200, saved);
      }
      if ((match = path.match(/^\/api\/lessons\/([^/]+)\/complete$/))) {
        const lesson = lessons.get(match[1]);
        if (lesson.video.trackable) return json(409, { detail: 'This lesson is completed automatically when the video is watched to the end.' });
        const saved = { positionSeconds: 0, durationSeconds: null, completed: true, completedAt: '2026-11-14T10:05:00Z', updatedAt: '2026-11-14T10:05:00Z' };
        progress.set(lesson.id, saved);
        return json(200, saved);
      }
      if ((match = path.match(/^\/api\/lessons\/([^/]+)$/))) {
        const lesson = lessons.get(match[1]);
        if (!lesson) return json(404, { detail: 'Lesson not found.' });
        if (method === 'PATCH') {
          Object.assign(lesson, body);
          return json(200, lessonOut(lesson));
        }
        if (method === 'DELETE') {
          lessons.delete(lesson.id);
          return json(204, null);
        }
        const course = courses.get(lesson.courseId);
        const siblings = lessonsOf(course.id);
        const index = siblings.findIndex((item) => item.id === lesson.id);
        return json(200, {
          lesson: lessonOut(lesson),
          course: { id: course.id, title: course.title, type: course.type, canEdit: course.type === 'personal' },
          previousLessonId: siblings[index - 1]?.id ?? null,
          nextLessonId: siblings[index + 1]?.id ?? null,
          lessonNumber: index + 1,
          lessonTotal: siblings.length,
          canLearn: canLearn(course),
        });
      }

      // --- learning features ---------------------------------------------
      if (path === '/api/me/preferences') {
        if (method === 'PUT') preferences = { ...body };
        return json(200, preferences);
      }
      if (path === '/api/insights') return json(200, insights ?? emptyInsights());
      if (path === '/api/coach') return json(200, coachTips);
      if (path === '/api/study/plan') return json(200, studyPlan());
      if (path === '/api/study/goal') {
        if (method === 'PUT') {
          const course = courses.get(body.courseId);
          goal = { ...body, courseTitle: course.title, updatedAt: '2026-11-14T10:00:00Z' };
          return json(200, goal);
        }
        if (method === 'DELETE') {
          goal = null;
          return json(204, null);
        }
        return json(200, goal);
      }
      if (path === '/api/replay') {
        const status = params.get('status');
        const courseId = params.get('courseId');
        return json(200, [...replayItems.values()]
          .filter((item) => !status || status === 'all' || (status === 'pending' ? item.status === 'new' : item.status === status))
          .filter((item) => !courseId || item.courseId === courseId));
      }
      if ((match = path.match(/^\/api\/replay\/([^/]+)$/))) {
        const item = replayItems.get(match[1]);
        if (!item) return json(404, { detail: 'Replay item not found.' });
        if (method === 'DELETE') {
          replayItems.delete(item.id);
          return json(204, null);
        }
        Object.assign(item, { status: body.status, reopened: false, reviewedAt: body.status === 'reviewed' ? '2026-11-14T11:00:00Z' : item.reviewedAt });
        return json(200, { ...item });
      }
      if ((match = path.match(/^\/api\/lessons\/([^/]+)\/replay$/))) {
        const lesson = lessons.get(match[1]);
        return json(200, {
          lessonId: lesson.id,
          trackable: Boolean(lesson.video.trackable),
          durationSeconds: lesson.durationSeconds,
          analyzedSegments: 0,
          items: lesson.video.trackable
            ? [...replayItems.values()].filter((item) => item.lessonId === lesson.id).sort((a, b) => a.startSeconds - b.startSeconds)
            : [],
          rules: {},
        });
      }
      if ((match = path.match(/^\/api\/lessons\/([^/]+)\/bookmarks$/))) {
        return json(201, api.addReplayItem({
          lessonId: match[1], kind: 'bookmark', reasons: {}, eventCount: 0, sessionCount: 0, offScreenSeconds: 0, ...body,
        }));
      }
      if ((match = path.match(/^\/api\/lessons\/([^/]+)\/quiz$/))) {
        const lessonQuestions = [...questions.values()].filter((question) => question.lessonId === match[1]);
        const mine = attempts.filter((attempt) => attempt.lessonId === match[1]);
        return json(200, {
          lessonId: match[1], canAuthor: true, canShare: false,
          questions: lessonQuestions.map(({ lessonId: _lesson, ...question }) => question),
          attemptCount: mine.length, lastAttempt: mine.at(-1) ?? null,
        });
      }
      if ((match = path.match(/^\/api\/lessons\/([^/]+)\/quiz\/questions$/))) {
        return json(201, api.addQuestion(match[1], body));
      }
      if ((match = path.match(/^\/api\/quiz\/questions\/([^/]+)$/))) {
        questions.delete(match[1]);
        return json(204, null);
      }
      if ((match = path.match(/^\/api\/lessons\/([^/]+)\/quiz\/attempts$/))) {
        const results = body.answers.map((answer) => {
          const question = questions.get(answer.questionId);
          return {
            questionId: question.id, prompt: question.prompt, options: question.options, choice: answer.choice,
            correctIndex: question.correctIndex, correct: answer.choice === question.correctIndex, explanation: question.explanation,
          };
        });
        const score = results.filter((result) => result.correct).length;
        const attempt = {
          id: nextId('a'), lessonId: match[1], createdAt: '2026-11-14T10:10:00Z',
          score, total: results.length, percent: Math.round((100 * score) / results.length), results,
        };
        attempts.push(attempt);
        return json(201, attempt);
      }
      if ((match = path.match(/^\/api\/courses\/([^/]+)\/learning-summary$/))) {
        const all = [...replayItems.values()];
        return json(200, {
          courseId: match[1],
          pendingReplay: all.filter((item) => item.courseId === match[1] && item.status === 'new').length,
          lessons: lessonsOf(match[1]).map((lesson) => ({
            lessonId: lesson.id,
            pendingReplay: all.filter((item) => item.lessonId === lesson.id && item.kind === 'auto' && item.status === 'new').length,
            reviewedReplay: 0,
            bookmarks: all.filter((item) => item.lessonId === lesson.id && item.kind === 'bookmark').length,
            questionCount: [...questions.values()].filter((question) => question.lessonId === lesson.id).length,
            lastQuizPercent: null,
          })),
        });
      }
      if ((match = path.match(/^\/api\/learning-sessions\/([^/]+)\/heartbeat$/))) {
        sessions.get(match[1]).heartbeat = body;
        return json(200, { id: match[1], activeMs: body.activeMs, breakMs: body.breakMs });
      }
      if (path === '/api/learning-sessions' && method === 'POST') {
        const id = nextId('s');
        sessions.set(id, { id, lessonId: body.lessonId, segments: [], ended: null });
        return json(201, { id, lessonId: body.lessonId });
      }
      if ((match = path.match(/^\/api\/learning-sessions\/([^/]+)\/segments$/))) {
        sessions.get(match[1]).segments.push(...body.segments);
        return json(200, { accepted: body.segments.length });
      }
      if ((match = path.match(/^\/api\/learning-sessions\/([^/]+)\/end$/))) {
        sessions.get(match[1]).ended = body.activeMs;
        sessions.get(match[1]).endBody = body;
        return json(200, { id: match[1] });
      }
      return json(404, { detail: 'Not found' });
    },
  };
  return api;
}
