/**
 * Audio utility functions for TargetAI SDK
 */
/**
 * Convert unsigned 8-bit PCM to Float32 format
 */
export declare function convertUnsigned8ToFloat32(uint8Array: Uint8Array): Float32Array;
/**
 * Convert Float32 to unsigned 8-bit PCM format
 */
export declare function convertFloat32ToUnsigned8(float32Array: Float32Array): Uint8Array;
/**
 * Get available audio input devices
 */
export declare function getAudioInputDevices(): Promise<MediaDeviceInfo[]>;
/**
 * Get available audio output devices
 */
export declare function getAudioOutputDevices(): Promise<MediaDeviceInfo[]>;
/**
 * Create audio constraints with default values
 */
export declare function createAudioConstraints(options?: {
    deviceId?: string;
    sampleRate?: number;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
}): MediaTrackConstraints;
