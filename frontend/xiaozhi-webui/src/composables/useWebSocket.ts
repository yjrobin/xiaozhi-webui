// services/WebSocketService.ts
import { ref } from 'vue'
import type { Ref } from 'vue'
import { useSettingStore } from '@/stores/setting'
import type { WebSocketMessage, AudioParams, WebSocketHandlers } from '@/types/websocket'

export class WebSocketService {
    private ws: WebSocket | null = null
    private configStore = useSettingStore()
    public connectionStatus: Ref<'connected' | 'disconnected' | 'error'>
    private handlers: WebSocketHandlers
    private reconnectTimer: number | null = null

    constructor(handlers: WebSocketHandlers) {
        this.connectionStatus = ref('disconnected')
        this.handlers = handlers
    }

    public connect(): void {
        const WSProxyURL = this.configStore.wsProxyURL
        this.ws = new WebSocket(WSProxyURL)

        this.ws.onopen = this.handleOpen.bind(this)
        this.ws.onclose = this.handleClose.bind(this)
        this.ws.onerror = this.handleError.bind(this)
        this.ws.onmessage = this.handleMessage.bind(this)
    }

    public disconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
        this.ws?.close()
        this.ws = null
    }

    public sendTextMessage(message: any): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn("[WebSocketService] Connection not ready")
            return
        }

        const data = typeof message === 'string' ? message : JSON.stringify(message)
        this.ws.send(data)
    }

    public sendAudioMessage(data: Float32Array): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn("[WebSocketService] Connection not ready")
            return
        }
        this.ws.send(data)
    }

    private handleOpen(): void {
        console.log("[WebSocketService] Connected to server:", this.configStore.wsProxyURL)
        this.connectionStatus.value = "connected"

        // 发送 Hello 消息
        this.sendHelloMessage()
        this.handlers.onConnect?.()
    }

    private handleClose(event: CloseEvent): void {
        console.log(`[WebSocketService] Connection closed: ${event.code} ${event.reason}`)
        this.connectionStatus.value = "disconnected"
        this.configStore.sessionID = ""
        this.handlers.onDisconnect?.(event)

        // 3秒后重连
        this.reconnectTimer = window.setTimeout(() => {
            this.connect()
        }, 3000)
    }

    private handleError(error: Event): void {
        console.error("[WebSocketService] Error:", error)
        this.connectionStatus.value = "error"
        this.handlers.onError?.(error)
    }

    private async handleMessage(event: MessageEvent<any>): Promise<void> {
        try {
            if (event.data instanceof Blob) {
                await this.handleAudioMessage(event.data)
            } else {
                await this.handleTextMessage(event.data)
            }
        } catch (e) {
            console.error("[WebSocketService][handleMessage] Error processing message:", e)
        }
    }

    private async handleAudioMessage(data: Blob): Promise<void> {
        await this.handlers.onAudioMessage?.(data)
    }

    private async handleTextMessage(data: any): Promise<void> {
        const message = JSON.parse(data) as WebSocketMessage
        if (message.type === "hello") {
            this.configStore.sessionID = message.session_id!
        }
        await this.handlers.onTextMessage?.(message)
    }

    private sendHelloMessage(): void {
        const helloMessage = {
            type: "hello",
            version: 3,
            transport: "websocket",
            audio_params: {
                format: "opus",
                sample_rate: 16000,
                channels: 1,
                frame_duration: 60,
            } as AudioParams
        }
        this.sendTextMessage(helloMessage)
    }
}