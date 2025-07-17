// main.js
// Código principal convertido do Tampermonkey para contexto de página
(function () {
  "use strict";

  console.log("[Jigsaw Interceptor] Main injected code");

  const BACKEND_PORT = 8080;

  function debug(...args) {
    console.log("[Jigsaw Interceptor] -", ...args);
  }

  const hashTable = {
    // Firefox
    "0af08cd3a5b0cc94699b408c9b6dabae8af4889b": "pick",
    "9069ca78e7450a285173431b3e52c5c25299e473": "first-pick",
    e21e8aa400bee300fa75ff299b8a75a6d2d6bdb0: "drop",
    f414a132f51bfe62f224c2ffecd0acb2fe396e48: "place",
    // Chrome
    "80012c4a378d1cc611b4b38591b3eb170a4c8653": "pick",
    "9069ca78e7450a285173431b3e52c5c25299e473": "first-pick",
    ca3268cf5b8db638e02e63ddd56a3bcb80b93d04: "drop",
  };

  // HTML Canvas Interceptor: prevent drawing buffer to be cleaned, otherwise, canvas prints will be tainted
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    if (type === "webgl" || type === "webgl2") {
      let contextAttributes = args[0] || {};
      contextAttributes.preserveDrawingBuffer = true;

      return originalGetContext.call(this, type, contextAttributes);
    }

    return originalGetContext.apply(this, [type, ...args]);
  };

  const originalAudioContext = window.AudioContext;

  window.AudioContext = function (...args) {
    const context = new originalAudioContext(...args);

    const originalCreateBufferSource = context.createBufferSource;

    context.createBufferSource = (...args2) => {
      const source = originalCreateBufferSource.apply(context, args2);

      const originalStart = source.start;

      source.start = (...args3) => {
        generateAudioHash(source)
          .then((hashHex) => {
            const hashMatch = hashTable[hashHex];

            debug("Sound:", hashMatch ?? "unknow", hashHex);

            if (hashMatch === "place") {
              processPlace();
            }
          })
          .catch((err) => {
            debug(err.message);
          });

        return originalStart.apply(source, args3);
      };

      return source;
    };

    return context;
  };

  function generateAudioHash(source) {
    return new Promise((resolve, reject) => {
      if (source.buffer) {
        const buffer = source.buffer;
        const channelData = buffer.getChannelData(0);

        // Extract the first 1000 samples
        const numSamples = Math.min(1000, channelData.length);
        const samples = channelData.slice(0, numSamples);

        // Convert Float32Array to ArrayBuffer
        const bufferForHash = new ArrayBuffer(samples.length * 4);
        const view = new DataView(bufferForHash);

        for (let i = 0; i < samples.length; i++) {
          view.setFloat32(i * 4, samples[i], true); // Little endian
        }

        // Generate hash SHA-1
        crypto.subtle
          .digest("SHA-1", bufferForHash)
          .then((hashBuffer) => {
            const hashArray = Array.from(new Uint8Array(hashBuffer));

            const hashHex = hashArray
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");

            resolve(hashHex);
          })
          .catch(reject);
      } else {
        reject(new Error("Buffer not found in source."));
      }
    });
  }

  function uploadImage(blob) {
    // Extract game UUID from the URL
    const currentUrl = window.location.pathname;
    const match = currentUrl.match(/([0-9a-fA-F\-]{36})/);
    const uuid = match ? match[1] : null;

    const formData = new FormData();

    formData.append("image", blob, "canvas.png");
    formData.append("gameId", uuid);

    fetch(`http://localhost:${BACKEND_PORT}/moves`, {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((json) => {
        const response = json;

        debug("Response from backend:", response);
      })
      .catch((err) => {
        console.error("Error:", err);
      });
  }

  function processPlace() {
    const canvas = document.getElementById("main-canvas");

    if (!canvas) {
      console.error("Canvas não encontrado.");
      return;
    }

    // Simulates windows resize for canvas reset
    window.dispatchEvent(new Event("resize"));

    requestAnimationFrame(() => {
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error("Erro ao gerar blob do canvas.");
        } else {
          uploadImage(blob);
        }
      }, "image/png");
    });
  }

  function observeMainCanvas() {
    const targetId = "main-canvas";

    if (document.getElementById(targetId)) {
      debug("main-canvas detected at startup.");
      return;
    }

    const observer = new MutationObserver((mutationsList, observerInstance) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList") {
          const canvas = document.getElementById(targetId);

          if (canvas) {
            debug("main-canvas detected by observer.");

            observerInstance.disconnect();

            break;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  observeMainCanvas();
})();
