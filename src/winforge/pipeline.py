import json
from pathlib import Path

from winforge.chunking import markdown_to_chunks
from winforge.convert import pdf_to_markdown
from winforge.embedding import embed_chunks
from winforge.vectorstore import get_collection, upsert_chunks


def pdf_to_chunks(pdf_path: Path) -> list[dict]:
    md = pdf_to_markdown(pdf_path)
    return markdown_to_chunks(pdf_path, md)


def index_document(
    pdf_path: Path,
    chroma_dir: Path,
    collection_name: str,
    chunks_json_path: Path | None = None,
) -> list[dict]:
    """Ingest a single PDF into a specific (per-lead) chroma collection."""
    chunks = pdf_to_chunks(pdf_path)
    if chunks_json_path is not None:
        chunks_json_path.parent.mkdir(parents=True, exist_ok=True)
        chunks_json_path.write_text(json.dumps(chunks, indent=2))

    embeddings = embed_chunks(chunks)
    collection = get_collection(chroma_dir, collection_name)
    upsert_chunks(collection, chunks, embeddings)
    return chunks


def index_dir(
    directory: Path | str,
    output_dir: Path | str | None = None,
    chroma_dir: Path | str = "chroma",
) -> list[Path]:
    directory = Path(directory)
    if output_dir is not None:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

    collection = get_collection(Path(chroma_dir))

    written = []
    for pdf_path in sorted(directory.glob("*.pdf")):
        chunks = pdf_to_chunks(pdf_path)

        json_path = (
            output_dir / pdf_path.name if output_dir else pdf_path).with_suffix(".json")
        json_path.write_text(json.dumps(chunks, indent=2))
        written.append(json_path)

        embeddings = embed_chunks(chunks)
        upsert_chunks(collection, chunks, embeddings)
    return written
