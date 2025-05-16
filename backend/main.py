from urllib.parse import urlparse
from app.libs.logger import get_logger, setup_logging

setup_logging()

proxy_process = None

if __name__ == "__main__":
    logger = get_logger(__name__)
    import atexit
    import multiprocessing
    import uvicorn

    from app import create_app
    from app.config import configuration
    from app.proxy.process_handler import run_proxy, cleanup

    app = create_app()

    # 注册退出时的清理函数
    atexit.register(cleanup, proxy_process)

    # 启动 Proxy 服务器
    proxy_process = multiprocessing.Process(target=run_proxy, name="ProxyProcess")
    proxy_process.start()
    logger.info(
        f"代理服务器已启动: {configuration.get('PROXY_HOST')}:{configuration.get('PROXY_PORT')}"
    )

    # 启动 FastAPI 服务器
    BACKEND_HOST = urlparse(configuration.get("BACKEND_URL")).hostname
    BACKEND_PORT = urlparse(configuration.get("BACKEND_URL")).port
    logger.info(f"FastAPI 服务器地址: {BACKEND_HOST}:{BACKEND_PORT}")
    uvicorn.run(app, host=BACKEND_HOST, port=BACKEND_PORT)
