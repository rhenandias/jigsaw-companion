(function injectScript() {
  console.log("[Jigsaw Interceptor] Injection code");

  function injectWhenHeadReady() {
    const parent = document.head || document.documentElement;

    if (parent) {
      const script = document.createElement("script");

      script.src = chrome.runtime.getURL("main.js");

      script.type = "text/javascript";

      script.onload = function () {
        this.remove();
      };

      parent.appendChild(script);
    } else {
      setTimeout(injectWhenHeadReady, 10);
    }
  }

  injectWhenHeadReady();
})();
