from pathlib import Path

import chromadb
from chromadb.api.models.Collection import Collection

COLLECTION_NAME = "winforge_documents"


def get_collection(chroma_dir: Path) -> Collection:
    client = chromadb.PersistentClient(path=str(chroma_dir))
    return client.get_or_create_collection(COLLECTION_NAME)


def upsert_chunks(collection: Collection, chunks: list[dict], embeddings: list[list[float]]) -> None:
    collection.upsert(
        ids=[chunk["id"] for chunk in chunks],
        documents=[chunk["text"] for chunk in chunks],
        embeddings=embeddings,
        metadatas=[chunk["metadata"] for chunk in chunks],
    )
