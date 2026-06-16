# TargetAI JavaScript SDK

A JavaScript SDK for connecting to TargetAI voice agents via WebRTC, similar to the Retell client SDK.

## Installation

```bash
npm install targetai-client-js-sdk
```

## Quick Start

```javascript
import { TargetAIWebClient } from 'targetai-client-js-sdk';

// Create client instance with token authentication
const client = new TargetAIWebClient({
  serverUrl: 'https://your-runtime-server.com',      // Runtime server (/run/voice/offer)
  tokenServerUrl: 'https://your-token-server.com',   // Token server (/token)
});

// Set up event listeners
client.on('call_started', () => {
  console.log('Call started');
});

client.on('call_ended', () => {
  console.log('Call ended');
});

client.on('update', (message) => {
  console.log('Received message:', message);
});

client.on('error', (error) => {
  console.error('Error:', error);
});

// Start a call (automatically gets token and authenticates)
await client.startCall({
  agentUuid: 'your-agent-uuid',
  allowedResponses: ['text', 'voice']
});

// Send a message
client.sendMessage('Hello, agent!');

// Stop the call
client.stopCall();
```

## Token Authentication Flow

The SDK uses token-based authentication similar to the frontend negotiation pattern:

1. **Token Request**: Browser → Token Server (`/token`) → Get Token
2. **WebRTC Offer**: Browser → Runtime Server (`/run/voice/offer`) with Token → WebRTC Connection  
3. **Auto-Retry**: If 401 response, automatically retries with new token

## API Reference

### Constructor

```javascript
const client = new TargetAIWebClient(config);
```

**Config Options:**
- `serverUrl` (string, required): Your TargetAI runtime server URL (where `/run/voice/offer` endpoint is)
- `tokenServerUrl` (string, optional): Token server URL (where `/token` endpoint is). Defaults to `serverUrl`
- `apiKey` (string, optional): API key for token generation
- `iceServers` (RTCIceServer[], optional): Custom ICE servers for WebRTC
- `audioConstraints` (object, optional): Audio input constraints

### Methods

#### `startCall(options)`

Starts a voice call with the agent.

**Options:**
- `agentUuid` (string, required): The UUID of the agent to connect to
- `dataInput` (object, optional): Initial data to pass to the agent
- `messages` (Message[], optional): Initial conversation messages
- `allowedResponses` (string[], optional): Array of allowed response types: `['text', 'voice']`
- `sampleRate` (number, optional): Audio sample rate (default: 24000)
- `captureDeviceId` (string, optional): Microphone device ID
- `playbackDeviceId` (string, optional): Speaker device ID
- `emitRawAudioSamples` (boolean, optional): Whether to emit raw audio data

```javascript
await client.startCall({
  agentUuid: 'agent-123',
  allowedResponses: ['text', 'voice'],
  sampleRate: 24000,
  emitRawAudioSamples: true
});
```

#### `stopCall()`

Stops the current call and cleans up resources.

#### `sendMessage(message)`

Sends a text message to the agent.

**Parameters:**
- `message` (string): The message to send

**Returns:** `boolean` - True if message was sent successfully

#### `destroy()`

Completely destroys the client instance and cleans up all resources.

### Events

#### `call_started`
Fired when the call begins successfully.

#### `call_ended`
Fired when the call ends.

#### `agent_start_talking`
Fired when the agent starts speaking.

#### `agent_stop_talking`
Fired when the agent stops speaking.

#### `update`
Fired when a new message is received from the agent.

**Parameters:**
- `message` (Message): The processed message object

#### `audio`
Fired when raw audio data is available (if `emitRawAudioSamples` is enabled).

**Parameters:**
- `audioData` (Float32Array): Raw PCM audio data

#### `error`
Fired when an error occurs.

**Parameters:**
- `error` (Error): The error object

#### `connection_state_change`
Fired when the WebRTC connection state changes.

**Parameters:**
- `state` (RTCPeerConnectionState): The new connection state

## Message Types

The SDK handles various message types from the agent:

- `user`: Messages from the user (speech recognition)
- `assistant`: Agent responses
- `tool`: Tool/function calls
- `tool_response`: Tool/function responses
- `system`: System messages
- `error`: Error messages
- `completion`: Task completion notifications

## Audio Utilities

The SDK includes audio utility functions:

```javascript
import { 
  convertUnsigned8ToFloat32, 
  convertFloat32ToUnsigned8,
  getAudioInputDevices,
  getAudioOutputDevices 
} from 'targetai-client-js-sdk';

// Get available audio devices
const inputDevices = await getAudioInputDevices();
const outputDevices = await getAudioOutputDevices();

// Convert audio formats
const float32Audio = convertUnsigned8ToFloat32(uint8Array);
const uint8Audio = convertFloat32ToUnsigned8(float32Array);
```

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

Requires WebRTC support and microphone permissions.

## Error Handling

```javascript
client.on('error', (error) => {
  console.error('SDK Error:', error.message);
  
  // Handle specific error types
  if (error.message.includes('microphone')) {
    // Handle microphone permission error
  } else if (error.message.includes('negotiation')) {
    // Handle WebRTC negotiation error
  }
});
```

## Example: Complete Voice Chat

```html
<!DOCTYPE html>
<html>
<head>
    <title>TargetAI Voice Chat</title>
</head>
<body>
    <button id="startCall">Start Call</button>
    <button id="stopCall" disabled>Stop Call</button>
    <input type="text" id="messageInput" placeholder="Type a message..." disabled>
    <button id="sendMessage" disabled>Send</button>
    <div id="messages"></div>

    <script type="module">
        import { TargetAIWebClient } from './dist/index.esm.js';

        const client = new TargetAIWebClient({
            serverUrl: 'https://your-server.com'
        });

        const startBtn = document.getElementById('startCall');
        const stopBtn = document.getElementById('stopCall');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendMessage');
        const messagesDiv = document.getElementById('messages');

        // Event listeners
        client.on('call_started', () => {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            messageInput.disabled = false;
            sendBtn.disabled = false;
            addMessage('System: Call started');
        });

        client.on('call_ended', () => {
            startBtn.disabled = false;
            stopBtn.disabled = true;
            messageInput.disabled = true;
            sendBtn.disabled = true;
            addMessage('System: Call ended');
        });

        client.on('update', (message) => {
            addMessage(`${message.type}: ${message.content || JSON.stringify(message)}`);
        });

        client.on('error', (error) => {
            addMessage(`Error: ${error.message}`);
        });

        // UI event handlers
        startBtn.onclick = async () => {
            try {
                await client.startCall({
                    agentUuid: 'your-agent-uuid',
                    allowedResponses: ['text', 'voice']
                });
            } catch (error) {
                alert('Failed to start call: ' + error.message);
            }
        };

        stopBtn.onclick = () => {
            client.stopCall();
        };

        sendBtn.onclick = () => {
            const message = messageInput.value.trim();
            if (message) {
                client.sendMessage(message);
                addMessage(`You: ${message}`);
                messageInput.value = '';
            }
        };

        messageInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                sendBtn.click();
            }
        };

        function addMessage(text) {
            const div = document.createElement('div');
            div.textContent = `${new Date().toLocaleTimeString()}: ${text}`;
            messagesDiv.appendChild(div);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    </script>
</body>
</html>
```

## Building the SDK

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Run tests
npm test
```

## License

ISC 