import sqlite3
from collections.abc import Iterator
from pathlib import Path

from winforge.api.paths import db_path

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def init_db() -> None:
    db_path().parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path()) as conn:
        conn.executescript(SCHEMA_PATH.read_text())


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def get_db() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
