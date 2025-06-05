import { computed, ref } from "vue";
import {
    ChatState,
    type ChatStateDependencies,
    type ChatStateTransition,
    type ChatEventType,
    type ChatEventHandler
} from "@/types/chat";
import type { AbortMessage, AIListening_Start, AIListening_Stop } from "@/types/message";

export class ChatStateManager {
    private _currentState = ref<ChatState>(ChatState.IDLE);
    readonly currentState = computed<ChatState>(() => this._currentState.value);
    private deps: ChatStateDependencies;
    public transitions: Map<ChatState, ChatStateTransition>;
    private eventHandlers: Map<ChatEventType, ChatEventHandler[]> = new Map();
    private silenceTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(deps: ChatStateDependencies) {
        this.transitions = new Map<ChatState, ChatStateTransition>();
        this.deps = deps;
        this.initializeTransitions();
    }

    public on(event: ChatEventType, handler: ChatEventHandler) {
        if (!this.eventHandlers.get(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(handler);
    }

    public emit(event: ChatEventType, data?: any) {
        this.eventHandlers.get(event)?.forEach(handler => handler(data));
    }

    private initializeTransitions() {
        this.transitions.set(ChatState.IDLE, {
            onEnter: () => {
                this.deps.voiceAnimationManager?.updateAIWave(0);
            },
            handleAudioLevel: (audioLevel: number) => {
                if (audioLevel > this.deps.thresholds.USER_SPEAKING) {
                    this.setState(ChatState.USER_SPEAKING);
                }
            }
        })

        this.transitions.set(ChatState.USER_SPEAKING, {
            onEnter: (oldState) => {
                if (oldState === ChatState.USER_SPEAKING) return;
                const aiListening_Start: AIListening_Start = {
                    type: "listen",
                    state: "start",
                    mode: "auto",
                };
                this.deps.callbacks.sendTextData(aiListening_Start)
                console.log("[ChatStateManager][USER_SPEAKING.onEnter] User started speaking");
                this.emit("userStartSpeaking")
            },
            onExit: () => {
                if (this.silenceTimer) {
                    clearTimeout(this.silenceTimer);
                    this.silenceTimer = null;
                }
                const aiListening_Stop: AIListening_Stop = {
                    type: "listen",
                    state: "stop",
                    mode: "auto",
                };
                this.deps.callbacks.sendTextData(aiListening_Stop);
                console.log("[ChatStateManager][USER_SPEAKING.onExit] User stoped speaking");
                this.emit("userStopSpeaking")
            },
            handleAudioLevel: (audioLevel: number, data: Float32Array) => {
                this.deps.callbacks.sendAudioData(data);
                if (audioLevel < this.deps.thresholds.USER_SPEAKING) {
                    if (!this.silenceTimer) {
                        // 用户停止说话 {SLIENCE} 秒后，切换到 AI_SPEAKING 状态
                        this.silenceTimer = setTimeout(() => {
                            console.log("[ChatStateManager][USER_SPEAKING.handleAudioLevel] User stopped speaking, time's up");
                            this.setState(ChatState.AI_SPEAKING);
                            this.silenceTimer = null;
                        }, this.deps.timeout.SILENCE);
                    }
                } else {
                    this.deps.voiceAnimationManager?.updateUserWave(audioLevel);
                    if (this.silenceTimer) {
                        console.log("[ChatStateManager][USER_SPEAKING.handleAudioLevel] User is still speaking, clearing silence timer");
                        clearTimeout(this.silenceTimer);
                        this.silenceTimer = null;
                    }
                }
            },
        })

        this.transitions.set(ChatState.AI_SPEAKING, {
            onEnter: (oldState) => {
                if (oldState === ChatState.AI_SPEAKING) return;
                this.emit("aiStartSpeaking")
            },
            onExit: () => {
                this.emit("aiStopSpeaking")
            },
            handleAudioLevel: (audioLevel: number) => {
                this.emit("aiAudioLevelChange", audioLevel);
                if (audioLevel > this.deps.thresholds.USER_INTERRUPT_AI) {
                    const abortMessage: AbortMessage = {
                        type: "abort",
                        session_id: this.deps.callbacks.getSessionId(),
                    };
                    this.deps.callbacks.sendTextData(abortMessage);
                    this.setState(ChatState.USER_SPEAKING);
                }
            },
        })
    }

    public setState(newState: ChatState) {
        const oldState = this.currentState.value;
        const oldTransition = this.transitions.get(oldState);
        const newTransition = this.transitions.get(newState);
        oldTransition?.onExit?.();
        this._currentState.value = newState;
        console.log("[ChatStateManager][setState] State changed from", oldState, "to", newState)
        newTransition?.onEnter?.(oldState);
    }

    public handleUserAudioLevel(audioLevel: number, data: Float32Array) {
        this.emit("userAudioLevelChange", audioLevel);
        const currentTransition = this.transitions.get(this.currentState.value);
        currentTransition?.handleAudioLevel(audioLevel, data);
    }

    public handleAIAudioLevel(audioLevel: number) {
        if (this.currentState.value === ChatState.AI_SPEAKING) {
            this.deps.voiceAnimationManager?.updateAIWave(audioLevel);
        }
    }

    public destroy() {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }
}