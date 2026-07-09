import argparse
from pathlib import Path

from dotenv import load_dotenv

from winforge import __version__
from winforge.pipeline import index_dir

load_dotenv()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="winforge",
        description="winforge - Windows automation/forge tool",
    )
    parser.add_argument("--version", action="version",
                        version=f"winforge {__version__}")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    for json_path in index_dir(
        Path(__file__).parent / "samples/row",
        Path(__file__).parent / "samples/content",
        Path(__file__).parent.parent.parent / "chroma",
    ):
        print(f"wrote {json_path}")

    print("Hello from winforge!")


if __name__ == "__main__":
    main()
