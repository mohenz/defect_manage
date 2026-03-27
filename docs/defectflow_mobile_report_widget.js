(function () {
  'use strict';

  if (window.__DEFECTFLOW_MOBILE_WIDGET_INITIALIZED__) {
    return;
  }

  window.__DEFECTFLOW_MOBILE_WIDGET_INITIALIZED__ = true;

  const DEFAULT_REGISTER_URL = 'https://mohenz.github.io/defect_manage/?mode=mobile#register';
  const DEFAULTS = {
    buttonLabel: '신고하기',
    registerUrl: DEFAULT_REGISTER_URL,
    defaultTestType: '통합테스트',
    defaultSeverity: 'Minor',
    defaultPriority: 'Medium',
    defaultScreenPath: '',
    defaultTitle: '',
    creator: '',
    openInNewTab: true,
    envTag: 'Mobile Report Widget'
  };

  function getMetaContent(name) {
    return document.querySelector(`meta[name="${name}"]`)?.content?.trim() || '';
  }

  function getConfig() {
    const runtimeConfig = window.DEFECTFLOW_MOBILE_REPORTER_CONFIG || {};
    return {
      ...DEFAULTS,
      defaultScreenPath: runtimeConfig.defaultScreenPath || getMetaContent('defectflow:screen-path') || DEFAULTS.defaultScreenPath,
      defaultTestType: runtimeConfig.defaultTestType || getMetaContent('defectflow:test-type') || DEFAULTS.defaultTestType,
      defaultSeverity: runtimeConfig.defaultSeverity || getMetaContent('defectflow:severity') || DEFAULTS.defaultSeverity,
      defaultPriority: runtimeConfig.defaultPriority || getMetaContent('defectflow:priority') || DEFAULTS.defaultPriority,
      defaultTitle: runtimeConfig.defaultTitle || getMetaContent('defectflow:title') || DEFAULTS.defaultTitle,
      creator: runtimeConfig.creator || getMetaContent('defectflow:creator') || DEFAULTS.creator,
      buttonLabel: runtimeConfig.buttonLabel || DEFAULTS.buttonLabel,
      registerUrl: runtimeConfig.registerUrl || DEFAULTS.registerUrl,
      openInNewTab: typeof runtimeConfig.openInNewTab === 'boolean' ? runtimeConfig.openInNewTab : DEFAULTS.openInNewTab,
      envTag: runtimeConfig.envTag || DEFAULTS.envTag
    };
  }

  function normalizeScreenPath(screenPath) {
    return String(screenPath || '')
      .split('>')
      .map((part) => part.replace(/\u3000/g, ' ').trim())
      .filter(Boolean)
      .join(' > ');
  }

  function parseScreenPath(screenPath) {
    const parts = normalizeScreenPath(screenPath).split(' > ').filter(Boolean);
    const screenName = parts.pop() || '';
    return {
      menu_name: parts.join(' > '),
      screen_name: screenName
    };
  }

  function buildDefectSeed(config) {
    const parsed = parseScreenPath(config.defaultScreenPath);
    return {
      title: config.defaultTitle || `[모바일] ${document.title || '결함 등록'}`,
      steps_to_repro: '',
      menu_name: parsed.menu_name,
      screen_name: parsed.screen_name,
      screen_url: window.location.href,
      screenshot: '',
      env_info: `${config.envTag} | UA: ${navigator.userAgent}`,
      test_type: config.defaultTestType,
      severity: config.defaultSeverity,
      priority: config.defaultPriority,
      creator: config.creator || ''
    };
  }

  function persistPendingDefectData(defectData) {
    try {
      localStorage.setItem('pending_defect', JSON.stringify(defectData));
      return true;
    } catch (error) {
      console.warn('[DefectFlow Mobile Widget] pending_defect save skipped:', error);
      return false;
    }
  }

  function openRegister(config) {
    const defectData = buildDefectSeed(config);
    persistPendingDefectData(defectData);

    if (config.openInNewTab) {
      window.open(config.registerUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    window.location.href = config.registerUrl;
  }

  function ensureButton(config) {
    if (document.getElementById('__defectflow-mobile-report-btn__')) {
      return;
    }

    const button = document.createElement('button');
    button.id = '__defectflow-mobile-report-btn__';
    button.type = 'button';
    button.setAttribute('aria-label', config.buttonLabel);
    button.innerHTML = '<span class="df-mobile-report-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M9 3.75a3 3 0 0 1 6 0v1.22a5.24 5.24 0 0 1 2.68 2.08l1.98-1.14a.75.75 0 1 1 .75 1.3L18.4 8.35c.22.58.35 1.21.35 1.88v.77h1.5a.75.75 0 0 1 0 1.5h-1.5v.77c0 .67-.13 1.3-.35 1.88l2.01 1.14a.75.75 0 1 1-.75 1.3l-1.98-1.14A5.25 5.25 0 0 1 14.25 19h-4.5a5.25 5.25 0 0 1-3.43-1.31L4.34 18.8a.75.75 0 0 1-.75-1.3l2.01-1.14a5.14 5.14 0 0 1-.35-1.88v-.77h-1.5a.75.75 0 0 1 0-1.5h1.5v-.77c0-.67.13-1.3.35-1.88L3.6 7.21a.75.75 0 0 1 .75-1.3l1.98 1.14A5.24 5.24 0 0 1 9 4.97V3.75Zm1.5.03v1.19h3V3.78a1.5 1.5 0 0 0-3 0Zm-1.5 2.69A3.75 3.75 0 0 0 5.25 10.22v3.56A3.75 3.75 0 0 0 9 17.53h6a3.75 3.75 0 0 0 3.75-3.75v-3.56A3.75 3.75 0 0 0 15 6.47H9Zm1.13 3.03a1.13 1.13 0 1 1 0 2.25 1.13 1.13 0 0 1 0-2.25Zm3.75 0a1.13 1.13 0 1 1 0 2.25 1.13 1.13 0 0 1 0-2.25Z" fill="currentColor"/></svg></span><span class="df-mobile-report-label"></span>';

    const style = document.createElement('style');
    style.textContent = `
      #__defectflow-mobile-report-btn__ {
        position: fixed;
        right: 18px;
        bottom: calc(18px + env(safe-area-inset-bottom, 0px));
        z-index: 2147483646;
        min-width: 112px;
        height: 52px;
        padding: 0 18px;
        border: none;
        border-radius: 999px;
        background: linear-gradient(135deg, #dc2626, #b91c1c);
        color: #ffffff;
        box-shadow: 0 18px 32px rgba(185, 28, 28, 0.32);
        font-family: "Segoe UI", Apple SD Gothic Neo, sans-serif;
        font-size: 15px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
      }
      #__defectflow-mobile-report-btn__ .df-mobile-report-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
      }
      #__defectflow-mobile-report-btn__ .df-mobile-report-icon svg {
        width: 20px;
        height: 20px;
        display: block;
      }
      #__defectflow-mobile-report-btn__ .df-mobile-report-label::after {
        content: "${config.buttonLabel.replace(/"/g, '\\"')}";
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(button);
    button.addEventListener('click', () => openRegister(config));
  }

  function init() {
    const config = getConfig();
    if (!document.body) {
      return;
    }
    ensureButton(config);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
