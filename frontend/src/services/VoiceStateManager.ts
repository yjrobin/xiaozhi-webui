import { ref } from "vue";
import { VoiceState, type VoiceStateConfig, type VoiceStateTransition, type VoiceEventType, type VoiceEventHandler } from "@/types/voice";

export class VoiceStateManager {
    public currentState = ref<VoiceState>(VoiceState.IDLE);
    public config: VoiceStateConfig;
    public transitions: Map<VoiceState, VoiceStateTransition>;
    private eventHandlers: Map<VoiceEventType, VoiceEventHandler[]> = new Map();
    private silenceTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(config: VoiceStateConfig) {
        this.transitions = new Map<VoiceState, VoiceStateTransition>();
        this.config = config;
        this.initializeTransitions();
    }

    public on(event: VoiceEventType, handler: VoiceEventHandler) {
        if (!this.eventHandlers.get(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(handler);
    }

    public emit(event: VoiceEventType, data?: any) {
        this.eventHandlers.get(event)?.forEach(handler => handler(data));
    }

    private initializeTransitions() {
        this.transitions.set(VoiceState.IDLE, {
            handleAudioLevel: (audioLevel: number) => {
                if (audioLevel > this.config.thresholds.USER_SPEAKING) {
                    this.setState(VoiceState.USER_SPEAKING);
                }
            }
        })

        this.transitions.set(VoiceState.USER_SPEAKING, {
            onEnter: () => {
                this.emit("userStartSpeaking")
            },
            onExit: () => {
                this.emit("userStopSpeaking")
                if (this.silenceTimer) {
                    clearTimeout(this.silenceTimer);
                    this.silenceTimer = null;
                }
            },
            handleAudioLevel: (audioLevel: number, data: Float32Array) => {
                this.emit("userAudioLevelChange", audioLevel);
                this.config.callbacks.sendAudioData(data);
                if (audioLevel < this.config.thresholds.USER_SPEAKING) {
                    if (!this.silenceTimer) {
                        // 用户停止说话 2s 后，切换到 AI_SPEAKING 状态
                        this.silenceTimer = setTimeout(() => {
                            if (this.currentState.value === VoiceState.USER_SPEAKING) {
                                this.setState(VoiceState.AI_SPEAKING);
                            }
                            this.silenceTimer = null;
                        }, this.config.timeout.SILENCE);
                    }
                } else {
                    if (this.silenceTimer) {
                        clearTimeout(this.silenceTimer);
                        this.silenceTimer = null;
                    }
                }
            },
        })

        this.transitions.set(VoiceState.AI_SPEAKING, {
            onEnter: () => {
                this.emit("aiStartSpeaking")
            },
            onExit: () => {
                this.emit("aiStopSpeaking")
            },
            handleAudioLevel: (audioLevel: number) => {
                this.emit("aiAudioLevelChange", audioLevel);
                if (audioLevel > this.config.thresholds.USER_INTERRUPT_AI) {
                    // 通知小智，你被打断了
                    const abortMessage = JSON.stringify({
                        type: "abort",
                        session_id: this.config.callbacks.getSessionID(),
                    });
                    this.config.callbacks.sendTextData(abortMessage);
                    this.setState(VoiceState.USER_SPEAKING);
                }
            },
        })
    }

    public setState(newState: VoiceState) {
        this.emit("stateChange", newState)
    }

    public handleUserAudioLevel(audioLevel: number, data: Float32Array) {
        this.emit("userAudioLevelChange", audioLevel);
        const currentTransition = this.transitions.get(this.currentState.value);
        currentTransition?.handleAudioLevel(audioLevel, data);
    }

    public handleAIAudioLevel(audioLevel: number) {
        this.emit("aiAudioLevelChange", audioLevel);
    }

    public destroy() {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }
}