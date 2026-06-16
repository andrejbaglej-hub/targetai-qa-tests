export interface TargetAIConfig {
    serverUrl: string;
    tokenServerUrl?: string;
    iceServers?: RTCIceServer[];
    audioConstraints?: MediaStreamConstraints['audio'];
}
export interface StartCallOptions {
    agentUuid: string;
    dataInput?: Record<string, any>;
    messages?: Message[];
    allowedResponses?: string[];
    sampleRate?: number;
    captureDeviceId?: string;
    playbackDeviceId?: string;
    emitRawAudioSamples?: boolean;
    /**
     * Optional payload to send to the /token endpoint so the backend can
     * associate the call with a specific client/user/workspace, etc.
     */
    tokenPayload?: Record<string, any>;
}
export declare enum MessageRole {
    USER = "user",
    ASSISTANT = "assistant",
    TOOL = "tool",
    TOOL_RESPONSE = "tool_response",
    ERROR = "error",
    FILLER = "filler",
    SYSTEM = "system",
    COMPLETION = "completion",
    PROCEDURE_NAVIGATION = "procedure_navigation"
}
export declare enum EmissionType {
    CONTENT = "content",
    RECOGNIZED_SPEECH = "recognized_speech",
    TOOL_CALL = "tool_call",
    TOOL_RESPONSE = "tool_response",
    PROCEDURE_NAVIGATION = "procedure_navigation",
    COMPLETION = "completion",
    ERROR = "error",
    INIT = "init"
}
export interface Message {
    /**
     * Message role used by backend ("user", "assistant", "system", "tool", etc.)
     */
    role: MessageRole;
    content?: string;
    emission_type?: EmissionType;
    delta?: number;
    call?: ToolCall;
    response?: ToolResponse;
    navigation?: ProcedureNavigation;
    completion_type?: string;
    error_message?: string;
}
export interface ToolCall {
    tool_name: string;
    tool_type: string;
    call_reason: string;
    arguments: Record<string, any>;
}
export interface ToolResponse {
    tool_name: string;
    tool_type: string;
    result: any;
}
export interface ProcedureNavigation {
    origin: string;
    motivation: string;
    choice: number;
    is_action: boolean;
}
export interface CallEvents {
    call_started: () => void;
    call_ended: () => void;
    agent_start_talking: () => void;
    agent_stop_talking: () => void;
    audio: (audio: Float32Array) => void;
    update: (message: Message) => void;
    metadata: (metadata: any) => void;
    error: (error: Error) => void;
    connection_state_change: (state: RTCPeerConnectionState) => void;
    data_channel_open: () => void;
    data_channel_close: () => void;
}
export type CallEventName = keyof CallEvents;
export interface TokenResponse {
    token: string;
}
