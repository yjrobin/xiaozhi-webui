from urllib.parse import urlparse
from app.utils.logger import get_logger, setup_logging
from app.utils.system_info import setup_opus

setup_logging()
setup_opus()  # 在导入 opuslib 之前 windows 需要手动加载 opus.dll 动态链接库

logger = get_logger(__name__)
proxy_process = None

if __name__ == "__main__":
    import atexit
    import multiprocessing
    import uvicorn

    from app import create_app
    from app.config import ConfigManager
    from app.proxy.process_handler import run_proxy, cleanup

    app = create_app()
    configuration = ConfigManager()

    # 注册退出时的清理函数
    atexit.register(cleanup, proxy_process)

    # 启动 Proxy 服务器
    proxy_process = multiprocessing.Process(target=run_proxy, name="ProxyProcess")
    proxy_process.start()
    logger.info(
        f"代理服务器已启动: {configuration.get('WS_PROXY_URL')}, PID: {proxy_process.pid}"
    )

    # 启动 FastAPI 服务器
    BACKEND_URL = str(configuration.get("BACKEND_URL"))
    parsed_url = urlparse(BACKEND_URL)
    BACKEND_HOST = parsed_url.hostname
    BACKEND_PORT = parsed_url.port
    
    if BACKEND_HOST is None or BACKEND_PORT is None:
        logger.error(f"无效的 BACKEND_URL: {BACKEND_URL}")
        exit(1)
        
    logger.info(f"FastAPI 服务器地址: {BACKEND_HOST}:{BACKEND_PORT}")

    uvicorn.run(app, host=BACKEND_HOST, port=BACKEND_PORT)
