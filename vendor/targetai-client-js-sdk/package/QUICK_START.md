# Quick Start: Testing TargetAI SDK in Browser

## 🚀 1. Build the SDK

```bash
npm run build
```

## 🌐 2. Start the Demo Server

```bash
npm run demo
```

This will:
- Build the SDK 
- Start a local HTTP server at `http://localhost:3000`
- Serve the demo page (no mock tokens)

## 🧪 3. Open the Demo Page

The server will start automatically. Open your browser and go to:

**http://localhost:3000/demo/demo.html**

## ⚙️ 4. Configure the Demo

In the demo page:

1. **Runtime Server URL**: Enter your TargetAI runtime server URL (e.g., `https://app.targetai.ai`)
2. **Token Server URL**: Enter your token server URL (e.g., `http://localhost:8001`)
3. **Agent UUID**: Enter your agent's UUID
4. **Response Types**: Check "Text responses" and/or "Voice responses"
5. **Raw Audio**: Optionally enable raw audio samples

## 🎮 5. Test the SDK

1. **Click "Start Call"**
   - Grant microphone permissions when prompted
   - Watch for "Call started successfully" message

2. **Test Text Messages**
   - Type a message in the input field
   - Click "Send" or press Enter
   - Watch for agent responses in the log

3. **Test Voice Input**
   - Speak into your microphone
   - Watch for speech recognition messages

4. **Test Audio Controls**
   - Use "Mute Mic" / "Mute Speaker" buttons
   - Monitor audio events in the log

5. **Stop the Call**
   - Click "Stop Call" when done
   - Check for clean disconnection

## 🐛 Troubleshooting

### Microphone Permission Issues
- Ensure you're using `http://localhost` (not `file://`)
- Check browser permissions (click microphone icon in address bar)
- Try refreshing the page and granting permissions again

### Connection Issues
- Verify your TargetAI server is running
- Check the server URL format (include `http://` or `https://`)
- Look for CORS errors in browser console

### Build Issues
- Run `npm install` if dependencies are missing
- Try `npm run build` again
- Check for TypeScript errors in console

## 📊 Monitor Debug Info

Open browser DevTools (F12) to see:
- **Console**: SDK log messages and errors
- **Network**: HTTP requests and WebRTC traffic  
- **Application**: Local storage and permissions

## 🔧 Manual Server Alternative

If the npm script doesn't work, start the demo server manually:

```bash
node test-server.js
```

Or use any HTTP server:

```bash
# Python
python -m http.server 3000

# Node.js http-server
npx http-server -p 3000 -c-1
```

## 🎯 Expected Behavior

**Successful Test Flow:**
1. ✅ "Call started successfully"
2. ✅ "Connection state: connected" 
3. ✅ Send text message → Agent responds
4. ✅ Speak → "Received audio samples" 
5. ✅ Agent voice plays → "Agent started/stopped talking"
6. ✅ "Call ended" on stop

**Sample Log Output:**
```
[10:30:15] 🚀 TargetAI SDK Test loaded
[10:30:20] 🔄 Starting call...
[10:30:22] ✓ Call started successfully
[10:30:22] 🔗 Connection state: connected
[10:30:25] 📤 You: Hello agent
[10:30:26] 📨 assistant: Hello! How can I help you?
[10:30:30] 🎤 Agent started talking
[10:30:33] 🔇 Agent stopped talking
```

## 📞 Next Steps

Once basic testing works:
- Integrate into your own application
- Customize the UI and event handling
- Add error handling and recovery
- Test with different browsers and devices

## 🆘 Need Help?

Check the full documentation:
- `README.md` - Complete API reference
- `TESTING.md` - Detailed testing guide
- Browser console for real-time debugging 