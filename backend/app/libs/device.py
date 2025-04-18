import uuid
import socket


def get_mac_address():
    """获取设备的唯一标识符"""
    # 获取设备的唯一标识符并转换为十六进制字符串
    mac_hex = uuid.UUID(int=uuid.getnode()).hex[-12:]

    # 以 MAC 地址的形式输出 mac_hex
    mac_address = ":".join([mac_hex[i : i + 2] for i in range(0, 12, 2)])

    return mac_address


def get_local_ip():
    """# 创建一个临时 socket 连接来获取本机 IP"""
    try:

        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def get_client_id() -> str:
    """创建并返回一个客户端的唯一标识ID"""
    return str(uuid.uuid4())
