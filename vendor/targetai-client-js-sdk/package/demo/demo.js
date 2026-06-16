// Simple test script for browser demo
// Note: This is for browser environment testing

console.log('🚀 TargetAI Browser SDK Demo Test');

// This script demonstrates how to use the browser SDK with token authentication
// For actual browser testing, use demo.html which imports the built SDK

try {
  console.log('✓ SDK test script loaded successfully');
  
  // Example configuration for real servers
  const config = {
    serverUrl: 'https://app.targetai.ai',  // Production runtime server URL
    tokenServerUrl: 'http://localhost:8001', // Your token server URL
    iceServers: [
      {
        urls: 'turn:130.193.55.198:3478?transport=tcp',
        username: 'glebd',
        credential: 'pwdcdtfdghf'
      }
    ]
  };
  
  console.log('✓ Test configuration created');
  
  // Test call options that would be used in browser
  const callOptions = {
    agentUuid: 'your-actual-agent-uuid',
    dataInput: { test: 'data' },
    allowedResponses: ['text', 'voice'],
    sampleRate: 24000,
    emitRawAudioSamples: false
  };
  
  console.log('✓ Call options configured');
  
  // Example usage documentation (browser-only features commented out)
  console.log('\n📖 Example Browser Usage with Token Authentication:');
  console.log('```javascript');
  console.log('import { TargetAIWebClient } from "./dist/index.esm.js";');
  console.log('');
  console.log('const client = new TargetAIWebClient({');
  console.log('  serverUrl: "https://app.targetai.ai",  // Runtime server');
  console.log('  tokenServerUrl: "http://localhost:8001",  // Your token server');
  console.log('});');
  console.log('');
  console.log('// Setup event listeners');
  console.log('client.on("call_started", () => {');
  console.log('  console.log("Call started successfully");');
  console.log('});');
  console.log('');
  console.log('client.on("update", (message) => {');
  console.log('  console.log("Received message:", message);');
  console.log('});');
  console.log('');
  console.log('client.on("error", (error) => {');
  console.log('  console.error("Call error:", error);');
  console.log('});');
  console.log('');
  console.log('// Start a call (will automatically get token)');
  console.log('await client.startCall({');
  console.log('  agentUuid: "your-agent-uuid",');
  console.log('  allowedResponses: ["text", "voice"],');
  console.log('  sampleRate: 24000');
  console.log('});');
  console.log('');
  console.log('// Send a message');
  console.log('client.sendMessage("Hello, agent!");');
  console.log('');
  console.log('// Stop the call');
  console.log('client.stopCall();');
  console.log('```');
  
  console.log('\n🎯 Token Authentication Flow:');
  console.log('1. Client automatically requests token from tokenServerUrl (or serverUrl)');
  console.log('2. Token is included in Authorization header for /run/voice/offer');
  console.log('3. If 401 response, client automatically retries with new token');
  console.log('4. Real tokens are required - no test/demo tokens will work');
  
  console.log('\n✓ Test completed successfully');
  console.log('\n🌐 To test the SDK in a browser:');
  console.log('1. Build the SDK: npm run build');
  console.log('2. Set up your token server with valid API key');
  console.log('3. Open demo/demo.html in your browser');
  console.log('4. Configure your server URLs and agent UUID');
  console.log('5. Click "Start Call" to begin testing');
  
} catch (error) {
  console.error('✗ Test failed:', error);
  if (typeof process !== 'undefined') {
    process.exit(1);
  }
} 