from openai import OpenAI

EMBEDDING_MODEL = "text-embedding-3-small"


def embed_chunks(chunks: list[dict]) -> list[list[float]]:
    client = OpenAI()
    response = client.embeddings.create(
        model=EMBEDDING_MODEL, input=[chunk["text"] for chunk in chunks])
    return [item.embedding for item in response.data]
