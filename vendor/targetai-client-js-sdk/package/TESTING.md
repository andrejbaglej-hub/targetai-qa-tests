# Testing the TargetAI JavaScript SDK

## Prerequisites

1. **Built SDK**: Make sure you've built the SDK first:
   ```bash
   npm run build
   ```

2. **Server Running**: Your TargetAI server should be running and accessible

3. **HTTPS or localhost**: Modern browsers require HTTPS for microphone access (or localhost for development)

## Testing Methods

### Method 1: Using the Included Test Page (Recommended)

The easiest way to test the SDK is using the included test page:

1. **Open the test page**:
   ```bash
   # Open in your browser
   open test/test.html
   # Or on Windows:
   start test/test.html
   ```

2. **Configure the test**:
   - Enter your server URL (e.g., `http://localhost:8000`)
   - Enter your agent UUID
   - Select response types (text/voice)
   - Optionally enable raw audio samples

3. **Test the connection**:
   - Click "Start Call"
   - Grant microphone permissions when prompted
   - Watch the log for connection events
   - Try sending text messages
   - Speak to test voice input

### Method 2: Simple HTTP Server

If opening the HTML file directly doesn't work (due to CORS issues), serve it with a simple HTTP server:

```bash
# Using Python 3
python -m http.server 8080

# Using Node.js (install http-server first: npm install -g http-server)
http-server -p 8080

# Using PHP
php -S localhost:8080
```

Then open `http://localhost:8080/test/test.html` in your browser.

### Method 3: Custom HTML Page

Create your own test page:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My TargetAI Test</title>
</head>
<body>
    <button id="start">Start Call</button>
    <button id="stop">Stop Call</button>
    <input type="text" id="message" placeholder="Type message...">
    <button id="send">Send</button>
    <div id="log"></div>

    <script type="module">
        import { TargetAIWebClient } from './sdk/node_client/dist/index.esm.js';

        const client = new TargetAIWebClient({
            serverUrl: 'http://localhost:8000'  // Replace with your server
        });

        // Event listeners
        client.on('call_started', () => console.log('Call started'));
        client.on('call_ended', () => console.log('Call ended'));
        client.on('update', (msg) => console.log('Message:', msg));
        client.on('error', (err) => console.error('Error:', err));

        // Controls
        document.getElementById('start').onclick = async () => {
            await client.startCall({
                agentUuid: 'your-agent-uuid',
                allowedResponses: ['text', 'voice']
            });
        };

        document.getElementById('stop').onclick = () => client.stopCall();
        document.getElementById('send').onclick = () => {
            const msg = document.getElementById('message').value;
            if (msg) {
                client.sendMessage(msg);
                document.getElementById('message').value = '';
            }
        };
    </script>
</body>
</html>
```

## Common Issues and Solutions

### 1. Microphone Permission Denied
- **Problem**: Browser blocks microphone access
- **Solution**: 
  - Use HTTPS or localhost
  - Click the microphone icon in browser address bar
  - Check browser settings for microphone permissions

### 2. CORS Errors
- **Problem**: Browser blocks requests due to CORS policy
- **Solution**:
  - Serve files through HTTP server (not file://)
  - Configure your TargetAI server to allow CORS
  - Use proper domain/localhost

### 3. WebRTC Connection Failed
- **Problem**: Cannot establish WebRTC connection
- **Solution**:
  - Check if your server is running
  - Verify server URL is correct
  - Check firewall settings
  - Ensure TURN server is accessible

### 4. Module Import Errors
- **Problem**: Cannot import ES modules
- **Solution**:
  - Use `type="module"` in script tag
  - Serve via HTTP server (not file://)
  - Use correct relative path to dist/index.esm.js

## Testing Checklist

- [ ] Build completes without errors
- [ ] Test page loads without console errors
- [ ] Can grant microphone permissions
- [ ] "Start Call" connects successfully
- [ ] Can send text messages
- [ ] Can receive agent responses
- [ ] Voice input is recognized
- [ ] Agent voice output plays
- [ ] "Stop Call" disconnects cleanly
- [ ] No memory leaks after multiple calls

## Debug Mode

Enable additional logging by opening browser console (F12) and setting:

```javascript
// Enable debug mode
localStorage.setItem('DEBUG', 'targetai:*');
```

## Network Tab Debugging

1. Open DevTools (F12)
2. Go to Network tab
3. Start a call
4. Look for:
   - `/run/voice/offer` POST request
   - WebRTC STUN/TURN traffic
   - WebSocket connections (if any)

## Console Debugging

Watch the browser console for:
- `[TargetAI]` log messages
- `[WebRTCManager]` connection events
- `[AudioManager]` audio setup logs
- `[MessageProcessor]` message processing

## Performance Testing

Monitor in DevTools:
- Memory usage (shouldn't grow after stopping calls)
- CPU usage during calls
- Network bandwidth for audio streams
- Audio latency and quality 