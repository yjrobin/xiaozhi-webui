from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .router import config


def create_app():

    app = FastAPI()

    # 配置 CORS 中间件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
    )

    # 注册路由
    app.include_router(config.router)

    from fastapi.staticfiles import StaticFiles
    from starlette.responses import FileResponse

    app.mount("/assets", StaticFiles(directory="/app/frontend/dist/assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        return FileResponse("/app/frontend/dist/index.html")

    return app
