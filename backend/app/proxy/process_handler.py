from urllib.parse import urlparse
from .websocket_proxy import WebSocketProxy
from ..config import ConfigManager
import asyncio


def cleanup(process):
    """清理进程"""
    if process:
        process.terminate()
        process.join()
        process = None


def run_proxy():
    """在单独的进程中运行代理服务器"""
    configuration = ConfigManager()
    ws_proxy_url = configuration.get_str("WS_PROXY_URL")
    proxy = WebSocketProxy(
        device_id=configuration.get_str("DEVICE_ID"),
        client_id=configuration.get_str("CLIENT_ID"),
        websocket_url=configuration.get_str("WS_URL"),
        ota_version_url=configuration.get_str("OTA_VERSION_URL"),
        proxy_host=urlparse(ws_proxy_url).hostname,
        proxy_port=urlparse(ws_proxy_url).port,
        token_enable=configuration.get_bool("TOKEN_ENABLE"),
        token=configuration.get_str("DEVICE_TOKEN"),
    )
    asyncio.run(proxy.main())
