"""ReplayAI rules (pure functions, no database)."""

from app.services.replay_engine import ReplayRules, build_episodes, detect_events, recommend_intervals

RULES = ReplayRules()


class Recorder:
    """Builds segments the way the browser does: video time and session time
    advance together while playing; pauses, seeks and rate changes cut segments."""

    def __init__(self, session: str = "s1") -> None:
        self.session = session
        self.seq = 0
        self.video = 0.0
        self.clock_ms = 0
        self.segments: list[dict] = []

    def play(self, state: str, seconds: float, rate: float = 1.0) -> "Recorder":
        wall_ms = int(seconds * 1000)
        self.segments.append({
            "session_id": self.session, "seq": self.seq,
            "session_start_ms": self.clock_ms, "session_end_ms": self.clock_ms + wall_ms,
            "video_start": self.video, "video_end": round(self.video + seconds * rate, 3),
            "playback_rate": rate, "state": state, "duration_ms": wall_ms,
        })
        self.seq += 1
        self.clock_ms += wall_ms
        self.video = round(self.video + seconds * rate, 3)
        return self

    def pause(self, seconds: float) -> "Recorder":
        self.clock_ms += int(seconds * 1000)
        return self

    def seek(self, position: float) -> "Recorder":
        self.video = position
        self.clock_ms += 300
        return self


def test_no_segments_or_only_neutral_states_give_no_suggestions() -> None:
    assert recommend_intervals([], 600) == []
    calm = Recorder().play("ON_SCREEN", 60).play("UNCERTAIN", 20).play("NOT_MEASURED", 30).play("ON_SCREEN", 40)
    assert recommend_intervals(calm.segments, 600) == []


def test_short_glances_are_ignored() -> None:
    recorder = Recorder().play("ON_SCREEN", 20)
    for _ in range(6):  # many sub-second glances away
        recorder.play("OFF_SCREEN", 0.6).play("ON_SCREEN", 4)
    assert recommend_intervals(recorder.segments, 600) == []


def test_sustained_look_away_with_context_before_and_after() -> None:
    recorder = Recorder().play("ON_SCREEN", 30).play("OFF_SCREEN", 6).play("ON_SCREEN", 30)
    [interval] = recommend_intervals(recorder.segments, 600)
    assert interval.reasons == {"sustained_off_screen": 1}
    assert (interval.start, interval.end) == (30 - RULES.context_before_seconds, 36 + RULES.context_after_seconds)
    assert interval.off_screen_ms == 6000


def test_look_away_split_by_one_uncertain_tick_is_one_episode() -> None:
    recorder = Recorder().play("ON_SCREEN", 10).play("OFF_SCREEN", 2.5).play("UNCERTAIN", 0.5).play("OFF_SCREEN", 2.5)
    [episode] = build_episodes(recorder.segments, "OFF_SCREEN")
    assert episode.wall_ms == 5000
    [interval] = recommend_intervals(recorder.segments, 600)
    assert interval.reasons == {"sustained_off_screen": 1}


def test_repeated_look_aways_in_a_short_window() -> None:
    recorder = Recorder().play("ON_SCREEN", 40)
    for _ in range(3):
        recorder.play("OFF_SCREEN", 1.5).play("ON_SCREEN", 6)
    [interval] = recommend_intervals(recorder.segments, 600)
    assert interval.reasons == {"repeated_off_screen": 3}
    assert interval.event_count == 3
    assert interval.start == 35  # first look-away at 40 s minus 5 s context


def test_repeated_look_aways_spread_out_are_not_suggested() -> None:
    recorder = Recorder().play("ON_SCREEN", 10)
    for _ in range(3):
        recorder.play("OFF_SCREEN", 1.5).play("ON_SCREEN", 40)
    assert recommend_intervals(recorder.segments, 600) == []


def test_face_absent_is_its_own_reason() -> None:
    recorder = Recorder().play("ON_SCREEN", 100).play("FACE_ABSENT", 8).play("ON_SCREEN", 10)
    [interval] = recommend_intervals(recorder.segments, 600)
    assert interval.reasons == {"face_absent": 1}
    assert interval.face_absent_ms == 8000 and interval.off_screen_ms == 0


def test_intervals_are_clamped_to_the_video_duration() -> None:
    start = Recorder().play("OFF_SCREEN", 5).play("ON_SCREEN", 20)
    [first] = recommend_intervals(start.segments, 25)
    assert first.start == 0  # context cannot go before 0
    end = Recorder().play("ON_SCREEN", 55).play("OFF_SCREEN", 5)
    [last] = recommend_intervals(end.segments, 60)
    assert last.end == 60  # context cannot go past the end


def test_unknown_duration_uses_the_furthest_recorded_position() -> None:
    recorder = Recorder().play("ON_SCREEN", 20).play("OFF_SCREEN", 5)
    [interval] = recommend_intervals(recorder.segments, None)
    assert interval.end == 25


def test_nearby_events_are_merged_into_one_suggestion() -> None:
    recorder = Recorder().play("ON_SCREEN", 30).play("OFF_SCREEN", 5).play("ON_SCREEN", 8).play("FACE_ABSENT", 6)
    [interval] = recommend_intervals(recorder.segments, 600)
    assert interval.reasons == {"sustained_off_screen": 1, "face_absent": 1}
    assert interval.event_count == 2


def test_distant_events_stay_separate() -> None:
    recorder = Recorder().play("ON_SCREEN", 10).play("OFF_SCREEN", 5).play("ON_SCREEN", 120).play("OFF_SCREEN", 5)
    intervals = recommend_intervals(recorder.segments, 600)
    assert len(intervals) == 2
    assert intervals[0].end < intervals[1].start


def test_pause_while_looking_away_splits_the_episode() -> None:
    # 2 s away, a 30 s pause, then 2 s away: neither part is sustained.
    recorder = Recorder().play("ON_SCREEN", 10).play("OFF_SCREEN", 2).pause(30).play("OFF_SCREEN", 2).play("ON_SCREEN", 10)
    assert len(build_episodes(recorder.segments, "OFF_SCREEN")) == 2
    assert [event.reason for event in detect_events(recorder.segments, RULES)] == []


def test_seek_uses_video_time_not_session_time() -> None:
    # Watch 0-20 s, jump to 300 s, look away there. The suggestion is at 300 s
    # of video even though only ~20 s of session time had passed.
    recorder = Recorder().play("ON_SCREEN", 20).seek(300).play("OFF_SCREEN", 5).play("ON_SCREEN", 10)
    [interval] = recommend_intervals(recorder.segments, 600)
    assert interval.start == 295 and interval.end == 308


def test_seek_inside_a_look_away_does_not_join_the_two_parts() -> None:
    recorder = Recorder().play("OFF_SCREEN", 3).seek(200).play("OFF_SCREEN", 3)
    assert len(build_episodes(recorder.segments, "OFF_SCREEN")) == 2
    assert recommend_intervals(recorder.segments, 600) == []


def test_fast_playback_threshold_is_wall_time_and_interval_is_video_time() -> None:
    # 4 s away at 2x covers 8 s of video.
    recorder = Recorder().play("ON_SCREEN", 10, rate=2).play("OFF_SCREEN", 4, rate=2).play("ON_SCREEN", 5, rate=2)
    [interval] = recommend_intervals(recorder.segments, 600)
    assert interval.start == 20 - 5 and interval.end == 28 + 3
    slow = Recorder().play("ON_SCREEN", 10, rate=2).play("OFF_SCREEN", 3, rate=2)  # 6 s of video, 3 s of wall time
    assert recommend_intervals(slow.segments, 600) == []


def test_replayed_section_and_multiple_sessions_merge_without_duplicates() -> None:
    first = Recorder("s1").play("ON_SCREEN", 50).play("OFF_SCREEN", 5).play("ON_SCREEN", 10)
    # Same session: rewinds and looks away again over the same range.
    first.seek(48).play("OFF_SCREEN", 6)
    second = Recorder("s2").seek(51).play("OFF_SCREEN", 5)
    intervals = recommend_intervals(first.segments + second.segments, 600)
    assert len(intervals) == 1
    assert intervals[0].reasons == {"sustained_off_screen": 3}
    assert intervals[0].session_ids == {"s1", "s2"}


def test_repeated_interruptions_are_detected_and_seeks_are_not_interruptions() -> None:
    recorder = Recorder().play("ON_SCREEN", 10)
    for _ in range(3):
        recorder.pause(5).play("ON_SCREEN", 8)
    [interval] = recommend_intervals(recorder.segments, 600)
    assert interval.reasons == {"interruptions": 3}

    seeking = Recorder().play("ON_SCREEN", 10)
    for position in (100, 200, 300):
        seeking.seek(position).pause(5).play("ON_SCREEN", 8)
    assert recommend_intervals(seeking.segments, 600) == []


def test_thresholds_are_configurable() -> None:
    recorder = Recorder().play("ON_SCREEN", 10).play("OFF_SCREEN", 3).play("ON_SCREEN", 10)
    assert recommend_intervals(recorder.segments, 600) == []
    strict = ReplayRules(sustained_off_screen_seconds=2.5)
    assert len(recommend_intervals(recorder.segments, 600, strict)) == 1


def test_invalid_segments_are_ignored() -> None:
    broken = [
        {"session_id": "s", "seq": 0, "session_start_ms": 0, "session_end_ms": 9000, "video_start": 10, "video_end": 2,
         "playback_rate": 1, "state": "OFF_SCREEN", "duration_ms": 9000},
        {"session_id": "s", "seq": 1, "session_start_ms": 0, "session_end_ms": 9000, "video_start": None, "video_end": 9,
         "playback_rate": 1, "state": "OFF_SCREEN", "duration_ms": 9000},
    ]
    assert recommend_intervals(broken, 600) == []
