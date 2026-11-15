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

  const api = {
    user,
    courses,
    lessons,
    progress,
    requests,
    sessions,
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
        return json(200, { id: match[1] });
      }
      return json(404, { detail: 'Not found' });
    },
  };
  return api;
}
