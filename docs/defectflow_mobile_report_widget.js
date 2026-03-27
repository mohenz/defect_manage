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
      title: config.defaultTitle || '',
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
    button.innerHTML = '<span class="df-mobile-report-icon" aria-hidden="true">🐞</span>';

    const style = document.createElement('style');
    style.textContent = `
      #__defectflow-mobile-report-btn__ {
        position: fixed;
        right: 18px;
        bottom: calc(18px + env(safe-area-inset-bottom, 0px));
        z-index: 2147483646;
        width: 62px;
        height: 62px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: linear-gradient(135deg, #dc2626, #b91c1c);
        color: #ffffff;
        box-shadow: 0 18px 32px rgba(185, 28, 28, 0.32);
        font-family: "Segoe UI", Apple SD Gothic Neo, sans-serif;
        font-size: 28px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      #__defectflow-mobile-report-btn__:active {
        transform: scale(0.96);
      }
      #__defectflow-mobile-report-btn__:hover {
        box-shadow: 0 20px 36px rgba(185, 28, 28, 0.38);
      }
      #__defectflow-mobile-report-btn__ .df-mobile-report-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        line-height: 1;
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
