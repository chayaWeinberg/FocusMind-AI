"""Small in-process sliding-window limiter for authentication endpoints.

- Login: failed attempts only, per email and per client IP, so a user who
  signs in successfully is never slowed down.
- Registration: per client IP.
State is per process (one Cloud Run instance = one counter); it is a
brute-force brake, not a global quota.
"""

import time
from collections import defaultdict, deque

from app.core.config import settings

LOGIN_FAILURES_PER_EMAIL = (10, 15 * 60)  # attempts, window seconds
LOGIN_FAILURES_PER_IP = (30, 15 * 60)
REGISTRATIONS_PER_IP = (20, 60 * 60)

_events: dict[str, deque[float]] = defaultdict(deque)


def _recent(key: str, window: float, now: float) -> deque[float]:
    events = _events[key]
    while events and now - events[0] > window:
        events.popleft()
    return events


def limited(key: str, rule: tuple[int, int]) -> bool:
    """True when `key` already reached the limit within the window."""
    if not settings.auth_rate_limit_enabled:
        return False
    limit, window = rule
    return len(_recent(key, window, time.monotonic())) >= limit


def record(key: str) -> None:
    if settings.auth_rate_limit_enabled:
        _events[key].append(time.monotonic())


def reset() -> None:
    _events.clear()
