from app.libs.logger import get_logger, setup_logging

setup_logging()
import atexit
import multiprocessing
import uvicorn

from app import create_app
from app.config import configuration
from app.proxy.process_handler import run_proxy, cleanup

app = create_app()
logger = get_logger(__name__)


if __name__ == "__main__":

    # 注册退出时的清理函数
    atexit.register(cleanup)

    logger.info(f"Proxy Server: {configuration.get("PROXY_HOST")}:{configuration.get("PROXY_PORT")}")
    logger.info(f"Device ID: {configuration.get("DEVICE_ID")}")
    logger.info(f"Token: {configuration.get("DEVICE_TOKEN")}")
    logger.info(f"WS URL: {configuration.get("WS_URL")}")

    # 启动 Proxy 服务器
    proxy_process = multiprocessing.Process(target=run_proxy)
    proxy_process.start()
    logger.info("Proxy server started in background process")

    # 启动 Flask 服务器
    uvicorn.run(app, host=configuration.get("BACKEND_HOST"), port=int(configuration.get("BACKEND_PORT")))
