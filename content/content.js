(() => {
  const TEMPY_ATTR = "data-tempy-attached";
  const ICON_SIZE = 20;

  // SVG icon (tempy.email brand - orange envelope)
  const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${ICON_SIZE}" height="${ICON_SIZE}" fill="none" stroke="#ff6b35" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4L12 13L2 4"/></svg>`;

  let settingsCache = { autoDetectInputs: true };

  // Load settings
  chrome.runtime.sendMessage({ action: "getSettings" }, (settings) => {
    if (settings) settingsCache = settings;
    if (settingsCache.autoDetectInputs !== false) {
      scanAndAttach();
      observeDom();
    }
  });

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      settingsCache = changes.settings.newValue || settingsCache;
      if (settingsCache.autoDetectInputs === false) {
        removeAllOverlays();
      } else {
        scanAndAttach();
      }
    }
  });

  function isEmailInput(input) {
    if (input.type === "email") return true;
    if (input.type !== "text" && input.type !== "") return false;
    const name = (input.name || "").toLowerCase();
    const id = (input.id || "").toLowerCase();
    const placeholder = (input.placeholder || "").toLowerCase();
    const autocomplete = (input.autocomplete || "").toLowerCase();
    return (
      name.includes("email") ||
      id.includes("email") ||
      placeholder.includes("email") ||
      autocomplete === "email"
    );
  }

  function findEmailInputs() {
    return [...document.querySelectorAll("input")].filter(
      (input) => isEmailInput(input) && !input.hasAttribute(TEMPY_ATTR) && isVisible(input)
    );
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function scanAndAttach() {
    if (settingsCache.autoDetectInputs === false) return;
    for (const input of findEmailInputs()) {
      attachOverlay(input);
    }
  }

  function attachOverlay(input) {
    input.setAttribute(TEMPY_ATTR, "true");

    // Create shadow host
    const host = document.createElement("div");
    host.className = "tempy-overlay-host";
    host.style.cssText = "position:absolute;z-index:2147483647;pointer-events:none;";

    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        :host { position: absolute; z-index: 2147483647; }
        .tempy-btn {
          all: initial;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          cursor: pointer;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid #e0e0e0;
          pointer-events: auto;
          transition: all 0.15s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .tempy-btn:hover {
          border-color: #ff6b35;
          background: #fff5f0;
          box-shadow: 0 1px 4px rgba(255,107,53,0.2);
        }
        .tempy-btn:active {
          transform: scale(0.95);
        }
        .tempy-btn.loading {
          opacity: 0.5;
          pointer-events: none;
        }
        .tempy-btn.success svg {
          stroke: #27ae60;
        }
      </style>
      <button class="tempy-btn" title="Generate Tempy Email">${ICON_SVG}</button>
    `;

    const btn = shadow.querySelector(".tempy-btn");

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      btn.classList.add("loading");

      try {
        const resp = await chrome.runtime.sendMessage({ action: "generateEmail" });
        if (resp.ok) {
          fillInput(input, resp.data.email);
          btn.classList.remove("loading");
          btn.classList.add("success");
          setTimeout(() => btn.classList.remove("success"), 2000);
        } else {
          btn.classList.remove("loading");
          console.error("[tempy]", resp.error);
        }
      } catch (err) {
        btn.classList.remove("loading");
        console.error("[tempy]", err);
      }
    });

    document.body.appendChild(host);
    positionOverlay(host, input);

    // Reposition on scroll/resize
    const reposition = () => positionOverlay(host, input);
    const observer = new IntersectionObserver((entries) => {
      host.style.display = entries[0].isIntersecting ? "" : "none";
    });
    observer.observe(input);

    window.addEventListener("scroll", reposition, { passive: true });
    window.addEventListener("resize", reposition, { passive: true });

    // Clean up if input is removed
    const mutObs = new MutationObserver(() => {
      if (!document.contains(input)) {
        host.remove();
        mutObs.disconnect();
        observer.disconnect();
        window.removeEventListener("scroll", reposition);
        window.removeEventListener("resize", reposition);
      }
    });
    mutObs.observe(document.body, { childList: true, subtree: true });
  }

  function positionOverlay(host, input) {
    const rect = input.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    host.style.top = `${rect.top + scrollY + (rect.height - 28) / 2}px`;
    host.style.left = `${rect.right + scrollX - 34}px`;
  }

  function fillInput(input, email) {
    const setter =
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

    if (setter) {
      setter.call(input, email);
    } else {
      input.value = email;
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.focus();
  }

  function removeAllOverlays() {
    document.querySelectorAll(".tempy-overlay-host").forEach((el) => el.remove());
    document.querySelectorAll(`[${TEMPY_ATTR}]`).forEach((el) => {
      el.removeAttribute(TEMPY_ATTR);
    });
  }

  function observeDom() {
    const observer = new MutationObserver((mutations) => {
      let hasNewNodes = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          hasNewNodes = true;
          break;
        }
      }
      if (hasNewNodes) {
        // Debounce: wait for DOM to settle
        clearTimeout(observeDom._timeout);
        observeDom._timeout = setTimeout(scanAndAttach, 300);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
