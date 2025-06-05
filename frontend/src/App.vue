<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useSettingStore } from "./stores/setting";
import type {
  HelloResponse,
  UserEcho,
  AIResponse_Emotion,
  AIResponse_Text,
  AbortMessage,
  UserMessage
} from "./types/message";

const settingStore = useSettingStore();
const chatContainerRef = ref<InstanceType<typeof ChatContainer> | null>(null);

// ---------- 语音处理相关 start ------------
import { AudioService } from "./services/AudioManager.ts";
const audioService = AudioService.getInstance();
const audioContext = audioService.getAudioContext();
const audioQueue = ref<AudioBuffer[]>([]);

/**
 * 将 Wave 音频解码后添加到队列中
 * @param {AudioBuffer} audioBuffer Wave 音频文件
 */
const enqueueAudio = (audioBuffer: AudioBuffer): void => {
  try {
    audioQueue.value.push(audioBuffer);
    console.log("[App][enqueueAudio] Audio enqueued");
  } catch (e) {
    console.error("[App][enqueueAudio] Error:", e);
  }
};

const playQueuedAudio = async () => {
  if (audioQueue.value.length === 0) {
    console.log("[App][playQueuedAudio] Audio queue is empty.");
    chatStateManager.setState(ChatState.IDLE);
    return;
  }

  const audioBuffer: AudioBuffer = audioQueue.value.shift() as AudioBuffer;

  // 创建播放节点
  source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.onended = () => {
    source?.disconnect();
    playQueuedAudio();
  };
  source.start();
};
// ---------- 语音处理相关 end --------------


// ---------- 语音通话 start --------------
import { ChatStateManager } from "./services/ChatStateManager.ts";
import { ChatEvent, ChatState } from "./types/chat.ts";
import { VoiceAnimationManager } from "./services/VoiceAnimationManager";

const voiceAnimationManager = new VoiceAnimationManager();
const chatStateManager = new ChatStateManager({
  thresholds: {
    USER_SPEAKING: 0.04,
    USER_INTERRUPT_AI: 0.08
  },
  timeout: {
    SILENCE: 1000
  },
  callbacks: {
    sendAudioData(data: Float32Array) {
      wsService.sendAudioMessage(data);
    },
    sendTextData(text: string) {
      wsService.sendTextMessage(text);
    },
    getSessionId() {
      return settingStore.sessionId;
    }
  },
  voiceAnimationManager: voiceAnimationManager,
})

const isVoiceCallVisible = ref<boolean>(false);
let audioStream: MediaStream | null | void = null;
let processorNode: AudioWorkletNode | null = null;
let userMediaNode: MediaStreamAudioSourceNode | null = null;
let source: AudioBufferSourceNode | null = null;

chatStateManager.on(ChatEvent.USER_START_SPEAKING, async () => {
  // 停止 ai 的讲话
  source?.disconnect();
  source?.stop();
  source = null;
  audioQueue.value = [];
})

chatStateManager.on(ChatEvent.AI_START_SPEAKING, () => {
  playQueuedAudio();
})

chatStateManager.on(ChatEvent.AI_STOP_SPEAKING, () => {
  if (source) {
    source.onended = () => { };
  }
})

const sendAbortMessage = () => {
  // 通知小智被打断了，不再发送后续消息
  const abortMessage: AbortMessage = {
    type: "abort",
    session_id: settingStore.sessionId,
  };
  wsService.sendTextMessage(abortMessage)
}

const sendMessage = (text: string) => {
  const textMessage: UserMessage = {
    type: "listen",
    state: "detect",
    text: text,
    source: "text",
  };
  if (chatStateManager.currentState.value == ChatState.AI_SPEAKING) {
    sendAbortMessage();
    audioQueue.value = [];
  }
  wsService.sendTextMessage(textMessage)
}

const showVoiceCallPanel = async () => {
  sendAbortMessage();
  audioQueue.value = [];
  await prepareMediaResources();
  isVoiceCallVisible.value = true;
  if (chatStateManager.currentState.value != ChatState.IDLE) {
    chatStateManager.setState(ChatState.IDLE);
  }
  if (audioContext.state == 'suspended') {
    audioContext.resume();
  }
};

const closeVoiceCallPanel = async () => {
  isVoiceCallVisible.value = false;
  sendAbortMessage();
  clearMediaResources();
};

/**
 * 音频电平检测
 * @param {Float32Array} audioData 音频数据
 * @returns {number} 音频电平值
 */
const detectAudioLevel = (audioData: Float32Array): number => {
  if (!audioData || !audioData.length) return 0;
  let sum = 0;
  for (let i = 0; i < audioData.length; i++) {
    sum += Math.abs(audioData[i]);
  }
  return sum / audioData.length;
}

// 初始化媒体资源
const prepareMediaResources = async () => {
  // 加载音频处理脚本
  await audioContext.audioWorklet.addModule(
    "/src/utils/audio/audioProcessor.ts"
  );
  console.log("[App][prepareMediaResources] Audio processor loaded.")

  // 初始化音频流
  audioStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 24000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: false,
  }).catch((err: unknown) => {
    console.log("[App][startRecording] Error getting user media:", err);
  });
  console.log("[App][startRecording] UserMedia created:", audioStream);

  // 初始化用户媒体流节点
  // 利用 MediaStream 创建音频源节点
  if (audioStream) {
    userMediaNode = audioContext.createMediaStreamSource(audioStream);
    console.log("[App][prepareMediaResources] userMediaNode created:", userMediaNode);
  }

  // 初始化音频处理节点
  // 使用自定义的 audioContext 节点，用于后续处理音频数据
  // https://developer.mozilla.org/zh-CN/docs/Web/API/AudioWorkletNode
  processorNode = new AudioWorkletNode(audioContext, "audioProcessor", {
    processorOptions: {
      bufferSize: 960, // 16KHz 的采样频率下，60ms 包含的采样点个数
    },
  });

  // 处理节点的出口回调函数，用于接收 process 函数处理后的音频数据
  processorNode.port.onmessage = (e: MessageEvent) => {
    if (!(e.data instanceof Float32Array)) {
      console.warn("[App][processorNode.port.onmessage] Unexpected data format:", typeof e.data);
      return;
    }
    const audioLevel = detectAudioLevel(e.data);
    console.log("[App][processorNode.port.onmessage] Audio Level:", audioLevel.toFixed(2));
    chatStateManager.handleUserAudioLevel(audioLevel, e.data);
  };
  if (!audioStream || !userMediaNode || !processorNode) {
    console.log("[App][connectMediaResources] Resources not ready.");
    return;
  }
  userMediaNode.connect(processorNode);
  audioStream.getTracks().forEach((track) => (track.enabled = true));
};

const clearMediaResources = () => {
  audioQueue.value = [];
  if (audioStream) {
    audioStream.getTracks().forEach((track) => track.stop());
    audioStream = null;
    console.log("[App][clearMediaResources] audioStream closed");
  }
  if (userMediaNode) {
    userMediaNode.disconnect();
    userMediaNode = null;
    console.log("[App][clearMediaResources] userMediaNode closed");
  }
  if (processorNode) {
    processorNode.port.onmessage = null;
    processorNode.disconnect();
    processorNode = null;
    console.log("[App][clearMediaResources] processorNode closed");
  }
};
// ---------- 语音通话 end ----------------

// ---------- WebSocket 连接相关 start ----------
import { WebSocketService } from "./services/WebSocketManager.ts";

const wsService = new WebSocketService(
  {
    decodeAudioData: (arrayBuffer: ArrayBuffer) => audioService.decodeAudioData(arrayBuffer),
  },
  {
    async onAudioMessage(event) {
      console.log("[WebSocketService][onAudioMessage] audio data received.");
      switch (chatStateManager.currentState.value as ChatState) {
        case ChatState.USER_SPEAKING:
          console.warn("[WebSocketService][onAudioMessage] User is speaking, discarding audio data.");
          enqueueAudio(event);
          break;
        case ChatState.IDLE:
          console.log("[WebSocketService][onAudioMessage] Audio is not playing, set ai speaking...");
          enqueueAudio(event);
          chatStateManager.setState(ChatState.AI_SPEAKING);
          break;
        case ChatState.AI_SPEAKING:
          console.log("[WebSocketService][onAudioMessage] AI is speaking, enqueuing audio data.");
          enqueueAudio(event);
          break;
        default:
          console.error("[WebSocketService][onAudioMessage] Unknown state:", chatStateManager.currentState.value);
      }
    },
    async onTextMessage(message) {
      console.log("[WebSocketService][onTextmessage] Text message received:", message);

      switch (message.type) {
        case "hello":
          const helloMessage = message as HelloResponse;
          settingStore.setSessionId(helloMessage.session_id!);
          console.log("[WebSocketService][onTextmessage] Session ID:", helloMessage.session_id);
          break;

        case "stt":
          const sttMessage = message as UserEcho;
          if (sttMessage.text?.trim()) {
            chatContainerRef.value?.appendMessage("user", sttMessage.text);
          }
          break;

        case "llm":
          const emotionMessage = message as AIResponse_Emotion;
          if (emotionMessage.text?.trim()) {
            chatContainerRef.value?.appendMessage("ai", emotionMessage.text);
          }
          break;

        case "tts":
          switch (message.state) {
            case "start":
              // ai 不能打断用户说话
              // if (chatStateManager.currentState.value === ChatState.USER_SPEAKING) {
              //   chatStateManager.setState(ChatState.IDLE);
              // }
              break;
            case "sentence_start":
              const textMessage = message as AIResponse_Text;
              chatContainerRef.value?.appendMessage("ai", textMessage.text!);
              break;
            case "sentence_end":
              break;
          }
          break;
      }
    },
  }
)
// ---------- WebSocket 连接相关 end ------------

import Header from './components/Header/index.vue'
import SettingPanel from './components/Setting/index.vue'
import VoiceCall from "./components/VoiceCall.vue";
import InputField from "./components/InputField.vue";
import ChatContainer from './components/ChatContainer.vue';
import { ElMessage } from 'element-plus';

onMounted(async () => {
  const loaded = settingStore.loadFromLocal();
  if (!loaded) {
    console.log("[App][onMounted] 未发现本地配置，正在获取默认配置");
    await settingStore.fetchConfig();
    settingStore.saveToLocal();
    ElMessage.warning("未发现本地配置，默认配置已加载")
  } else {
    ElMessage.success("本地配置加载成功");
  }
  wsService.connect(settingStore.wsProxyUrl);
});

onUnmounted(() => {
  console.log("[App][onUnmounted] Clearing resources...");
  clearMediaResources();
  chatStateManager.destroy();
});
</script>

<template>
  <div class="app-container">
    <Header :connection-status="wsService.connectionStatus.value" />
    <ChatContainer class="chat-container" ref="chatContainerRef" />
    <InputField 
      @send-message="(text: string) => sendMessage(text)" 
      @phone-call-button-clicked="showVoiceCallPanel"
    />
    <SettingPanel />
    <VoiceCall 
      :voice-animation-manager="voiceAnimationManager" 
      :chat-state-manager="chatStateManager"
      :is-visible="isVoiceCallVisible" 
      @on-shut-down="closeVoiceCallPanel" 
    />
  </div>
</template>

<style>
.app-container {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
</style>
