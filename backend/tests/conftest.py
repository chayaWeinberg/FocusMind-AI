"""Shared test configuration.

Unit tests never touch a real database: they replace the ``get_db`` dependency
with an in-memory fake. Integration tests (``tests/integration``) talk to a
real MongoDB and are skipped automatically when none is reachable.

Settings are resolved in this order, so local runs reuse the developer's .env
(including MongoDB credentials) while CI works with no .env at all:
real environment variables > .env files > the safe defaults below.
"""

import os

from dotenv import dotenv_values

from app.core.config import ENV_FILES  # noqa: E402  (does not instantiate Settings)

_TEST_DEFAULTS = {
    "MONGO_URI": "mongodb://localhost:27017",
    "MONGO_DB_NAME": "focusmind_test",
    "SECRET_KEY": "test-signing-key-with-at-least-32-bytes",
    "CORS_ORIGINS": '["http://localhost:3000"]',
}

_file_keys = {
    key.upper()
    for env_file in ENV_FILES
    if env_file.is_file()
    for key in dotenv_values(env_file)
}

for _key, _value in _TEST_DEFAULTS.items():
    if _key not in os.environ and _key not in _file_keys:
        os.environ[_key] = _value

# Always test the development cookie behaviour and keep hashing fast.
# Tests that need production behaviour patch ``settings.environment`` locally.
os.environ["ENV"] = "development"
os.environ["BCRYPT_ROUNDS"] = "4"
# The brute-force limiter has its own test (tests/test_rate_limit.py).
os.environ["AUTH_RATE_LIMIT_ENABLED"] = "false"

# Settings may already exist at this point (imported above); disable the
# limiter on the instance too.
from app.core.config import settings as _settings  # noqa: E402

_settings.auth_rate_limit_enabled = False
