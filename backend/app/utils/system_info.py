# https://github.com/Huang-junsen/py-xiaozhi/blob/main/src/utils/system_info.py
# 在导入 opuslib 之前处理 opus 动态库
import ctypes
import os
import sys
import platform
from ..utils.logger import get_logger
from ..constant.file import BASE_DIR

logger = get_logger(__name__)


def setup_opus():
    """设置 opus 动态库"""
    if hasattr(sys, "_opus_loaded"):
        logger.info("opus 库已由其他组件加载")
        return True
    
    system = platform.system().lower()
    logger.info(f"当前操作系统: {system}")
    if system == "windows":
        opus_ext = "dll"
        sys_dir = "windows"
    elif system == "linux":
        opus_ext = "so"
        sys_dir = "linux"
    else:
        logger.info(f"不支持的操作系统: {system}")
        return False

    # 获取 opus 动态链接库路径
    opus_path = os.path.join(BASE_DIR, "libs", sys_dir, f"opus.{opus_ext}")

    # 检查文件是否存在
    if os.path.exists(opus_path):
        logger.info(f"找到 opus 库文件: {opus_path}")
    else:
        logger.info(f"警告: opus 库文件不存在于路径: {opus_path}")

    # 预加载 opus.dll
    try:
        ctypes.cdll.LoadLibrary(opus_path)
        logger.info(f"成功加载 opus 库: {opus_path}")
        setattr(sys, "_opus_loaded", True)
        # 成功加载后修补 find_library
        _patch_find_library("opus", opus_path)
        return True
    except Exception as e:
        logger.info(f"加载 opus 库失败: {e}")

        # 尝试使用系统路径查找
        try:
            ctypes.cdll.LoadLibrary("opus")
            logger.info("已从系统路径加载 opus 库")
            setattr(sys, "_opus_loaded", True)
            return True
        except Exception as e2:
            logger.info(f"从系统路径加载 opus 库失败: {e2}")

        logger.info("确保 opus 动态库已正确安装或位于正确的位置")
        return False


def _patch_find_library(lib_name, lib_path):
    """修补 ctypes.util.find_library 函数"""
    import ctypes.util

    original_find_library = ctypes.util.find_library

    def patched_find_library(name):
        if name == lib_name:
            return lib_path
        return original_find_library(name)

    ctypes.util.find_library = patched_find_library
