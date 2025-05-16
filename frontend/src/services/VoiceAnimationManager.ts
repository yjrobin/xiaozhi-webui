import { ref } from "vue";

export class VoiceAnimationManager {
    private readonly maxWaveHeight: number = 24;
    private readonly minWaveHeight: number = 6;
    private readonly maxAIScale: number = 1.05;
    public voiceWaveHeight = ref<number>(0);
    public avatarScale = ref<number>(1);

    constructor() { }

    public updateUserWave(audioLevel: number) {
        if (audioLevel > 0.01) {
            this.voiceWaveHeight.value = Math.min(
                this.maxWaveHeight,
                this.minWaveHeight + audioLevel * 100
            );;
        } else {
            this.voiceWaveHeight.value = this.minWaveHeight;
        }
    }

    public updateAIWave(audioLevel: number) {
        this.avatarScale.value = 1 + Math.min(this.maxAIScale - 1, audioLevel * 200 - 0.1);
        this.avatarScale.value = Math.max(this.avatarScale.value, 1);
    }
}