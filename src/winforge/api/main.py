from dotenv import load_dotenv
from fastapi import FastAPI

from winforge.api.db import init_db
from winforge.api.routes.leads import router as leads_router

load_dotenv()


def create_app() -> FastAPI:
    app = FastAPI(title="Winforge Leads API")
    init_db()
    app.include_router(leads_router, prefix="/leads", tags=["leads"])
    return app


app = create_app()


def run() -> None:
    import uvicorn

    uvicorn.run("winforge.api.main:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    run()
