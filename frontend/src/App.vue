<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useSettingStore } from "./stores/setting";
import type {
  HelloResponse,
  UserEcho,
  AIResponse_Emotion,
  AI_TTS_Start,
  AIResponse_Text
} from "./types/message";

const settingStore = useSettingStore();
const chatContainerRef = ref<InstanceType<typeof ChatContainer> | null>(null);

// ---------- WebSocket 连接相关 start ----------
import { WebSocketService } from "./services/WebSocketService";

const wsService = new WebSocketService({
  async onAudioMessage(event) {
    console.log("[WebSocketService][onAudioMessage] audio data received:", event);
    // 如果当前是 USER_SPEAKING 状态，不接收音频数据
    if (chatStateManager.currentState.value === ChatState.USER_SPEAKING) {
      console.warn("[WebSocketService][onAudioMessage] In interrupted state, discarding old audio data");
      return;
    }

    if (chatStateManager.currentState.value == ChatState.AI_SPEAKING) {
      console.log("[WebSocketService][onAudioMessage] Audio is playing, enqueuing...");
      await enqueueAudio(event);
    } else if (chatStateManager.currentState.value == ChatState.IDLE) {
      console.log("[WebSocketService][onAudioMessage] Audio is not playing, playing now...");
      await enqueueAudio(event);
      console.log("[WebSocketService][onAudioMessage] Audio is not playing, set ai speaking...");
      chatStateManager.setState(ChatState.AI_SPEAKING);
    } else {
      console.warn("[WebSocketService][onAudioMessage] Current state is:", chatStateManager.currentState.value, ", skip enqueue.");
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
            const startMessage = message as AI_TTS_Start;
            if (chatStateManager.currentState.value === ChatState.USER_SPEAKING) {
              chatStateManager.setState(ChatState.IDLE);
            }
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
})
// ---------- WebSocket 连接相关 end ------------

// ---------- 语音处理相关 start ------------
const audioContext = new (window.AudioContext || window.webkitAudioContext)({
  sampleRate: 16000,
}); // 兼容苹果 Safari 浏览器
const audioQueue = ref<AudioBuffer[]>([]);

let animationCheckInterval: number | null = null;
let analyser: AnalyserNode;

/**
 * 停止播放音频，并清空队列，将播放状态设置为 false
 */
const abortPlayingAndClean = (): void => {
  audioQueue.value = [];

  // 通知小智，你被打断了
  const abortMessage = {
    type: "abort",
    session_id: settingStore.sessionId,
  };
  wsService.sendTextMessage(abortMessage)
};

/**
 * 将 Wave 音频解码后添加到队列中
 * @param {Blob} blob Wave 音频文件
 */
const enqueueAudio = async (blob: Blob): Promise<void> => {
  try {
    const arrayBuffer: ArrayBuffer = await blob.arrayBuffer();
    const audioBuffer: AudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
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

  // 语音通话模式：需要音频分析器控制波形动画
  if (isVoiceCallVisible.value) {
    if (!analyser) {
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
    }

    source.connect(analyser);
    analyser.connect(audioContext.destination);

    // 设置音频分析定时器
    if (animationCheckInterval) {
      clearInterval(animationCheckInterval);
    }
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    animationCheckInterval = setInterval(() => {
      if (isVoiceCallVisible.value) {
        analyser.getFloatTimeDomainData(dataArray);
        const audioLevel = detectAudioLevel(dataArray);
        chatStateManager.handleAIAudioLevel(audioLevel);
      }
    }, 100);

    source.onended = () => {
      source?.disconnect();
      analyser.disconnect();
      playQueuedAudio();
    };
  }
  // 普通模式：直接播放
  else {
    source.connect(audioContext.destination);
    source.onended = () => {
      source?.disconnect();
      playQueuedAudio();
    };
  }

  source.start();
};
// ---------- 语音处理相关 end --------------


// ---------- 语音通话 start --------------
import { ChatStateManager } from "./services/ChatStateManager.ts";
import { ChatState } from "./types/chat.ts";
import type { AIListening_Start, AIListening_Stop } from "./types/message";

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
  }
})

const isVoiceCallVisible = ref<boolean>(false);
let audioStream: MediaStream | null | void = null;
let processorNode: AudioWorkletNode | null = null;
let userMediaNode: MediaStreamAudioSourceNode | null = null;
let source: AudioBufferSourceNode | null = null;

chatStateManager.on("userStartSpeaking", async () => {
  // 停止 ai 的讲话
  source?.disconnect();
  source?.stop();
  source = null;
  audioQueue.value = [];

  const aiStartListening: AIListening_Start = {
    type: "listen",
    state: "start",
    mode: "auto",
  };
  wsService.sendTextMessage(aiStartListening)
})

chatStateManager.on("userStopSpeaking", () => {
  const aiStopListening: AIListening_Stop = {
    type: "listen",
    state: "stop",
    mode: "auto",
  };
  wsService.sendTextMessage(aiStopListening);
})

chatStateManager.on("aiStartSpeaking", () => {
  playQueuedAudio();
})

chatStateManager.on("aiStopSpeaking", () => {
  if (source) {
    source.onended = () => { };
  }
  if (animationCheckInterval) {
    clearInterval(animationCheckInterval);
    animationCheckInterval = null;
  }
})

chatStateManager.on("stateChange", (newState: ChatState) => {
  const oldState = chatStateManager.currentState.value;
  const oldTransition = chatStateManager.transitions.get(oldState);
  const newTransition = chatStateManager.transitions.get(newState);

  oldTransition?.onExit?.();
  if (newState == ChatState.IDLE && audioQueue.value.length > 0) {
    chatStateManager.currentState.value = ChatState.AI_SPEAKING;
    console.log("[ChatStateManager][stateChange] State changed from", oldState, "to ai_speaking")
  } else if (oldState == newState) {
    console.log("[ChatStateManager][stateChange] State", oldState, "not changed")
    return;
  } else {
    if (newState == ChatState.IDLE) {
      voiceAnimationManager.updateAIWave(0);
    }
    chatStateManager.currentState.value = newState;
    console.log("[ChatStateManager][stateChange] State changed from", oldState, "to", newState)
  }
  newTransition?.onEnter?.();
})

const showVoiceCallPanel = async () => {
  isVoiceCallVisible.value = true;

  if (chatStateManager.currentState.value != ChatState.IDLE) {
    chatStateManager.setState(ChatState.IDLE);
  }

  await prepareMediaResources();
  if (audioContext.state == 'suspended') {
    audioContext.resume();
  }
};

const closeVoiceCallPanel = async () => {
  isVoiceCallVisible.value = false;
  analyser?.disconnect();

  if (animationCheckInterval) {
    clearInterval(animationCheckInterval);
    animationCheckInterval = null;
  }
  clearMediaResources();
};

/**
 * 音频电平检测
 * @param {Float32Array} audioData 音频数据
 * @returns {number} 音频电平值
 */
function detectAudioLevel(audioData: Float32Array): number {
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


// ---------- 对话的动态效果 start ----------
import { VoiceAnimationManager } from "./services/VoiceAnimationManager";

const voiceAnimationManager = new VoiceAnimationManager();

chatStateManager.on("userAudioLevelChange", (audioLevel: number) => {
  if (chatStateManager.currentState.value === ChatState.USER_SPEAKING
    && audioLevel > chatStateManager.config.thresholds.USER_SPEAKING) {
    voiceAnimationManager.updateUserWave(audioLevel);
  }
});

chatStateManager.on("aiAudioLevelChange", (audioLevel: number) => {
  if (chatStateManager.currentState.value === ChatState.AI_SPEAKING) {
    voiceAnimationManager.updateAIWave(audioLevel);
  }
});
// ---------- 对话的动态效果 end ------------

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
  const wsProxyUrl = settingStore.wsProxyUrl;
  wsService.connect(wsProxyUrl);
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
    <InputField :abort-playing-and-clean="abortPlayingAndClean" :show-voice-call-panel="showVoiceCallPanel"
      :chat-state-manager="chatStateManager" :ws-service="wsService" />
    <SettingPanel :class="{ settingPanelVisible: settingStore.visible }" />
    <VoiceCall :voice-animation-manager="voiceAnimationManager" :chat-state-manager="chatStateManager"
      :is-visible="isVoiceCallVisible" :on-close="closeVoiceCallPanel" />
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
