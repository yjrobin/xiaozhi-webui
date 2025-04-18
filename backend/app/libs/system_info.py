# https://github.com/Huang-junsen/py-xiaozhi/blob/main/src/utils/system_info.py
# 在导入 opuslib 之前处理 opus 动态库
import ctypes
import os
import sys
from ..libs.logger import get_logger

logger = get_logger(__name__)


def setup_opus():
    """设置 opus 动态库"""
    if hasattr(sys, "_opus_loaded"):
        logger.info("opus 库已由其他组件加载")
        return True

    # 获取 opus.dll 的路径
    opus_path = os.path.join(os.path.dirname(__file__), "windows", "opus.dll")

    # 检查文件是否存在
    if os.path.exists(opus_path):
        logger.info(f"找到 opus 库文件: {opus_path}")
    else:
        logger.info(f"警告: opus 库文件不存在于路径: {opus_path}")
        # 尝试在其他可能的位置查找
        if getattr(sys, "frozen", False):
            alternate_path = os.path.join(os.path.dirname(sys.executable), "opus.dll")
            if os.path.exists(alternate_path):
                opus_path = alternate_path
                logger.info(f"在替代位置找到 opus 库文件: {opus_path}")

    # 预加载 opus.dll
    try:
        ctypes.cdll.LoadLibrary(opus_path)
        logger.info(f"成功加载 opus 库: {opus_path}")
        sys._opus_loaded = True
        # 成功加载后修补 find_library
        _patch_find_library("opus", opus_path)
        return True
    except Exception as e:
        logger.info(f"加载 opus 库失败: {e}")

        # 尝试使用系统路径查找
        try:
            ctypes.cdll.LoadLibrary("opus")
            logger.info("已从系统路径加载 opus 库")
            sys._opus_loaded = True
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
