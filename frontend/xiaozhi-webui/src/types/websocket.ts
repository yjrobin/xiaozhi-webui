// types/websocket.ts
export interface WebSocketMessage {
    type: 'hello' | 'stt' | 'llm' | 'tts'
    state?: 'start' | 'stop' | 'detect' | 'sentence_start' | 'sentence_end'
    text?: string
    source?: string
    session_id?: string
    mode?: string
}

export interface AudioParams {
    format: string
    sample_rate: number
    channels: number
    frame_duration: number
}

export interface HelloMessage {
    type: 'hello'
    version: number
    transport: string
    audio_params: AudioParams
}

export interface WebSocketHandlers {
    onConnect?: () => void;
    onDisconnect?: (event: CloseEvent) => void;
    onError?: (err: unknown) => void;
    onAudioMessage: (event: Blob) => Promise<void>;
    onTextMessage: (message: WebSocketMessage) => Promise<void>;
}