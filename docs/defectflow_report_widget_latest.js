(function () {
    const DEFECTFLOW_URL = "https://mohenz.github.io/defect_manage/";

    function resizeCanvas(sourceCanvas, ratio) {
        const nextCanvas = document.createElement("canvas");
        const width = Math.max(1, Math.round(sourceCanvas.width * ratio));
        const height = Math.max(1, Math.round(sourceCanvas.height * ratio));
        const context = nextCanvas.getContext("2d");

        nextCanvas.width = width;
        nextCanvas.height = height;

        if (!context) {
            return sourceCanvas;
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(sourceCanvas, 0, 0, width, height);
        return nextCanvas;
    }

    function buildCaptureDataUrl(canvas) {
        const preferredFormats = [
            { mime: "image/webp", qualities: [0.95, 0.88, 0.8, 0.72] },
            { mime: "image/jpeg", qualities: [0.92, 0.86, 0.8, 0.72] }
        ];
        const maxLength = 1800000;

        let workingCanvas = canvas;
        let smallestDataUrl = "";

        for (let attempt = 0; attempt < 5; attempt += 1) {
            for (const format of preferredFormats) {
                for (const quality of format.qualities) {
                    const dataUrl = workingCanvas.toDataURL(format.mime, quality);
                    if (!dataUrl || dataUrl === "data:,") {
                        continue;
                    }

                    if (!smallestDataUrl || dataUrl.length < smallestDataUrl.length) {
                        smallestDataUrl = dataUrl;
                    }

                    if (dataUrl.length <= maxLength) {
                        return dataUrl;
                    }
                }
            }

            if (Math.max(workingCanvas.width, workingCanvas.height) <= 800) {
                break;
            }

            workingCanvas = resizeCanvas(workingCanvas, 0.82);
        }

        return smallestDataUrl;
    }

    function persistPendingDefectData(defectData) {
        try {
            localStorage.setItem("pending_defect", JSON.stringify(defectData));
            return true;
        } catch (err) {
            console.warn("[DefectFlow] pending_defect localStorage save skipped:", err);
            return false;
        }
    }

    async function captureCurrentTab() {
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== "function") {
            throw new Error("tab-capture-not-supported");
        }

        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const idealWidth = Math.max(1280, Math.round((window.innerWidth || 1280) * dpr));
        const idealHeight = Math.max(720, Math.round((window.innerHeight || 720) * dpr));
        let stream = null;

        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: "browser",
                    preferCurrentTab: true,
                    selfBrowserSurface: "include",
                    surfaceSwitching: "exclude",
                    width: { ideal: idealWidth },
                    height: { ideal: idealHeight },
                    frameRate: { ideal: 2, max: 5 }
                },
                audio: false
            });

            const track = stream.getVideoTracks()[0];
            if (!track) {
                throw new Error("tab-capture-no-track");
            }

            const settings = typeof track.getSettings === "function" ? track.getSettings() : {};
            if (settings.displaySurface && settings.displaySurface !== "browser") {
                throw new Error("tab-capture-not-browser-surface");
            }

            const video = document.createElement("video");
            video.muted = true;
            video.playsInline = true;
            video.srcObject = stream;

            await new Promise((resolve, reject) => {
                video.onloadedmetadata = () => resolve();
                video.onerror = () => reject(new Error("tab-capture-video-error"));
            });

            const playPromise = video.play();
            if (playPromise && typeof playPromise.then === "function") {
                await playPromise.catch(() => undefined);
            }

            await new Promise((resolve) => setTimeout(resolve, 250));

            if (typeof video.requestVideoFrameCallback === "function") {
                await new Promise((resolve) => {
                    video.requestVideoFrameCallback(() => resolve());
                });
            }

            const width = Math.max(video.videoWidth || 0, settings.width || 0, window.innerWidth || 1280);
            const height = Math.max(video.videoHeight || 0, settings.height || 0, window.innerHeight || 720);
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            canvas.width = width;
            canvas.height = height;

            if (!context) {
                throw new Error("tab-capture-no-context");
            }

            context.drawImage(video, 0, 0, width, height);

            const dataUrl = buildCaptureDataUrl(canvas);
            if (!dataUrl) {
                throw new Error("tab-capture-empty");
            }

            return dataUrl;
        } finally {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
        }
    }

    function ensureFontAwesome() {
        if (document.querySelector('link[href*="font-awesome"]')) {
            return;
        }

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
        document.head.appendChild(link);
    }

    function ensureWidgetStyle() {
        if (document.getElementById("defectflow-widget-style")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "defectflow-widget-style";
        style.innerHTML = `
            #defectflow-report-btn {
                position: fixed;
                bottom: 30px;
                right: 30px;
                z-index: 99999;
                width: 65px;
                height: 65px;
                border-radius: 50%;
                background: linear-gradient(135deg, #ef4444, #b91c1c);
                color: white;
                border: none;
                cursor: pointer;
                box-shadow: 0 10px 25px rgba(239, 68, 68, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 26px;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            #defectflow-report-btn:hover {
                transform: scale(1.1) rotate(10deg);
            }
            #defectflow-report-btn .tooltip {
                position: absolute;
                right: 80px;
                background: #1e293b;
                color: white;
                padding: 8px 15px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                white-space: nowrap;
                visibility: hidden;
                opacity: 0;
                transition: 0.3s;
            }
            #defectflow-report-btn:hover .tooltip {
                visibility: visible;
                opacity: 1;
                right: 85px;
            }
        `;
        document.head.appendChild(style);
    }

    function deriveMenuName() {
        const candidates = [
            document.querySelector(".store-name"),
            document.querySelector("header h1"),
            document.querySelector("header .logo"),
            document.querySelector(".logo"),
            document.querySelector(".site-title")
        ];

        for (const node of candidates) {
            const value = node && node.textContent ? node.textContent.trim() : "";
            if (value) {
                return value;
            }
        }

        return "운영/테스트 사이트";
    }

    function deriveScreenName() {
        const candidates = [
            document.querySelector("h1"),
            document.querySelector("main h2"),
            document.querySelector(".page-title"),
            document.querySelector(".contents-title")
        ];

        for (const node of candidates) {
            const value = node && node.textContent ? node.textContent.trim() : "";
            if (value) {
                return value;
            }
        }

        return document.title || "화면명 미확인";
    }

    function buildDefectData(screenshot) {
        const screenName = deriveScreenName();

        return {
            title: `[${screenName}] 결함 보고`,
            menu_name: deriveMenuName(),
            screen_name: screenName,
            screen_url: window.location.href,
            screenshot: screenshot || "",
            env_info: `Browser: ${navigator.userAgent}`,
            test_type: "사용자 테스트"
        };
    }

    function resolveCaptureErrorMessage(err) {
        if (!err || !err.message) {
            return "탭 캡처 중 오류가 발생했습니다.";
        }

        if (err.message === "tab-capture-not-supported") {
            return "이 브라우저는 탭 캡처를 지원하지 않습니다. Chrome 또는 Edge에서 다시 시도해 주세요.";
        }

        if (err.message === "tab-capture-not-browser-surface") {
            return "공유 화면 선택 창에서 현재 탭을 선택해 주세요.";
        }

        if (err.name === "NotAllowedError" || err.name === "AbortError") {
            return "탭 캡처가 취소되었습니다.";
        }

        return "탭 캡처 중 오류가 발생했습니다.";
    }

    async function handleReportClick(btn) {
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;

        let popup = null;

        try {
            const width = 1100;
            const height = 900;
            const left = (window.screen.width / 2) - (width / 2);
            const top = (window.screen.height / 2) - (height / 2);

            popup = window.open(
                "about:blank",
                "DefectFlowRegister",
                `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
            );

            if (!popup) {
                alert("팝업 차단을 해제해 주세요.");
                return;
            }

            const screenshot = await captureCurrentTab();
            const defectData = buildDefectData(screenshot);

            if (!defectData.screenshot) {
                defectData.env_info += " | Screenshot omitted or unavailable";
            }

            persistPendingDefectData(defectData);

            const messageHandler = function (event) {
                if (event.data && event.data.type === "DEFECTFLOW_READY") {
                    popup.postMessage({
                        type: "DEFECTFLOW_DATA",
                        data: defectData
                    }, "*");
                    window.removeEventListener("message", messageHandler);
                }
            };

            window.addEventListener("message", messageHandler);
            popup.location.href = `${DEFECTFLOW_URL}?mode=standalone#register`;
        } catch (err) {
            console.error("[DefectFlow] Tab capture failed:", err);
            if (popup && !popup.closed) {
                popup.close();
            }
            alert(resolveCaptureErrorMessage(err));
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }

    function mountWidget() {
        if (document.getElementById("defectflow-report-btn")) {
            return;
        }

        ensureFontAwesome();
        ensureWidgetStyle();

        const host = document.getElementById("defectflow-widget-container") || document.body;
        const btn = document.createElement("button");
        btn.id = "defectflow-report-btn";
        btn.type = "button";
        btn.innerHTML = '<i class="fas fa-bug"></i><span class="tooltip">결함 발견! 리포트 하기</span>';
        btn.addEventListener("click", () => {
            handleReportClick(btn);
        });

        host.appendChild(btn);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mountWidget, { once: true });
    } else {
        mountWidget();
    }
}());
