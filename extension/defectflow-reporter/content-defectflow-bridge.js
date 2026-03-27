(function () {
  'use strict';

  if (window.top !== window) {
    return;
  }

  const OVERLAY_ID = '__defectflow-extension-overlay__';
  const POST_RETRY_DELAYS = [150, 450, 900, 1600, 2600];
  let pendingPayload = null;
  let currentIframe = null;
  let currentOverlayHost = null;

  function postPayloadToFrame(payload) {
    if (!currentIframe?.contentWindow || !payload) {
      return;
    }

    currentIframe.contentWindow.postMessage({
      type: 'DEFECTFLOW_DATA',
      data: payload
    }, 'https://mohenz.github.io');
  }

  function schedulePayloadDelivery(payload) {
    POST_RETRY_DELAYS.forEach((delay) => {
      window.setTimeout(() => postPayloadToFrame(payload), delay);
    });
  }

  function closeOverlay() {
    if (!currentOverlayHost) {
      return;
    }

    currentOverlayHost.remove();
    currentOverlayHost = null;
    currentIframe = null;
    pendingPayload = null;
    document.documentElement.style.overflow = '';
  }

  function ensureOverlay(url) {
    if (currentOverlayHost) {
      return;
    }

    const host = document.createElement('div');
    host.id = OVERLAY_ID;
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = '2147483647';

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
        }
        .backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          box-sizing: border-box;
        }
        .panel {
          width: min(1400px, calc(100vw - 40px));
          height: min(920px, calc(100vh - 40px));
          background: #ffffff;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
          display: flex;
          flex-direction: column;
        }
        .header {
          height: 56px;
          padding: 0 16px 0 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #e5e7eb;
          font-family: "Segoe UI", Arial, sans-serif;
          background: #f8fafc;
        }
        .title {
          font-size: 15px;
          font-weight: 600;
          color: #111827;
        }
        .close {
          border: none;
          background: transparent;
          font-size: 24px;
          line-height: 1;
          color: #6b7280;
          cursor: pointer;
          padding: 4px 8px;
        }
        .frame {
          flex: 1;
          width: 100%;
          border: 0;
          background: #ffffff;
        }
      </style>
      <div class="backdrop">
        <div class="panel" role="dialog" aria-modal="true" aria-label="DefectFlow 결함 등록">
          <div class="header">
            <div class="title">DefectFlow 결함 등록</div>
            <button class="close" type="button" aria-label="닫기">×</button>
          </div>
          <iframe class="frame" allow="clipboard-read; clipboard-write" src="${url}"></iframe>
        </div>
      </div>
    `;

    const closeButton = shadow.querySelector('.close');
    const backdrop = shadow.querySelector('.backdrop');
    const panel = shadow.querySelector('.panel');
    const iframe = shadow.querySelector('.frame');

    closeButton.addEventListener('click', closeOverlay);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        closeOverlay();
      }
    });
    panel.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    iframe.addEventListener('load', () => {
      if (pendingPayload) {
        schedulePayloadDelivery(pendingPayload);
      }
    });

    document.documentElement.appendChild(host);
    document.documentElement.style.overflow = 'hidden';

    currentOverlayHost = host;
    currentIframe = iframe;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'DEFECTFLOW_OPEN_OVERLAY') {
      return false;
    }

    pendingPayload = message.payload || null;
    ensureOverlay(message.url);
    schedulePayloadDelivery(pendingPayload);
    sendResponse({ ok: true });
    return true;
  });

  window.addEventListener('message', (event) => {
    if (event.origin !== 'https://mohenz.github.io' || !event.data?.type) {
      return;
    }

    if (event.data.type === 'DEFECTFLOW_READY' && pendingPayload) {
      schedulePayloadDelivery(pendingPayload);
      return;
    }

    if (event.data.type === 'DEFECTFLOW_CLOSE') {
      closeOverlay();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && currentOverlayHost) {
      closeOverlay();
    }
  });
})();
