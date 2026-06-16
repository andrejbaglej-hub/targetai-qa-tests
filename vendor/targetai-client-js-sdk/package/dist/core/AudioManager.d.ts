export interface AudioManagerOptions {
    captureDeviceId?: string;
    playbackDeviceId?: string;
    sampleRate?: number;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
    emitRawAudioSamples?: boolean;
}
export declare class AudioManager {
    private microphoneStream;
    private audioElement;
    private audioContext;
    private processor;
    private onAudioData?;
    private onAgentStartTalking?;
    private onAgentStopTalking?;
    constructor();
    setupMicrophone(options: AudioManagerOptions): Promise<MediaStream>;
    setupAudioOutput(stream: MediaStream, options: AudioManagerOptions): void;
    setMicrophoneEnabled(enabled: boolean): void;
    setSpeakerEnabled(enabled: boolean): void;
    onAudio(callback: (data: Float32Array) => void): void;
    onAgentSpeaking(onStart: () => void, onStop: () => void): void;
    cleanup(): void;
    private setupAudioElement;
    private setupRawAudioExtraction;
}
