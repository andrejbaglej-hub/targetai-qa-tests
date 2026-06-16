import { TargetAIConfig, StartCallOptions, CallEvents, CallEventName } from './types';
declare class SimpleEventEmitter {
    private events;
    on(event: string, listener: Function): this;
    emit(event: string, ...args: any[]): boolean;
    removeAllListeners(): this;
}
export declare class TargetAIWebClient extends SimpleEventEmitter {
    private config;
    private webrtcManager;
    private messageProcessor;
    private audioManager;
    private isCallActive;
    private defaultConfig;
    constructor(config: TargetAIConfig);
    startCall(options: StartCallOptions): Promise<void>;
    stopCall(): void;
    sendMessage(message: string): boolean;
    setMicrophoneEnabled(enabled: boolean): void;
    setSpeakerEnabled(enabled: boolean): void;
    on<K extends CallEventName>(event: K, listener: CallEvents[K]): this;
    emit<K extends CallEventName>(event: K, ...args: Parameters<CallEvents[K]>): boolean;
    destroy(): void;
    /**
     * Get authentication token from token server
     */
    private getToken;
    private setupManagers;
    private handleDataChannelMessage;
    private negotiate;
    private getResponseMedium;
    private cleanup;
}
export {};
