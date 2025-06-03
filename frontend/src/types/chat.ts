export type ChatEventType =
    | 'userStartSpeaking'
    | 'userStopSpeaking'
    | 'aiStartSpeaking'
    | 'aiStopSpeaking'
    | 'userAudioLevelChange'
    | 'aiAudioLevelChange'
    | 'stateChange'

export type ChatEventHandler = (data?: any) => void;

export enum ChatState {
    IDLE = "idle",
    AI_SPEAKING = "ai_speaking",
    USER_SPEAKING = "user_speaking",
    INTERRUPTED = 'interrupted'
}

export interface ChatStateConfig {
    thresholds: {
        USER_SPEAKING: number;
        USER_INTERRUPT_AI: number;
    };
    timeout: {
        SILENCE: number;
    };
    callbacks: {
        sendAudioData: (data: Float32Array) => void;
        sendTextData: (text: string) => void;
        getSessionId: () => string;
    }
}

// 状态转换接口
export interface ChatStateTransition {
    onEnter?: () => void;
    onExit?: () => void;
    handleAudioLevel: (audioLevel: number, data?: any) => void;
}