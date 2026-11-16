"""ReplayAI: which stretches of a lesson video may be worth reviewing.

Pure functions (no database), so every rule is unit-tested directly.

Input: the attention segments recorded for one user and one lesson, from any
number of learning sessions. Each segment has one attention state and a
contiguous range of *video* time (``video_start``..``video_end``, seconds in
the media) plus the *session* time it was recorded at. The browser cuts a
segment on every state change, seek, pause, buffering and playback-rate
change, so a segment's video range is always continuous playback.

Replay timestamps are taken only from video time. Session time is used only
to tell how long something lasted for the learner (wall time) and to detect
pauses; it is never turned into a position in the video.

Rules (all thresholds configurable, see ``ReplayRules``):

1. Sustained look-away: one OFF_SCREEN episode lasting at least
   ``sustained_off_screen_seconds`` of wall time.
2. Repeated look-aways: at least ``repeated_count`` OFF_SCREEN episodes, each
   at least ``glance_seconds`` long, within ``repeated_window_seconds`` of
   video time in one session. Shorter glances are ignored entirely, so normal
   eye movement does not produce suggestions.
3. Face not visible: one FACE_ABSENT episode of at least
   ``face_absent_seconds`` (kept as its own reason: leaving the desk is not
   the same as looking away).
4. Repeated interruptions: at least ``interruption_count`` pauses or buffering
   stops (playback resumed at the same point after at least
   ``interruption_min_gap_seconds``) within ``interruption_window_seconds`` of
   video time in one session. Seeks are not interruptions.

UNCERTAIN and NOT_MEASURED never count as anything: they only separate
episodes. ON_SCREEN is not treated as proof of concentration either; it is
simply not an event.

Every event becomes an interval with context before/after, clamped to the
video duration. Overlapping or nearby intervals (also from different
sessions, e.g. a replayed section) are merged into one suggestion that keeps
per-reason counts.
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field

REASONS = ("sustained_off_screen", "repeated_off_screen", "face_absent", "interruptions")

# Consecutive segments of one state belong to one episode when they are this
# close in video time and in session time (a short UNCERTAIN tick or a
# 60-second segment cut must not split a look-away in two).
EPISODE_JOIN_GAP_SECONDS = 1.5
# A resume this close to where playback stopped is a pause, not a seek.
RESUME_TOLERANCE_SECONDS = 1.5


@dataclass(frozen=True)
class ReplayRules:
    sustained_off_screen_seconds: float = 4.0
    glance_seconds: float = 1.0
    repeated_count: int = 3
    repeated_window_seconds: float = 30.0
    face_absent_seconds: float = 5.0
    interruption_count: int = 3
    interruption_window_seconds: float = 60.0
    interruption_min_gap_seconds: float = 2.0
    context_before_seconds: float = 5.0
    context_after_seconds: float = 3.0
    merge_gap_seconds: float = 5.0
    min_interval_seconds: float = 4.0

    def as_dict(self) -> dict[str, float]:
        return {name: getattr(self, name) for name in self.__dataclass_fields__}


@dataclass
class Episode:
    state: str
    session_id: object
    video_start: float
    video_end: float
    wall_ms: int
    session_start_ms: int
    session_end_ms: int


@dataclass
class Event:
    reason: str
    session_id: object
    video_start: float
    video_end: float
    count: int = 1
    off_screen_ms: int = 0
    face_absent_ms: int = 0


@dataclass
class ReplayInterval:
    start: float
    end: float
    reasons: dict[str, int] = field(default_factory=dict)
    event_count: int = 0
    session_ids: set = field(default_factory=set)
    off_screen_ms: int = 0
    face_absent_ms: int = 0

    @property
    def duration(self) -> float:
        return self.end - self.start


def _valid(segment: dict) -> bool:
    try:
        start, end = float(segment["video_start"]), float(segment["video_end"])
        duration = int(segment["duration_ms"])
    except (KeyError, TypeError, ValueError):
        return False
    return 0 <= start <= end and duration > 0


def build_episodes(segments: Iterable[dict], state: str) -> list[Episode]:
    """Joins consecutive segments of ``state`` (per session) into episodes."""
    by_session: dict[object, list[dict]] = defaultdict(list)
    for segment in segments:
        if segment.get("state") == state and _valid(segment):
            by_session[segment["session_id"]].append(segment)

    episodes: list[Episode] = []
    for session_id, items in by_session.items():
        items.sort(key=lambda item: (item["session_start_ms"], item.get("seq", 0)))
        current: Episode | None = None
        for item in items:
            video_gap = item["video_start"] - current.video_end if current else None
            wall_gap = (item["session_start_ms"] - current.session_end_ms) / 1000 if current else None
            if (
                current is not None
                and -0.05 <= video_gap <= EPISODE_JOIN_GAP_SECONDS
                and 0 <= wall_gap <= EPISODE_JOIN_GAP_SECONDS
            ):
                current.video_end = max(current.video_end, item["video_end"])
                current.wall_ms += item["duration_ms"]
                current.session_end_ms = item["session_end_ms"]
                continue
            if current is not None:
                episodes.append(current)
            current = Episode(
                state=state,
                session_id=session_id,
                video_start=float(item["video_start"]),
                video_end=float(item["video_end"]),
                wall_ms=int(item["duration_ms"]),
                session_start_ms=int(item["session_start_ms"]),
                session_end_ms=int(item["session_end_ms"]),
            )
        if current is not None:
            episodes.append(current)
    return episodes


def _windowed(points: list, position, window: float, minimum: int) -> list[list]:
    """Greedy clusters of at least ``minimum`` points within ``window``."""
    clusters: list[list] = []
    index = 0
    while index < len(points):
        last = index
        while last + 1 < len(points) and position(points[last + 1]) - position(points[index]) <= window:
            last += 1
        if last - index + 1 >= minimum:
            clusters.append(points[index : last + 1])
            index = last + 1
        else:
            index += 1
    return clusters


def detect_events(segments: list[dict], rules: ReplayRules) -> list[Event]:
    events: list[Event] = []

    off_screen = build_episodes(segments, "OFF_SCREEN")
    short: dict[object, list[Episode]] = defaultdict(list)
    for episode in off_screen:
        if episode.wall_ms >= rules.sustained_off_screen_seconds * 1000:
            events.append(Event(
                "sustained_off_screen", episode.session_id, episode.video_start, episode.video_end,
                off_screen_ms=episode.wall_ms,
            ))
        elif episode.wall_ms >= rules.glance_seconds * 1000:
            short[episode.session_id].append(episode)
    for session_id, episodes in short.items():
        episodes.sort(key=lambda item: item.video_start)
        for cluster in _windowed(episodes, lambda item: item.video_start, rules.repeated_window_seconds, rules.repeated_count):
            events.append(Event(
                "repeated_off_screen", session_id,
                min(item.video_start for item in cluster), max(item.video_end for item in cluster),
                count=len(cluster), off_screen_ms=sum(item.wall_ms for item in cluster),
            ))

    for episode in build_episodes(segments, "FACE_ABSENT"):
        if episode.wall_ms >= rules.face_absent_seconds * 1000:
            events.append(Event(
                "face_absent", episode.session_id, episode.video_start, episode.video_end,
                face_absent_ms=episode.wall_ms,
            ))

    events.extend(_interruptions(segments, rules))
    return events


def _interruptions(segments: list[dict], rules: ReplayRules) -> list[Event]:
    by_session: dict[object, list[dict]] = defaultdict(list)
    for segment in segments:
        if _valid(segment):
            by_session[segment["session_id"]].append(segment)
    events: list[Event] = []
    for session_id, items in by_session.items():
        items.sort(key=lambda item: (item["session_start_ms"], item.get("seq", 0)))
        stops: list[float] = []
        for previous, following in zip(items, items[1:]):
            paused_for = (following["session_start_ms"] - previous["session_end_ms"]) / 1000
            resumed_in_place = abs(following["video_start"] - previous["video_end"]) <= RESUME_TOLERANCE_SECONDS
            if paused_for >= rules.interruption_min_gap_seconds and resumed_in_place:
                stops.append(float(previous["video_end"]))
        stops.sort()
        for cluster in _windowed(stops, lambda value: value, rules.interruption_window_seconds, rules.interruption_count):
            events.append(Event("interruptions", session_id, cluster[0], cluster[-1], count=len(cluster)))
    return events


def recommend_intervals(
    segments: list[dict], duration_seconds: float | None, rules: ReplayRules | None = None
) -> list[ReplayInterval]:
    """Review intervals for one lesson, sorted by start, merged and clamped."""
    rules = rules or ReplayRules()
    valid = [segment for segment in segments if _valid(segment)]
    if not valid:
        return []
    observed_end = max(segment["video_end"] for segment in valid)
    limit = float(duration_seconds) if duration_seconds and duration_seconds > 0 else observed_end
    if limit <= 0:
        return []

    raw: list[ReplayInterval] = []
    for event in detect_events(valid, rules):
        start = max(0.0, event.video_start - rules.context_before_seconds)
        end = min(limit, event.video_end + rules.context_after_seconds)
        if end - start < rules.min_interval_seconds:
            end = min(limit, start + rules.min_interval_seconds)
            start = max(0.0, end - rules.min_interval_seconds)
        if end <= start:
            continue
        raw.append(ReplayInterval(
            start=start, end=end, reasons={event.reason: event.count}, event_count=event.count,
            session_ids={event.session_id}, off_screen_ms=event.off_screen_ms, face_absent_ms=event.face_absent_ms,
        ))

    raw.sort(key=lambda item: (item.start, item.end))
    merged: list[ReplayInterval] = []
    for interval in raw:
        last = merged[-1] if merged else None
        if last is not None and interval.start <= last.end + rules.merge_gap_seconds:
            last.end = max(last.end, interval.end)
            for reason, count in interval.reasons.items():
                last.reasons[reason] = last.reasons.get(reason, 0) + count
            last.event_count += interval.event_count
            last.session_ids |= interval.session_ids
            last.off_screen_ms += interval.off_screen_ms
            last.face_absent_ms += interval.face_absent_ms
        else:
            merged.append(interval)
    for interval in merged:
        interval.start = round(interval.start, 2)
        interval.end = round(interval.end, 2)
    return merged


def overlap_seconds(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    return max(0.0, min(a_end, b_end) - max(a_start, b_start))
