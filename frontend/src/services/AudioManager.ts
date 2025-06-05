export class AudioService {
  private static instance: AudioService;
  private _audioContext: AudioContext;

  private constructor() {
    this._audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000,
    }); // 兼容苹果 Safari 浏览器
  }

  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  public async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return await this._audioContext.decodeAudioData(arrayBuffer);
  }

  public getAudioContext(): AudioContext {
    return this._audioContext;
  }
}