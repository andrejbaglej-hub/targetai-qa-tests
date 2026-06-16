import { TargetAIConfig } from '../types';
export interface WebRTCManagerEvents {
    connectionStateChange: (state: RTCPeerConnectionState) => void;
    dataChannelOpen: () => void;
    dataChannelClose: () => void;
    dataChannelMessage: (data: any) => void;
    audioTrack: (stream: MediaStream) => void;
    error: (error: Error) => void;
}
declare class SimpleEventEmitter {
    private events;
    on(event: string, listener: Function): this;
    emit(event: string, ...args: any[]): boolean;
    removeAllListeners(): this;
}
export declare class WebRTCManager extends SimpleEventEmitter {
    private peerConnection;
    private dataChannel;
    private config;
    constructor(config: TargetAIConfig);
    createPeerConnection(): Promise<RTCPeerConnection>;
    addMediaStream(stream: MediaStream): void;
    createOffer(): Promise<RTCSessionDescriptionInit>;
    setRemoteDescription(answer: RTCSessionDescriptionInit): Promise<void>;
    sendMessage(message: any): boolean;
    isConnected(): boolean;
    getConnectionState(): RTCPeerConnectionState | null;
    cleanup(): void;
    private setupPeerConnectionListeners;
    private setupDataChannel;
    private waitForICEGathering;
}
export {};
