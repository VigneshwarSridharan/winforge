from pathlib import Path

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from pydantic import BaseModel

CHUNKING_MODEL = "gpt-5-mini"

CHUNKING_INSTRUCTIONS = (
    "Split this document into chunks grouped by section, preserving the original "
    "wording verbatim (do not paraphrase or summarize). A section may become multiple "
    "chunks -- split long sections into several sequential chunks of roughly 100-300 "
    "words each, breaking at natural paragraph or list boundaries rather than "
    "mid-sentence. For each chunk, report the title of the section it belongs to, and "
    "the page number it came from, read off the '--- end of page.page_number=N ---' "
    "markers in the text (a chunk is on the page whose marker follows it). Do not "
    "include the section's own heading line in the chunk text -- it's reported "
    "separately in the section title, so the chunk text should start with the body "
    "content that follows the heading."
)


class Chunk(BaseModel):
    section: str
    text: str
    page: int


class DocumentChunks(BaseModel):
    chunks: list[Chunk]


def markdown_to_chunks(pdf_path: Path, md: str) -> list[dict]:
    """Use an LLM to split markdown directly into section-tagged, page-tagged chunks."""
    agent = Agent(model=OpenAIChat(id=CHUNKING_MODEL), output_schema=DocumentChunks)
    result = agent.run(f"{CHUNKING_INSTRUCTIONS}\n\n---\n\n{md}").content

    return [
        {
            "id": f"{pdf_path.stem}_{i}",
            "text": f"{chunk.section}\n\n{chunk.text}",
            "metadata": {
                "document": pdf_path.name,
                "page": chunk.page,
                "chunk": i,
                "section": chunk.section,
            },
        }
        for i, chunk in enumerate(result.chunks)
    ]
