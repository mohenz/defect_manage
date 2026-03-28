(function () {
  'use strict';

  // ── 상태 관리 ──────────────────────────────────────────
  let mediaStream = null;      // 한 번 획득한 스트림 세션 동안 재사용
  let isCapturing = false;

  // ── 버그 리포팅 버튼 생성 ─────────────────────────────
  const btn = document.createElement('button');
  btn.id = '__bug-report-btn__';
  btn.textContent = '버그 리포팅';
  Object.assign(btn.style, {
    position:     'fixed',
    bottom:       '24px',
    right:        '24px',
    zIndex:       '2147483640',
    padding:      '10px 20px',
    background:   '#D85A30',
    color:        '#fff',
    border:       'none',
    borderRadius: '8px',
    fontSize:     '14px',
    fontWeight:   '500',
    cursor:       'pointer',
    transition:   'opacity 0.2s'
  });

  btn.addEventListener('click', async () => {
    if (isCapturing) return;
    isCapturing = true;
    btn.textContent = '캡처 중...';
    btn.style.opacity = '0.7';

    try {
      const screenshotDataUrl = await captureViewport();
      openDefectPopup({
        screenshot: screenshotDataUrl,
        url:        window.location.href,
        title:      document.title,
        timestamp:  new Date().toISOString()
      });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        alert('화면 공유 권한이 거부되었습니다.\n버그 리포팅을 사용하려면 화면 공유를 허용해주세요.');
      } else {
        alert('캡처 실패: ' + err.message);
      }
    } finally {
      btn.textContent = '버그 리포팅';
      btn.style.opacity = '1';
      isCapturing = false;
    }
  });

  document.body.appendChild(btn);

  // ── 뷰포트 캡처 (MediaDevices API) ────────────────────
  async function captureViewport() {

    // 스트림이 없거나 종료됐으면 새로 획득 (최초 or 재허용 시에만 권한 팝업 뜸)
    if (!mediaStream || !mediaStream.active) {
      mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',   // 현재 탭 우선 제안
          width:  { ideal: window.innerWidth },
          height: { ideal: window.innerHeight }
        },
        audio: false,
        preferCurrentTab: true         // Chrome 109+: 현재 탭 자동 선택
      });
    }

    const track  = mediaStream.getVideoTracks()[0];
    const settings = track.getSettings();

    // Video 엘리먼트로 스트림 프레임 수신
    const video = document.createElement('video');
    video.srcObject = mediaStream;
    video.muted = true;

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => video.play().then(resolve).catch(reject);
      video.onerror = reject;
    });

    // 첫 프레임이 완전히 렌더링될 때까지 잠시 대기
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // Canvas에 뷰포트 영역만 크롭하여 캡처
    const canvas  = document.createElement('canvas');
    const scaleX  = video.videoWidth  / settings.width;
    const scaleY  = video.videoHeight / settings.height;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      video,
      0, 0,                                             // 소스 시작점
      window.innerWidth  * scaleX,                      // 소스 폭 (뷰포트만)
      window.innerHeight * scaleY,                      // 소스 높이 (뷰포트만)
      0, 0,                                             // 대상 시작점
      window.innerWidth,                                // 출력 폭
      window.innerHeight                                // 출력 높이
    );

    video.srcObject = null;

    return canvas.toDataURL('image/png');
  }

  // ── 결함 신고 팝업 ────────────────────────────────────
  function openDefectPopup({ screenshot, url, title, timestamp }) {
    if (document.getElementById('__defect-overlay__')) return;

    // 팝업이 열리는 동안 버그 버튼 숨김 (스크린샷에 버튼 안 찍히도록)
    btn.style.display = 'none';

    const overlay = document.createElement('div');
    overlay.id = '__defect-overlay__';
    Object.assign(overlay.style, {
      position:       'fixed',
      inset:          '0',
      background:     'rgba(0,0,0,0.6)',
      zIndex:         '2147483641',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontFamily:     'system-ui, -apple-system, sans-serif'
    });

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:14px;width:760px;max-height:90vh;
        overflow-y:auto;padding:28px;display:flex;flex-direction:column;gap:16px;
        box-shadow:0 24px 64px rgba(0,0,0,0.35)">

        <!-- 헤더 -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:18px;font-weight:600;color:#111">결함 신고</div>
            <div style="font-size:12px;color:#999;margin-top:3px;word-break:break-all">${url}</div>
          </div>
          <button id="__defect-close__" style="background:none;border:none;
            font-size:22px;cursor:pointer;color:#aaa;line-height:1;padding:0 4px">✕</button>
        </div>

        <!-- 캡처 이미지 + 마킹 -->
        <div>
          <div style="font-size:12px;font-weight:500;color:#555;margin-bottom:6px">
            캡처 화면 (뷰포트) — 드래그로 오류 영역 표시 가능
          </div>
          <div style="position:relative;line-height:0">
            <img id="__defect-img__"
              src="${screenshot}"
              style="width:100%;border-radius:8px;border:1px solid #e0e0e0;display:block"/>
            <canvas id="__mark-canvas__"
              style="position:absolute;top:0;left:0;width:100%;height:100%;
                border-radius:8px;cursor:crosshair"></canvas>
          </div>
        </div>

        <!-- 기본 정보 -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          ${field('심각도', `
            <select id="__f-severity__" ${fieldStyle}>
              <option>Blocker</option>
              <option>Critical</option>
              <option selected>Major</option>
              <option>Minor</option>
              <option>Trivial</option>
            </select>`)}
          ${field('테스트 구분', `
            <select id="__f-testtype__" ${fieldStyle}>
              <option>통합 테스트</option>
              <option>시스템 테스트</option>
              <option>회귀 테스트</option>
              <option>인수 테스트</option>
            </select>`)}
          ${field('발생 시각', `
            <input type="text" value="${timestamp.replace('T',' ').slice(0,19)}"
              readonly ${fieldStyle} style="background:#f5f5f5;color:#999;
              border:1px solid #e8e8e8;border-radius:6px;padding:8px 10px;
              font-size:13px;width:100%;box-sizing:border-box"/>`)}
        </div>

        <!-- 결함 제목 -->
        ${field('결함 제목 *', `
          <input type="text" id="__f-title__"
            placeholder="예: 주문 완료 후 확인 페이지에서 500 오류 발생"
            ${fieldStyle} style="border:1px solid #d0d0d0;border-radius:6px;
            padding:9px 12px;font-size:13px;width:100%;box-sizing:border-box;outline:none"/>`)}

        <!-- 재현 절차 -->
        ${field('재현 절차', `
          <textarea id="__f-steps__" rows="4"
            placeholder="1. [메뉴명] 진입&#10;2. [입력값] 입력 후 저장 클릭&#10;3. 결과 확인&#10;→ 오류 발생"
            ${fieldStyle} style="border:1px solid #d0d0d0;border-radius:6px;
            padding:9px 12px;font-size:13px;width:100%;box-sizing:border-box;
            resize:vertical;outline:none;min-height:90px"></textarea>`)}

        <!-- 상세 설명 -->
        ${field('상세 설명', `
          <textarea id="__f-desc__" rows="2"
            placeholder="기대 동작 / 실제 동작 / 환경 등 추가 정보"
            ${fieldStyle} style="border:1px solid #d0d0d0;border-radius:6px;
            padding:9px 12px;font-size:13px;width:100%;box-sizing:border-box;
            resize:vertical;outline:none"></textarea>`)}

        <!-- 하단 버튼 -->
        <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px">
          <button id="__defect-cancel__" style="padding:10px 22px;border:1px solid #ddd;
            background:#fff;border-radius:7px;font-size:13px;cursor:pointer;color:#555">
            취소
          </button>
          <button id="__defect-submit__" style="padding:10px 28px;border:none;
            background:#D85A30;color:#fff;border-radius:7px;font-size:13px;
            font-weight:500;cursor:pointer">
            결함 등록
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    // ── 마킹 캔버스 초기화 ──────────────────────────────
    initMarkingCanvas();

    // ── 닫기 ────────────────────────────────────────────
    const close = () => {
      overlay.remove();
      btn.style.display = '';
    };
    document.getElementById('__defect-close__').addEventListener('click', close);
    document.getElementById('__defect-cancel__').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // ── 결함 등록 제출 ──────────────────────────────────
    document.getElementById('__defect-submit__').addEventListener('click', async () => {
      const titleVal = document.getElementById('__f-title__').value.trim();
      if (!titleVal) {
        document.getElementById('__f-title__').style.borderColor = '#D85A30';
        document.getElementById('__f-title__').focus();
        return;
      }

      const submitBtn = document.getElementById('__defect-submit__');
      submitBtn.textContent = '등록 중...';
      submitBtn.disabled = true;

      // 마킹 합성된 최종 이미지 생성
      const finalImage = await mergeMarking(screenshot);

      // 결함 데이터 패키지
      const defectData = {
        title:       titleVal,
        severity:    document.getElementById('__f-severity__').value,
        testType:    document.getElementById('__f-testtype__').value,
        steps:       document.getElementById('__f-steps__').value,
        description: document.getElementById('__f-desc__').value,
        screenshot:  finalImage,
        url,
        pageTitle:   title,
        timestamp,
        userAgent:   navigator.userAgent,
        viewport:    `${window.innerWidth}x${window.innerHeight}`
      };

      // ▼ 여기를 결함 관리 시스템 연동으로 교체
      await submitToDefectSystem(defectData);

      close();
      showToast('결함이 등록되었습니다.');
    });
  }

  // ── 마킹 캔버스 드래그 ────────────────────────────────
  function initMarkingCanvas() {
    const img    = document.getElementById('__defect-img__');
    const canvas = document.getElementById('__mark-canvas__');
    let sx, sy, drawing = false;

    canvas.addEventListener('mousedown', e => {
      const r = canvas.getBoundingClientRect();
      sx = e.clientX - r.left;
      sy = e.clientY - r.top;
      canvas.width  = r.width;
      canvas.height = r.height;
      drawing = true;
    });

    canvas.addEventListener('mousemove', e => {
      if (!drawing) return;
      const r   = canvas.getBoundingClientRect();
      const ex  = e.clientX - r.left;
      const ey  = e.clientY - r.top;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#D85A30';
      ctx.lineWidth   = 2.5;
      ctx.fillStyle   = 'rgba(216,90,48,0.10)';
      ctx.strokeRect(sx, sy, ex - sx, ey - sy);
      ctx.fillRect(sx, sy, ex - sx, ey - sy);
    });

    document.addEventListener('mouseup', () => { drawing = false; }, { once: false });
  }

  // ── 마킹 합성 ─────────────────────────────────────────
  async function mergeMarking(baseDataUrl) {
    return new Promise(resolve => {
      const canvas  = document.getElementById('__mark-canvas__');
      const imgEl   = document.getElementById('__defect-img__');
      const base    = new Image();
      base.onload = () => {
        const c   = document.createElement('canvas');
        c.width   = base.naturalWidth;
        c.height  = base.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(base, 0, 0);

        // 마킹 비율 보정 후 합성
        const scaleX = base.naturalWidth  / imgEl.clientWidth;
        const scaleY = base.naturalHeight / imgEl.clientHeight;
        ctx.scale(scaleX, scaleY);
        ctx.drawImage(canvas, 0, 0);
        resolve(c.toDataURL('image/png'));
      };
      base.src = baseDataUrl;
    });
  }

  // ── 결함 시스템 연동 (교체 포인트) ───────────────────
  async function submitToDefectSystem(data) {
    // 예시 A: 자체 결함 관리 API 호출 (동일 도메인이면 CORS 없음)
    // await fetch('/defect-api/issues', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(data)
    // });

    // 예시 B: 다운로드 방식 (서버 없이도 동작 — JSON + PNG 파일로 저장)
    const json = JSON.stringify({
      title:       data.title,
      severity:    data.severity,
      testType:    data.testType,
      url:         data.url,
      timestamp:   data.timestamp,
      steps:       data.steps,
      description: data.description,
      userAgent:   data.userAgent,
      viewport:    data.viewport
    }, null, 2);

    // JSON 다운로드
    downloadFile(
      new Blob([json], { type: 'application/json' }),
      `defect_${Date.now()}.json`
    );

    // 스크린샷 PNG 다운로드
    const pngBlob = dataUrlToBlob(data.screenshot);
    downloadFile(pngBlob, `defect_${Date.now()}.png`);
  }

  // ── 유틸 ──────────────────────────────────────────────
  function downloadFile(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function dataUrlToBlob(dataUrl) {
    const [header, base64] = dataUrl.split(',');
    const mime   = header.match(/:(.*?);/)[1];
    const binary = atob(base64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
    return new Blob([buffer], { type: mime });
  }

  function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position:     'fixed',
      bottom:       '76px',
      right:        '24px',
      background:   '#111',
      color:        '#fff',
      padding:      '12px 20px',
      borderRadius: '8px',
      fontSize:     '14px',
      zIndex:       '2147483645',
      transition:   'opacity 0.5s'
    });
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; }, 2500);
    setTimeout(() => t.remove(), 3100);
  }

  const fieldStyle = '';
  function field(label, input) {
    const required = label.includes('*');
    return `
      <div>
        <label style="font-size:12px;font-weight:500;color:#555;
          display:block;margin-bottom:4px">
          ${label}
        </label>
        ${input}
      </div>`;
  }

})();