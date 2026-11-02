import os


os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017")
os.environ.setdefault("MONGO_DB_NAME", "focusmind_test")
os.environ.setdefault("SECRET_KEY", "test-signing-key-with-at-least-32-bytes")
os.environ.setdefault("CORS_ORIGINS", '["http://localhost:3000"]')
os.environ.setdefault("ENV", "development")
