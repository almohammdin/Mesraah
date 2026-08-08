(() => {
  const SOURCE = 'https://cdn.jsdelivr.net/gh/almohammdin/Mesraah@a9a36af543d82bb007139e8db4682c80cc39891e/native-live-v091.js';

  async function boot() {
    const response = await fetch(`${SOURCE}?v=095`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`native-live-source-${response.status}`);

    let code = await response.text();

    const oldBlock = `socket.addEventListener('message', event => {\n        let message;\n        try { message = JSON.parse(event.data); }\n        catch { return; }\n        handleServerMessage(message);\n        if (message.setupComplete && !settled) {\n          settled = true;\n          resolve();\n        }\n      });`;

    const newBlock = `socket.addEventListener('message', async event => {\n        try {\n          let raw;\n          if (typeof event.data === 'string') {\n            raw = event.data;\n          } else if (event.data instanceof Blob) {\n            raw = await event.data.text();\n          } else if (event.data instanceof ArrayBuffer) {\n            raw = new TextDecoder().decode(event.data);\n          } else if (ArrayBuffer.isView(event.data)) {\n            raw = new TextDecoder().decode(event.data);\n          } else {\n            raw = String(event.data ?? '');\n          }\n\n          const message = JSON.parse(raw);\n          handleServerMessage(message);\n          if (message.setupComplete && !settled) {\n            settled = true;\n            resolve();\n          }\n        } catch (error) {\n          console.warn('Mesraah Native Live frame decode:', error, event.data);\n          setDetail('وصل رد من Gemini لكن تعذر فكّه: ' + (error?.message || error));\n        }\n      });`;

    if (!code.includes(oldBlock)) throw new Error('v095-message-block-not-found');

    code = code
      .replace(oldBlock, newBlock)
      .replace('socket = new WebSocket(wsUrl);', `socket = new WebSocket(wsUrl);\n      socket.binaryType = 'arraybuffer';`)
      .replaceAll('Native Live v0.9.1', 'Native Live v0.9.5')
      .replaceAll('Mesraah Native Live v0.9.1', 'Mesraah Native Live v0.9.5');

    // Keep the v1alpha constrained endpoint used by the official GenAI SDK's
    // current ephemeral-token path. The only functional change in v0.9.5 is
    // robust decoding of String / Blob / ArrayBuffer WebSocket frames.
    (0, eval)(`${code}\n//# sourceURL=mesraah-native-live-v095-runtime.js`);
    window.__MESRAAH_NATIVE_LIVE_VERSION__ = '0.9.5';
  }

  boot().catch(error => {
    console.error('Mesraah Native Live v0.9.5 loader:', error);
    window.__MESRAAH_NATIVE_LIVE_LOAD_ERROR__ = String(error?.message || error);
  });
})();
