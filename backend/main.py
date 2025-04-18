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

    logger.debug(f"代理服务器URL: {configuration.get('PROXY_HOST')}:{configuration.get('PROXY_PORT')}")
    logger.debug(f"设备ID: {configuration.get('DEVICE_ID')}")
    logger.debug(f"Token: {configuration.get('DEVICE_TOKEN')}")
    logger.debug(f"WebSocket URL: {configuration.get('WS_URL')}")

    # 启动 Proxy 服务器
    proxy_process = multiprocessing.Process(target=run_proxy, name="ProxyProcess")
    proxy_process.start()
    logger.info("代理服务器已启动")

    # 启动 Flask 服务器
    uvicorn.run(app, host=configuration.get("BACKEND_HOST"), port=int(configuration.get("BACKEND_PORT")))
