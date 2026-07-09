"""Streamlit app for browsing the ChromaDB collection. Run with:

    uv run streamlit run src/winforge/viewer.py
"""

from pathlib import Path

import pandas as pd
import streamlit as st

from winforge.vectorstore import COLLECTION_NAME, get_collection

DEFAULT_CHROMA_DIR = Path(__file__).parent.parent.parent / "chroma"

st.set_page_config(page_title="Winforge ChromaDB Viewer", layout="wide")
st.title("Winforge ChromaDB Viewer")

chroma_dir = st.text_input("Chroma DB directory", value=str(DEFAULT_CHROMA_DIR))

if not Path(chroma_dir).exists():
    st.warning(f"Directory not found: {chroma_dir}")
    st.stop()

collection = get_collection(Path(chroma_dir))
count = collection.count()
st.caption(f"Collection `{COLLECTION_NAME}` — {count} chunks")

if count == 0:
    st.info("Collection is empty.")
    st.stop()

result = collection.get(include=["documents", "metadatas"])

rows = []
for id_, document, metadata in zip(result["ids"], result["documents"], result["metadatas"]):
    row = {"id": id_, **(metadata or {}), "text": document}
    rows.append(row)

df = pd.DataFrame(rows)

with st.sidebar:
    st.header("Filters")
    documents = sorted(df["document"].unique()) if "document" in df else []
    selected_docs = st.multiselect("Document", documents, default=documents)

if selected_docs and "document" in df:
    df = df[df["document"].isin(selected_docs)]

st.dataframe(df, use_container_width=True, hide_index=True)
