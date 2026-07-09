from pathlib import Path

DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"


def db_path() -> Path:
    return DATA_DIR / "winforge.db"


def chroma_dir() -> Path:
    return DATA_DIR / "chroma"


def lead_dir(lead_id: str) -> Path:
    return DATA_DIR / "leads" / lead_id


def raw_path(lead_id: str, document_id: str, original_filename: str) -> Path:
    return lead_dir(lead_id) / "raw" / f"{document_id}_{original_filename}"


def content_path(lead_id: str, document_id: str) -> Path:
    return lead_dir(lead_id) / "content" / f"{document_id}.json"


def collection_name(lead_id: str) -> str:
    return f"lead_{lead_id}"
