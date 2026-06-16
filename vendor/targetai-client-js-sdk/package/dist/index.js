'use strict';

exports.MessageRole = void 0;
(function (MessageRole) {
    MessageRole["USER"] = "user";
    MessageRole["ASSISTANT"] = "assistant";
    MessageRole["TOOL"] = "tool";
    MessageRole["TOOL_RESPONSE"] = "tool_response";
    MessageRole["ERROR"] = "error";
    MessageRole["FILLER"] = "filler";
    MessageRole["SYSTEM"] = "system";
    MessageRole["COMPLETION"] = "completion";
    MessageRole["PROCEDURE_NAVIGATION"] = "procedure_navigation";
})(exports.MessageRole || (exports.MessageRole = {}));
exports.EmissionType = void 0;
(function (EmissionType) {
    EmissionType["CONTENT"] = "content";
    EmissionType["RECOGNIZED_SPEECH"] = "recognized_speech";
    EmissionType["TOOL_CALL"] = "tool_call";
    EmissionType["TOOL_RESPONSE"] = "tool_response";
    EmissionType["PROCEDURE_NAVIGATION"] = "procedure_navigation";
    EmissionType["COMPLETION"] = "completion";
    EmissionType["ERROR"] = "error";
    EmissionType["INIT"] = "init";
})(exports.EmissionType || (exports.EmissionType = {}));

// Simple EventEmitter implementation for browser compatibility
let SimpleEventEmitter$1 = class SimpleEventEmitter {
    constructor() {
        this.events = {};
    }
    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        return this;
    }
    emit(event, ...args) {
        if (!this.events[event])
            return false;
        this.events[event].forEach(listener => {
            try {
                listener(...args);
            }
            catch (error) {
                console.error('Error in event listener:', error);
            }
        });
        return true;
    }
    removeAllListeners() {
        this.events = {};
        return this;
    }
};
class WebRTCManager extends SimpleEventEmitter$1 {
    constructor(config) {
        super();
        this.peerConnection = null;
        this.dataChannel = null;
        this.config = config;
    }
    async createPeerConnection() {
        if (this.peerConnection) {
            this.cleanup();
        }
        const rtcConfig = {
            iceTransportPolicy: 'relay',
            iceServers: this.config.iceServers || []
        };
        this.peerConnection = new RTCPeerConnection(rtcConfig);
        this.setupPeerConnectionListeners();
        this.setupDataChannel();
        return this.peerConnection;
    }
    addMediaStream(stream) {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }
        stream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, stream);
        });
    }
    async createOffer() {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        // Wait for ICE gathering
        await this.waitForICEGathering();
        return this.peerConnection.localDescription;
    }
    async setRemoteDescription(answer) {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }
        if (this.peerConnection.signalingState !== 'closed') {
            await this.peerConnection.setRemoteDescription(answer);
        }
    }
    sendMessage(message) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            return false;
        }
        try {
            this.dataChannel.send(JSON.stringify(message));
            return true;
        }
        catch (error) {
            console.error('[WebRTCManager] Error sending message:', error);
            return false;
        }
    }
    isConnected() {
        return this.peerConnection?.connectionState === 'connected';
    }
    getConnectionState() {
        return this.peerConnection?.connectionState || null;
    }
    cleanup() {
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        if (this.peerConnection) {
            // Stop all transceivers
            if (this.peerConnection.getTransceivers) {
                this.peerConnection.getTransceivers().forEach(transceiver => {
                    if (transceiver.stop) {
                        transceiver.stop();
                    }
                });
            }
            // Stop all senders
            this.peerConnection.getSenders().forEach(sender => {
                if (sender.track) {
                    sender.track.stop();
                }
            });
            this.peerConnection.close();
            this.peerConnection = null;
        }
    }
    setupPeerConnectionListeners() {
        if (!this.peerConnection)
            return;
        this.peerConnection.addEventListener('connectionstatechange', () => {
            const state = this.peerConnection.connectionState;
            console.log('[WebRTCManager] Connection state:', state);
            this.emit('connectionStateChange', state);
            if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                this.emit('error', new Error(`Connection ${state}`));
            }
        });
        this.peerConnection.addEventListener('iceconnectionstatechange', () => {
            console.log('[WebRTCManager] ICE connection state:', this.peerConnection.iceConnectionState);
        });
        this.peerConnection.addEventListener('track', (event) => {
            if (event.track.kind === 'audio') {
                console.log('[WebRTCManager] Received audio track');
                this.emit('audioTrack', event.streams[0]);
            }
        });
        this.peerConnection.addEventListener('datachannel', (event) => {
            console.log('[WebRTCManager] Received data channel:', event.channel.label);
        });
    }
    setupDataChannel() {
        if (!this.peerConnection)
            return;
        this.dataChannel = this.peerConnection.createDataChannel('messages', {
            negotiated: true,
            id: 0,
            ordered: true
        });
        this.dataChannel.addEventListener('open', () => {
            console.log('[WebRTCManager] Data channel opened');
            this.emit('dataChannelOpen');
        });
        this.dataChannel.addEventListener('close', () => {
            console.log('[WebRTCManager] Data channel closed');
            this.emit('dataChannelClose');
        });
        this.dataChannel.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);
                this.emit('dataChannelMessage', data);
            }
            catch (error) {
                console.warn('[WebRTCManager] Failed to parse message:', event.data);
            }
        });
        this.dataChannel.addEventListener('error', (error) => {
            console.error('[WebRTCManager] Data channel error:', error);
            this.emit('error', new Error('Data channel error'));
        });
    }
    waitForICEGathering() {
        return new Promise((resolve) => {
            if (!this.peerConnection) {
                resolve();
                return;
            }
            if (this.peerConnection.iceGatheringState === 'complete') {
                resolve();
            }
            else {
                const checkState = () => {
                    if (this.peerConnection.iceGatheringState === 'complete') {
                        this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
                        resolve();
                    }
                };
                this.peerConnection.addEventListener('icegatheringstatechange', checkState);
            }
        });
    }
}

class MessageProcessor {
    constructor() {
        this.lastTimestamp = null;
    }
    processMessage(rawMessage) {
        const now = Date.now();
        const delta = this.lastTimestamp ? now - this.lastTimestamp : null;
        this.lastTimestamp = now;
        if (!rawMessage.emission_type)
            return null;
        const baseMessage = {
            emission_type: rawMessage.emission_type,
            delta: delta || undefined
        };
        switch (rawMessage.emission_type) {
            case exports.EmissionType.CONTENT:
                return {
                    ...baseMessage,
                    role: exports.MessageRole.ASSISTANT,
                    content: rawMessage.content
                };
            case exports.EmissionType.RECOGNIZED_SPEECH:
                return {
                    ...baseMessage,
                    role: exports.MessageRole.USER,
                    content: rawMessage.content
                };
            case exports.EmissionType.TOOL_CALL:
                return {
                    ...baseMessage,
                    role: exports.MessageRole.TOOL,
                    call: rawMessage.call
                };
            case exports.EmissionType.TOOL_RESPONSE:
                return {
                    ...baseMessage,
                    role: exports.MessageRole.TOOL_RESPONSE,
                    response: rawMessage.response
                };
            case exports.EmissionType.PROCEDURE_NAVIGATION:
                return {
                    ...baseMessage,
                    role: exports.MessageRole.PROCEDURE_NAVIGATION,
                    navigation: rawMessage.navigation
                };
            case exports.EmissionType.COMPLETION:
                if (rawMessage.completion_type === 'turn')
                    return null;
                return {
                    ...baseMessage,
                    role: exports.MessageRole.COMPLETION,
                    completion_type: rawMessage.completion_type
                };
            case exports.EmissionType.ERROR:
                return {
                    ...baseMessage,
                    role: exports.MessageRole.ERROR,
                    error_message: rawMessage.error_message
                };
            case exports.EmissionType.INIT:
                return {
                    ...baseMessage,
                    role: exports.MessageRole.SYSTEM,
                    content: 'Starting new connection...'
                };
            default:
                console.warn('[MessageProcessor] Unknown emission type:', rawMessage.emission_type);
                return null;
        }
    }
    reset() {
        this.lastTimestamp = null;
    }
}

/**
 * Audio utility functions for TargetAI SDK
 */
/**
 * Convert unsigned 8-bit PCM to Float32 format
 */
function convertUnsigned8ToFloat32(uint8Array) {
    const float32Array = new Float32Array(uint8Array.length);
    for (let i = 0; i < uint8Array.length; i++) {
        // Convert from unsigned 8-bit (0-255) to signed float (-1.0 to 1.0)
        float32Array[i] = (uint8Array[i] - 128) / 128.0;
    }
    return float32Array;
}
/**
 * Convert Float32 to unsigned 8-bit PCM format
 */
function convertFloat32ToUnsigned8(float32Array) {
    const uint8Array = new Uint8Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Convert from signed float (-1.0 to 1.0) to unsigned 8-bit (0-255)
        const sample = Math.max(-1, Math.min(1, float32Array[i]));
        uint8Array[i] = Math.round((sample + 1) * 127.5);
    }
    return uint8Array;
}
/**
 * Get available audio input devices
 */
async function getAudioInputDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'audioinput');
    }
    catch (error) {
        console.error('Error getting audio input devices:', error);
        return [];
    }
}
/**
 * Get available audio output devices
 */
async function getAudioOutputDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'audiooutput');
    }
    catch (error) {
        console.error('Error getting audio output devices:', error);
        return [];
    }
}
/**
 * Create audio constraints with default values
 */
function createAudioConstraints(options = {}) {
    return {
        deviceId: options.deviceId ? { exact: options.deviceId } : undefined,
        sampleRate: options.sampleRate || 24000,
        echoCancellation: options.echoCancellation !== false,
        noiseSuppression: options.noiseSuppression !== false,
        autoGainControl: options.autoGainControl !== false,
        channelCount: 1
    };
}

class AudioManager {
    constructor() {
        this.microphoneStream = null;
        this.audioElement = null;
        this.audioContext = null;
        this.processor = null;
        this.setupAudioElement();
    }
    async setupMicrophone(options) {
        const constraints = {
            audio: createAudioConstraints({
                deviceId: options.captureDeviceId,
                sampleRate: options.sampleRate,
                echoCancellation: options.echoCancellation,
                noiseSuppression: options.noiseSuppression,
                autoGainControl: options.autoGainControl
            }),
            video: false
        };
        try {
            this.microphoneStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('[AudioManager] Microphone stream acquired');
            return this.microphoneStream;
        }
        catch (error) {
            throw new Error('Failed to access microphone. Please check permissions.');
        }
    }
    setupAudioOutput(stream, options) {
        if (!this.audioElement)
            return;
        this.audioElement.srcObject = stream;
        // Setup playback device if specified
        if (options.playbackDeviceId && this.audioElement.setSinkId) {
            this.audioElement.setSinkId(options.playbackDeviceId).catch((error) => {
                console.warn('[AudioManager] Failed to set audio output device:', error);
            });
        }
        // Setup raw audio extraction if enabled
        if (options.emitRawAudioSamples && this.onAudioData) {
            this.setupRawAudioExtraction(stream);
        }
    }
    setMicrophoneEnabled(enabled) {
        if (this.microphoneStream) {
            this.microphoneStream.getAudioTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
    }
    setSpeakerEnabled(enabled) {
        if (this.audioElement) {
            this.audioElement.muted = !enabled;
        }
    }
    onAudio(callback) {
        this.onAudioData = callback;
    }
    onAgentSpeaking(onStart, onStop) {
        this.onAgentStartTalking = onStart;
        this.onAgentStopTalking = onStop;
    }
    cleanup() {
        // Stop microphone
        if (this.microphoneStream) {
            this.microphoneStream.getTracks().forEach(track => track.stop());
            this.microphoneStream = null;
        }
        // Cleanup audio processing
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        // Remove audio element
        if (this.audioElement && this.audioElement.parentNode) {
            this.audioElement.parentNode.removeChild(this.audioElement);
            this.audioElement = null;
        }
    }
    setupAudioElement() {
        if (typeof window !== 'undefined') {
            this.audioElement = document.createElement('audio');
            this.audioElement.autoplay = true;
            this.audioElement.playsInline = true;
            this.audioElement.style.display = 'none';
            document.body.appendChild(this.audioElement);
            // Setup audio event listeners
            this.audioElement.addEventListener('play', () => {
                if (this.onAgentStartTalking) {
                    this.onAgentStartTalking();
                }
            });
            this.audioElement.addEventListener('pause', () => {
                if (this.onAgentStopTalking) {
                    this.onAgentStopTalking();
                }
            });
            this.audioElement.addEventListener('ended', () => {
                if (this.onAgentStopTalking) {
                    this.onAgentStopTalking();
                }
            });
        }
    }
    setupRawAudioExtraction(stream) {
        if (typeof window === 'undefined' || !window.AudioContext)
            return;
        try {
            this.audioContext = new AudioContext();
            const source = this.audioContext.createMediaStreamSource(stream);
            this.processor = this.audioContext.createScriptProcessor(1024, 1, 1);
            this.processor.onaudioprocess = (event) => {
                const audioData = event.inputBuffer.getChannelData(0);
                if (this.onAudioData) {
                    this.onAudioData(new Float32Array(audioData));
                }
            };
            source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
        }
        catch (error) {
            console.warn('[AudioManager] Could not setup raw audio extraction:', error);
        }
    }
}

// Using fetch API instead of axios for better browser compatibility
// Simple EventEmitter implementation for browser compatibility
class SimpleEventEmitter {
    constructor() {
        this.events = {};
    }
    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        return this;
    }
    emit(event, ...args) {
        if (!this.events[event])
            return false;
        this.events[event].forEach(listener => {
            try {
                listener(...args);
            }
            catch (error) {
                console.error('Error in event listener:', error);
            }
        });
        return true;
    }
    removeAllListeners() {
        this.events = {};
        return this;
    }
}
class TargetAIWebClient extends SimpleEventEmitter {
    constructor(config) {
        super();
        this.isCallActive = false;
        // Default configuration
        this.defaultConfig = {
            iceServers: [
                {
                    urls: 'turn:130.193.55.198:3478?transport=tcp',
                    username: 'glebd',
                    credential: 'pwdcdtfdghf'
                }
            ],
            audioConstraints: {
                autoGainControl: true,
                echoCancellation: true,
                noiseSuppression: false,
                channelCount: 1,
                sampleRate: 24000
            }
        };
        this.config = { ...this.defaultConfig, ...config };
        this.webrtcManager = new WebRTCManager(this.config);
        this.messageProcessor = new MessageProcessor();
        this.audioManager = new AudioManager();
        this.setupManagers();
    }
    async startCall(options) {
        if (this.isCallActive) {
            throw new Error('Call is already active');
        }
        try {
            console.log('[TargetAI] Starting call with options:', options);
            // Setup audio manager
            const audioOptions = {
                captureDeviceId: options.captureDeviceId,
                playbackDeviceId: options.playbackDeviceId,
                sampleRate: options.sampleRate,
                emitRawAudioSamples: options.emitRawAudioSamples
            };
            // Get microphone access
            const micStream = await this.audioManager.setupMicrophone(audioOptions);
            // Create WebRTC connection
            await this.webrtcManager.createPeerConnection();
            this.webrtcManager.addMediaStream(micStream);
            // Create offer and negotiate
            const offer = await this.webrtcManager.createOffer();
            await this.negotiate(offer, options);
            this.isCallActive = true;
            this.emit('call_started');
        }
        catch (error) {
            console.error('[TargetAI] Error starting call:', error);
            this.cleanup();
            this.emit('error', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    stopCall() {
        console.log('[TargetAI] Stopping call');
        this.cleanup();
        this.isCallActive = false;
        this.emit('call_ended');
    }
    sendMessage(message) {
        const payload = {
            text: message,
            stream: true
        };
        return this.webrtcManager.sendMessage(payload);
    }
    setMicrophoneEnabled(enabled) {
        this.audioManager.setMicrophoneEnabled(enabled);
    }
    setSpeakerEnabled(enabled) {
        this.audioManager.setSpeakerEnabled(enabled);
    }
    on(event, listener) {
        return super.on(event, listener);
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
    destroy() {
        this.stopCall();
        this.audioManager.cleanup();
        this.removeAllListeners();
    }
    /**
     * Get authentication token from token server
     */
    async getToken(payload = {}) {
        const tokenServerUrl = this.config.tokenServerUrl || this.config.serverUrl;
        const headers = {
            'Content-Type': 'application/json',
        };
        let response;
        let retried = false;
        while (true) {
            try {
                response = await fetch(`${tokenServerUrl}/token`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });
                break; // success
            }
            catch (error) {
                if (!retried && response && response.status === 401) {
                    console.warn('[TargetAI] Got 401, trying to generate token and retry...');
                    // Retry mechanism similar to negotiation.js
                    retried = true;
                    continue;
                }
                throw new Error(`Token request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        if (!response.ok) {
            throw new Error(`Token request failed with status: ${response.status}`);
        }
        const data = await response.json();
        if (!data.token) {
            throw new Error('Invalid token response: missing token');
        }
        return data.token;
    }
    setupManagers() {
        // Setup WebRTC Manager events
        this.webrtcManager.on('connectionStateChange', (state) => {
            this.emit('connection_state_change', state);
            if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                this.stopCall();
            }
        });
        this.webrtcManager.on('dataChannelOpen', () => {
            this.emit('data_channel_open');
        });
        this.webrtcManager.on('dataChannelClose', () => {
            this.emit('data_channel_close');
        });
        this.webrtcManager.on('dataChannelMessage', (data) => {
            this.handleDataChannelMessage(data);
        });
        this.webrtcManager.on('audioTrack', (stream) => {
            const audioOptions = {
                emitRawAudioSamples: true // This will be set based on startCall options
            };
            this.audioManager.setupAudioOutput(stream, audioOptions);
        });
        this.webrtcManager.on('error', (error) => {
            this.emit('error', error);
        });
        // Setup Audio Manager events
        this.audioManager.onAgentSpeaking(() => this.emit('agent_start_talking'), () => this.emit('agent_stop_talking'));
        this.audioManager.onAudio((audioData) => {
            this.emit('audio', audioData);
        });
    }
    handleDataChannelMessage(data) {
        if (data.error) {
            this.emit('error', new Error(data.error));
            return;
        }
        if (data.content) {
            const processedMessage = this.messageProcessor.processMessage(data.content);
            if (processedMessage) {
                // Handle termination completion
                if (processedMessage.role === exports.MessageRole.COMPLETION &&
                    processedMessage.completion_type === 'termination') {
                    setTimeout(() => this.stopCall(), 100);
                }
                this.emit('update', processedMessage);
            }
        }
    }
    async negotiate(offer, options) {
        try {
            console.log('[TargetAI] Getting authentication token...');
            const token = await this.getToken(options.tokenPayload || {});
            const payload = {
                sdp: offer.sdp,
                type: offer.type,
                agent_uuid: options.agentUuid,
                data_input: options.dataInput || {},
                messages: (options.messages || []).map((m) => ({
                    role: m.role,
                    content: m.content
                })),
                response_medium: this.getResponseMedium(options.allowedResponses || ['text', 'voice'])
            };
            console.log('[TargetAI] Sending offer with token authentication...');
            let response;
            let retried = false;
            while (true) {
                try {
                    response = await fetch(`${this.config.serverUrl}/run/voice/offer`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    });
                    break; // success
                }
                catch (error) {
                    if (!retried && response && response.status === 401) {
                        console.warn('[TargetAI] Got 401, trying to generate token and retry...');
                        const newToken = await this.getToken(options.tokenPayload || {});
                        // Update the authorization header for retry
                        retried = true;
                        continue;
                    }
                    console.error('[TargetAI] Server error during offer:', error);
                    if (response?.status === 500) {
                        throw new Error('Server error 500. The current agent version cannot be executed. This is a platform error, but you can try changing the agent parameters.');
                    }
                    throw new Error('Failed to connect to voice server. Please check your connection.');
                }
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('[TargetAI] Received answer from server');
            await this.webrtcManager.setRemoteDescription(data);
        }
        catch (error) {
            throw new Error(`Negotiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    getResponseMedium(allowedResponses) {
        if (allowedResponses.includes('text') && allowedResponses.includes('voice')) {
            return 'both';
        }
        else if (allowedResponses.includes('text')) {
            return 'chat';
        }
        else {
            return 'voice';
        }
    }
    cleanup() {
        this.webrtcManager.cleanup();
        this.messageProcessor.reset();
    }
}

exports.AudioManager = AudioManager;
exports.MessageProcessor = MessageProcessor;
exports.TargetAIWebClient = TargetAIWebClient;
exports.convertFloat32ToUnsigned8 = convertFloat32ToUnsigned8;
exports.convertUnsigned8ToFloat32 = convertUnsigned8ToFloat32;
exports.createAudioConstraints = createAudioConstraints;
exports.getAudioInputDevices = getAudioInputDevices;
exports.getAudioOutputDevices = getAudioOutputDevices;
