export type VoiceEventType =
    | 'userStartSpeaking'
    | 'userStopSpeaking'
    | 'aiStartSpeaking'
    | 'aiStopSpeaking'
    | 'userAudioLevelChange'
    | 'aiAudioLevelChange'
    | 'idleEnter'
    | 'stateChange'

export type VoiceEventHandler = (data?: any) => void;

export enum VoiceState {
    IDLE = "idle",
    AI_SPEAKING = "ai_speaking",
    USER_SPEAKING = "user_speaking",
    INTERRUPTED = 'interrupted'
}


export interface VoiceStateConfig {
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
        getSessionID: () => string;
    }
}

// 状态转换接口
export interface VoiceStateTransition {
    onEnter?: () => void;
    onExit?: () => void;
    handleAudioLevel: (audioLevel: number, data?: any) => void;
}