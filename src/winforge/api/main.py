from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from winforge.api.db import init_db
from winforge.api.routes.leads import router as leads_router

load_dotenv()


def create_app() -> FastAPI:
    app = FastAPI(title="Winforge Leads API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    init_db()
    app.include_router(leads_router, prefix="/leads", tags=["leads"])
    return app


app = create_app()


def run() -> None:
    import uvicorn

    uvicorn.run("winforge.api.main:app",
                host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    run()
