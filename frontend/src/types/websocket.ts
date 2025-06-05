import type { WebSocketMessage } from './message';

export interface WebSocketHandlers {
    onConnect?: () => void;
    onDisconnect?: (event: CloseEvent) => void;
    onError?: (err: unknown) => void;
    onAudioMessage: (audioBuffer: AudioBuffer) => Promise<void>;
    onTextMessage: (message: WebSocketMessage) => Promise<void>;
}

export interface WebSocketDependencies {
    decodeAudioData: (arrayBuffer: ArrayBuffer) => Promise<AudioBuffer>;
}