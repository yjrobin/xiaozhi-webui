from urllib.parse import urlparse
from .websocket_proxy import WebSocketProxy
from ..config import configuration
import asyncio


def cleanup(process):
    """清理进程"""
    if process:
        process.terminate()
        process.join()
        process = None


def run_proxy():
    """在单独的进程中运行代理服务器"""
    proxy = WebSocketProxy(
        device_id=configuration.get("DEVICE_ID"),
        client_id=configuration.get("CLIENT_ID"),
        websocket_url=configuration.get("WS_URL"),
        ota_version_url=configuration.get("OTA_VERSION_URL"),
        proxy_host=urlparse(configuration.get("WS_PROXY_URL")).hostname,
        proxy_port=urlparse(configuration.get("WS_PROXY_URL")).port,
        token_enable=configuration.get("TOKEN_ENABLE"),
        token=configuration.get("DEVICE_TOKEN"),
    )
    asyncio.run(proxy.main())
