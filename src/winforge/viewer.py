"""Streamlit app for browsing the ChromaDB collection. Run with:

    uv run streamlit run src/winforge/viewer.py
"""

from pathlib import Path

import chromadb
import pandas as pd
import streamlit as st

from winforge.api.paths import chroma_dir as default_chroma_dir
from winforge.vectorstore import get_collection

st.set_page_config(page_title="Winforge ChromaDB Viewer", layout="wide")
st.title("Winforge ChromaDB Viewer")

chroma_dir = st.text_input("Chroma DB directory", value=str(default_chroma_dir()))

if not Path(chroma_dir).exists():
    st.warning(f"Directory not found: {chroma_dir}")
    st.stop()

client = chromadb.PersistentClient(path=chroma_dir)
collection_names = sorted(c.name for c in client.list_collections())

if not collection_names:
    st.info("No collections found in this directory.")
    st.stop()

collection_name = st.selectbox("Collection (lead)", collection_names)

collection = get_collection(Path(chroma_dir), collection_name)
count = collection.count()
st.caption(f"Collection `{collection_name}` — {count} chunks")

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
