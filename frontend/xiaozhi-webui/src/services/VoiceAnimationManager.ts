import { ref } from "vue";

export class VoiceAnimationManager {
    private readonly maxWaveHeight: number = 24;
    private readonly minWaveHeight: number = 6;
    private readonly maxAIScale: number = 1.05;
    public voiceWaveHeight = ref<number>(0);
    public aiSpeaking = ref<boolean>(false);
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
        if (audioLevel > 0.01) {
            this.avatarScale.value = 1 + Math.min(this.maxAIScale - 1, audioLevel * 2);
            this.aiSpeaking.value = true;
        } else {
            this.avatarScale.value = 1;
            this.aiSpeaking.value = false;
        }
    }
}