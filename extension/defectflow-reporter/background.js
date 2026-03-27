const DEFECTFLOW_REGISTER_URL = 'https://mohenz.github.io/defect_manage/?mode=standalone#register';

async function buildPendingPayload(tab) {
  const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: 'png'
  });

  return {
    title: '',
    screenshot,
    menu_name: '',
    screen_name: '',
    screen_url: tab.url || '',
    env_info: '',
    test_type: '',
    timestamp: new Date().toISOString(),
    source: 'chrome-extension',
    page_title: tab.title || ''
  };
}

async function openOverlayWithCapture(tab) {
  if (!tab || !tab.windowId) {
    throw new Error('활성 탭 정보를 찾을 수 없습니다.');
  }

  if (!tab.url || !/^https?:/i.test(tab.url)) {
    throw new Error('HTTP 또는 HTTPS 페이지에서만 캡처할 수 있습니다.');
  }

  const payload = await buildPendingPayload(tab);
  await chrome.tabs.sendMessage(tab.id, {
    type: 'DEFECTFLOW_OPEN_OVERLAY',
    url: DEFECTFLOW_REGISTER_URL,
    payload
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await openOverlayWithCapture(tab);
  } catch (error) {
    console.error('[DefectFlow Extension] capture failed:', error);
  }
});
