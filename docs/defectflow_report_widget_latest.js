(function () {
    const DEFECTFLOW_URL = "https://mohenz.github.io/defect_manage/";
    const HTML2CANVAS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";

    function loadHtml2Canvas() {
        if (typeof window.html2canvas !== "undefined") {
            return Promise.resolve(window.html2canvas);
        }

        return new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-defectflow-html2canvas="true"]');
            if (existing) {
                existing.addEventListener("load", () => resolve(window.html2canvas), { once: true });
                existing.addEventListener("error", () => reject(new Error("html2canvas load failed")), { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = HTML2CANVAS_CDN;
            script.async = true;
            script.dataset.defectflowHtml2canvas = "true";
            script.onload = () => resolve(window.html2canvas);
            script.onerror = () => reject(new Error("html2canvas load failed"));
            document.head.appendChild(script);
        });
    }

    async function waitForCaptureAssets(timeoutMs) {
        const fontReady = document.fonts && document.fonts.ready
            ? document.fonts.ready.catch(() => undefined)
            : Promise.resolve();

        const imagePromises = Array.from(document.images || [])
            .filter((img) => !img.complete)
            .map((img) => new Promise((resolve) => {
                const cleanup = () => {
                    img.removeEventListener("load", cleanup);
                    img.removeEventListener("error", cleanup);
                    resolve();
                };
                img.addEventListener("load", cleanup, { once: true });
                img.addEventListener("error", cleanup, { once: true });
            }));

        await Promise.race([
            Promise.all([fontReady, ...imagePromises]),
            new Promise((resolve) => setTimeout(resolve, timeoutMs || 1500))
        ]);
    }

    function getCaptureScale(width, height) {
        const baseScale = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));
        const maxPixels = 16000000;
        const estimatedPixels = width * height;
        const safeScale = Math.sqrt(maxPixels / Math.max(estimatedPixels, 1));
        return Math.max(1, Math.min(baseScale, safeScale));
    }

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

    async function captureCurrentScreen() {
        const html2canvas = await loadHtml2Canvas();
        await waitForCaptureAssets(1500);

        const captureX = Math.max(window.scrollX || window.pageXOffset || 0, 0);
        const captureY = Math.max(window.scrollY || window.pageYOffset || 0, 0);
        const width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
        const height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
        const scale = getCaptureScale(width, height);

        const canvas = await html2canvas(document.documentElement, {
            logging: false,
            useCORS: true,
            allowTaint: false,
            scale: scale,
            backgroundColor: "#ffffff",
            imageTimeout: 15000,
            width: width,
            height: height,
            x: captureX,
            y: captureY,
            scrollX: captureX,
            scrollY: captureY,
            windowWidth: width,
            windowHeight: height
        });

        return buildCaptureDataUrl(canvas);
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

            await new Promise((resolve) => setTimeout(resolve, 150));
            const screenshot = await captureCurrentScreen();
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
            console.error("[DefectFlow] Capture failed:", err);
            if (popup && !popup.closed) {
                popup.close();
            }
            alert("캡처 중 오류가 발생했습니다.");
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
