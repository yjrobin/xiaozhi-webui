import asyncio
import websockets
import json
import wave
import io
import numpy as np
import sys
from ..libs.device import get_mac_address, get_local_ip
import requests
from ..libs.logger import get_logger

logger = get_logger(__name__)

# 加载环境变量
from dotenv import load_dotenv

load_dotenv()

# 在导入 opuslib 之前 windows 需要手动加载 opus.dll 动态链接库
from ..libs.system_info import setup_opus

setup_opus()
try:
    import opuslib
except Exception as e:
    logger.error(f"导入 opuslib 失败: {e}")
    logger.error("请确保 opus 动态库已正确安装或位于正确的位置")
    sys.exit(1)


def opus_to_wav(opus_data):
    """将Opus音频数据转换为WAV格式"""
    try:
        # 创建解码器：16kHz, 单声道
        decoder = opuslib.Decoder(16000, 1)

        try:
            # 解码Opus数据
            pcm_data = decoder.decode(opus_data, 960)  # 使用960采样点
            if pcm_data:
                # 将PCM数据转换为numpy数组
                audio_array = np.frombuffer(pcm_data, dtype=np.int16)

                # 创建 Wave 文件
                wav_io = io.BytesIO()
                with wave.open(wav_io, "wb") as wav:
                    wav.setnchannels(1)  # 单声道
                    wav.setsampwidth(2)  # 16位
                    wav.setframerate(16000)  # 16kHz
                    wav.writeframes(audio_array.tobytes())
                return wav_io.getvalue()
            return None

        except opuslib.OpusError as e:
            logger.error(f"Opus 解码错误: {e}, 数据长度: {len(opus_data)}")
            return None

    except Exception as e:
        logger.error(f"音频处理错误: {e}")
        return None


def pcm_to_opus(pcm_data: bytes):
    """将 PCM 音频数据转换为 Opus 格式"""
    try:
        encoder = opuslib.Encoder(16000, 1, "voip")

        # 转化为 numpy 数组
        pcm_array = np.frombuffer(pcm_data, dtype=np.int16)

        # 将 PCM 数据编码为 Opus
        opus_data = encoder.encode(pcm_array.tobytes(), 960)

        return opus_data
    except opuslib.OpusError as e:
        logger.error(f"Opus 编码错误: {e}, 数据长度: {len(pcm_data)}")
        return None


class AudioProcessor:
    def __init__(self, buffer_size):
        self.buffer_size: int = buffer_size
        self.buffer = np.array([], dtype=np.float32)
        self.sample_rate = 16000

    def reset_buffer(self):
        self.buffer = np.array([], dtype=np.float32)

    def process_audio(self, input_data: bytes) -> list[bytes]:

        # 将输入数据转换为 float32 数组
        input_array = np.frombuffer(input_data, dtype=np.float32)

        # 将新数据添加到缓冲区
        self.buffer = np.append(self.buffer, input_array)

        chunks = []

        # 当缓冲区达到指定大小时处理数据
        while len(self.buffer) >= self.buffer_size:

            # 提取数据
            chunk = self.buffer[: self.buffer_size]
            self.buffer = self.buffer[self.buffer_size :]

            # 转换为 16 位整数
            pcm_data = (chunk * 32767).astype(np.int16)
            chunks.append(pcm_data.tobytes())

        return chunks

    def process_remaining(self):
        if len(self.buffer) > 0:
            # 转换为16位整数
            pcm_data = (self.buffer * 32767).astype(np.int16)
            self.buffer = np.array([], dtype=np.float32)
            return [pcm_data.tobytes()]
        return []


class WebSocketProxy:
    def __init__(
        self,
        device_id: str,
        client_id: str,
        websocket_url: str,
        ota_version_url: str,
        proxy_host: str,
        proxy_port: str,
        token_enable: bool,
        token: str,
    ):
        self.device_id: str = device_id
        self.client_id: str = client_id
        self.websocket_url: str = websocket_url
        self.ota_version_url: str = ota_version_url
        self.proxy_host: str = proxy_host
        self.proxy_port: str = proxy_port
        self.token_enable: bool = token_enable
        self.token: str = token

        self.audio_processor = AudioProcessor(960)
        self.decoder = opuslib.Decoder(16000, 1)  # 保持单个解码器实例即可
        self.audio_buffer: bytearray = bytearray()  # 用于存储解码后的音频数据
        self.is_first_audio: bool = True  # 用于判断是否创建 Wave 头信息
        self.total_samples: int = 0  # 跟踪总采样数
        self.audio_lock = asyncio.Lock()  # 保证音频按顺序发送

        self.headers = {
            "Device-Id": self.device_id,
            "Client-Id": self.client_id,
            "Protocol-Version": "1",
        }
        if self.token_enable:
            self.headers["Authorization"] = f"Bearer {self.token}"

        self._update_ota_address()

    def _update_ota_address(self):
        MAC_ADDR = get_mac_address()
        OTA_VERSION_URL = self.ota_version_url

        headers = {"Device-Id": MAC_ADDR, "Content-Type": "application/json"}

        # 构建设备信息payload
        payload = {
            "version": 2,
            "flash_size": 16777216,  # 闪存大小 (16MB)
            "psram_size": 0,
            "minimum_free_heap_size": 8318916,  # 最小可用堆内存
            "mac_address": MAC_ADDR,  # 设备MAC地址
            "uuid": self.client_id,
            "chip_model_name": "esp32s3",  # 芯片型号
            "chip_info": {"model": 9, "cores": 2, "revision": 2, "features": 18},
            "application": {"name": "xiaozhi", "version": "1.1.2", "idf_version": "v5.3.2-dirty"},
            "partition_table": [],  # 省略分区表信息
            "ota": {"label": "factory"},
            "board": {"type": "bread-compact-wifi", "ip": get_local_ip(), "mac": MAC_ADDR},
        }

        try:
            # 发送请求到OTA服务器
            response = requests.post(
                OTA_VERSION_URL,
                headers=headers,
                json=payload,
                timeout=10,  # 设置超时时间，防止请求卡死
                proxies={"http": None, "https": None},  # 禁用代理
            )

            # 检查HTTP状态码
            if response.status_code != 200:
                logger.error(f"OTA 服务器错误: HTTP {response.status_code}")
                raise ValueError(f"OTA 服务器返回错误状态码: {response.status_code}")

            # 解析JSON数据
            response_data = response.json()

            # 确保"mqtt"信息存在
            if "mqtt" in response_data:
                logger.info("MQTT 信息已更新.")
                return response_data["mqtt"]
            else:
                logger.error("OTA 服务器返回的数据无效: 没有 MQTT 信息.")
                raise ValueError("OTA 服务器返回的数据无效，请检查服务器状态或 MAC 地址！")

        except requests.Timeout:
            logger.error("OTA 请求超时.")
            raise ValueError("OTA 请求超时！请稍后重试。")

        except requests.RequestException as e:
            logger.error(f"OTA 请求失败: {e}")
            raise ValueError("无法连接到 OTA 服务器，请检查网络连接！")

    def create_wav_header(self, total_samples):
        """
        创建 Wave 文件头
        https://blog.csdn.net/shulianghan/article/details/117351966

        参数:
        total_samples (int): 音频数据的总采样数

        返回:
        bytearray: Wave 文件头的字节数组

        """
        header = bytearray(44)

        # ========== The "RIFF" chunk descriptor ==========
        header[0:4] = b"RIFF"
        header[4:8] = (total_samples * 2 + 36).to_bytes(4, "little")
        header[8:12] = b"WAVE"

        # ========== The "fmt" sub-chunk ==========
        header[12:16] = b"fmt "
        header[16:20] = (16).to_bytes(4, "little")
        header[20:22] = (1).to_bytes(2, "little")
        header[22:24] = (1).to_bytes(2, "little")
        header[24:28] = (16000).to_bytes(4, "little")
        header[28:32] = (32000).to_bytes(4, "little")
        header[32:34] = (2).to_bytes(2, "little")
        header[34:36] = (16).to_bytes(2, "little")

        # ========== The "data" sub-chunk ==========
        header[36:40] = b"data"
        header[40:44] = (total_samples * 2).to_bytes(4, "little")

        return header

    async def proxy_handler(self, websocket):
        """来自浏览器的 WebSocket 连接"""
        try:
            logger.info(f"正在创建新的客户端 websocket 连接: {websocket.remote_address}")
            async with websockets.connect(self.websocket_url, extra_headers=self.headers) as server_ws:
                logger.info(f"已连接至 websocket 服务器，请求头: {self.headers}")

                # 创建任务
                client_to_server = asyncio.create_task(self.handle_client_messages(websocket, server_ws))
                server_to_client = asyncio.create_task(self.handle_server_messages(server_ws, websocket))

                # 等待任意一个任务完成
                done, pending = await asyncio.wait(
                    [client_to_server, server_to_client],
                    return_when=asyncio.FIRST_COMPLETED,
                )

                # 取消其他任务
                for task in pending:
                    task.cancel()

        except Exception as e:
            logger.error(f"代理失败: {e}")
        finally:
            logger.info("客户端连接关闭")

    async def handle_server_messages(self, server_ws, client_ws):
        """处理来自 WebSocket 服务器的消息"""
        try:
            async for message in server_ws:
                if isinstance(message, str):
                    try:
                        msg_data = json.loads(message)
                        if msg_data.get("type") == "tts" and msg_data.get("state") == "start":
                            # 新的音频流开始，播放未发送完的语音并重置状态
                            if len(self.audio_buffer) > 44:
                                async with self.audio_lock:
                                    chunk_size = (self.total_samples * 2 + 36).to_bytes(4, "little")
                                    subchunk2_size = (self.total_samples * 2).to_bytes(4, "little")
                                    self.audio_buffer[4:8] = chunk_size
                                    self.audio_buffer[40:44] = subchunk2_size
                                    await client_ws.send(bytes(self.audio_buffer))
                            self.audio_buffer = bytearray()
                            self.is_first_audio = True
                            self.total_samples = 0
                        elif msg_data.get("type") == "tts" and msg_data.get("state") == "stop":
                            # 音频流结束，发送剩余数据并重置状态
                            if len(self.audio_buffer) > 44:
                                async with self.audio_lock:
                                    chunk_size = (self.total_samples * 2 + 36).to_bytes(4, "little")
                                    subchunk2_size = (self.total_samples * 2).to_bytes(4, "little")
                                    self.audio_buffer[4:8] = chunk_size
                                    self.audio_buffer[40:44] = subchunk2_size
                                    await client_ws.send(bytes(self.audio_buffer))
                                    self.audio_buffer = bytearray()
                                    self.is_first_audio = True
                                    self.total_samples = 0

                        await client_ws.send(message)
                    except json.JSONDecodeError:
                        await client_ws.send(message)
                else:
                    async with self.audio_lock:
                        try:
                            # 解码 Opus 音频数据
                            pcm_data = self.decoder.decode(message, 960)

                            if pcm_data:
                                # 计算采样数
                                samples = len(pcm_data) // 2  # 16 位音频，每个采样 2 字节
                                self.total_samples += samples

                                # 如果是第一个音频片段，创建 Wave 头
                                if self.is_first_audio:
                                    self.audio_buffer.extend(self.create_wav_header(self.total_samples))
                                    self.is_first_audio = False

                                # 追加音频数据
                                self.audio_buffer.extend(pcm_data)

                                # 当缓冲区达到一定大小时发送数据
                                # Wave 头 + 32000 个音频采样数据 = 64044 字节
                                # 一句简短的话一般为 64KB 的 Wave 音频文件
                                if len(self.audio_buffer) >= 64044:

                                    # 更新 Wave 头中的元数据
                                    chunk_size = (self.total_samples * 2 + 36).to_bytes(4, "little")
                                    subchunk2_size = (self.total_samples * 2).to_bytes(4, "little")
                                    self.audio_buffer[4:8] = chunk_size
                                    self.audio_buffer[40:44] = subchunk2_size

                                    # 发送数据
                                    await client_ws.send(bytes(self.audio_buffer))

                                    # 完全重置缓冲区
                                    self.audio_buffer = bytearray()
                                    self.is_first_audio = True
                                    self.total_samples = 0

                        except Exception as e:
                            logger.error(f"音频处理错误: {e}")
        except Exception as e:
            logger.error(f"服务端消息处理异常: {e}")

    async def handle_client_messages(self, client_ws, server_ws):
        """处理来自客户端的消息"""
        try:
            async for message in client_ws:

                # 文字数据和 Json 数据
                if isinstance(message, str):
                    try:
                        msg_data = json.loads(message)
                        if isinstance(msg_data, list):
                            server_ws.send(message)
                        elif msg_data.get("type") == "reset":
                            logger.info("重置音频缓存区")
                            self.audio_processor.reset_buffer()
                        else:
                            await server_ws.send(message)
                    except json.JSONDecodeError:
                        await server_ws.send(message)

                # 音频数据
                else:
                    try:
                        # 确保数据是 Float32Array 格式
                        audio_data = np.frombuffer(message, dtype=np.float32)
                        if len(audio_data) > 0:
                            chunks = self.audio_processor.process_audio(audio_data.tobytes())
                            for chunk in chunks if chunks else []:
                                opus_data = pcm_to_opus(chunk)
                                await server_ws.send(opus_data)
                        else:
                            logger.warning("音频数据为空")
                    except Exception as e:
                        logger.error(f"音频处理错误: {e}")
        except Exception as e:
            logger.error(f"客户端信息处理异常: {e}")

    async def main(self):
        """启动代理服务器"""
        async with websockets.serve(self.proxy_handler, self.proxy_host, self.proxy_port):
            await asyncio.Future()
