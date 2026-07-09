from pathlib import Path

import pymupdf4llm


def pdf_to_markdown(pdf_path: Path) -> str:
    return pymupdf4llm.to_markdown(str(pdf_path), page_separators=True)
