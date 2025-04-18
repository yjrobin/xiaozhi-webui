from fastapi import APIRouter
from ..config import configuration
from ..constant.repsonse import BaseResponse
from ..libs.logger import get_logger
from pydantic import BaseModel
from urllib.parse import urlparse

router = APIRouter(prefix="/config", tags=["config"])
logger = get_logger(__name__)


class GetConfigResponse(BaseResponse):
    data: dict[str, str | int | bool]

@router.get("", summary="获取配置信息", response_model=GetConfigResponse)
def get_config():
    """获取配置信息"""
    logger.info("Configurations: ", configuration.get_config())
    data = {
        "ws_url": configuration.get("WS_URL"),
        "ws_proxy_url": f"ws://{configuration.get("PROXY_HOST")}:{configuration.get("PROXY_PORT")}",
        "token_enable": configuration.get("TOKEN_ENABLE"),
        "device_id": configuration.get("DEVICE_ID"),
        "code": 0,
    }
    if configuration.get("TOKEN_ENABLE"):
        data["token"] = configuration.get("DEVICE_TOKEN")

    return {"message": "配置文件获取成功", "code": 0, "data": data}


class ConfigData(BaseModel):
    ws_url: str
    ws_proxy_url: str
    token_enable: bool
    token: str


@router.put("", summary="更新配置", response_model=BaseResponse)
def update_config(data: ConfigData):
    """保存配置信息"""
    try:
        configuration.set("WS_URL", data.ws_url)
        configuration.set("PROXY_HOST", urlparse(data.ws_proxy_url).hostname)
        configuration.set("PROXY_PORT", urlparse(data.ws_proxy_url).port)
        configuration.set("TOKEN_ENABLE", data.token_enable)
        if data.token_enable:
            configuration.set("DEVICE_TOKEN", data.token)
        configuration.save_config()
        logger.info("Configuration updated successfully")
        return {"message": "配置文件更新成功", "code": 0}
    except Exception as e:
        logger.error(f"Failed to update configuration: {e}")
        return {"message": f"配置文件更新失败: {str(e)}", "code": 1}
