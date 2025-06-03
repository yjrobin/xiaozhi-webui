import type { WebSocketMessage } from './message';

export interface WebSocketHandlers {
    onConnect?: () => void;
    onDisconnect?: (event: CloseEvent) => void;
    onError?: (err: unknown) => void;
    onAudioMessage: (event: Blob) => Promise<void>;
    onTextMessage: (message: WebSocketMessage) => Promise<void>;
}