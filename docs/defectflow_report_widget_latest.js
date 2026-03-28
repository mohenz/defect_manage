(function () {
    const DEFECTFLOW_URL = "https://mohenz.github.io/defect_manage/";
    const HTML2CANVAS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    const SAME_ORIGIN_REWRITE_HOSTS = new Set([
        "cos.emarteveryday.co.kr",
        "cos-a.emarteveryday.co.kr"
    ]);

    function loadHtml2Canvas() {
        if (typeof window.html2canvas !== "undefined") {
            return Promise.resolve(window.html2canvas);
        }

        return new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-defectflow-html2canvas="true"]');
            if (existing) {
                existing.addEventListener("load", () => resolve(window.html2canvas), { once: true });
                existing.addEventListener("error", () => reject(new Error("html2canvas-load-failed")), { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = HTML2CANVAS_CDN;
            script.async = true;
            script.dataset.defectflowHtml2canvas = "true";
            script.onload = () => resolve(window.html2canvas);
            script.onerror = () => reject(new Error("html2canvas-load-failed"));
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

    function getCaptureScale(width, height) {
        const baseScale = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));
        const maxPixels = 16000000;
        const estimatedPixels = width * height;
        const safeScale = Math.sqrt(maxPixels / Math.max(estimatedPixels, 1));
        return Math.max(1, Math.min(baseScale, safeScale));
    }

    function rewriteAssetUrl(rawUrl) {
        if (!rawUrl || rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")) {
            return rawUrl;
        }

        try {
            const url = new URL(rawUrl, window.location.href);

            if (!/^https?:$/.test(url.protocol)) {
                return rawUrl;
            }

            if (url.origin === window.location.origin) {
                return url.href;
            }

            if (!SAME_ORIGIN_REWRITE_HOSTS.has(url.hostname)) {
                return rawUrl;
            }

            return `${window.location.origin}${url.pathname}${url.search}${url.hash}`;
        } catch (err) {
            return rawUrl;
        }
    }

    function rewriteSrcsetValue(srcsetValue) {
        if (!srcsetValue) {
            return srcsetValue;
        }

        return srcsetValue
            .split(",")
            .map((entry) => {
                const trimmed = entry.trim();
                if (!trimmed) {
                    return trimmed;
                }

                const parts = trimmed.split(/\s+/);
                const url = parts.shift();
                const rewrittenUrl = rewriteAssetUrl(url);
                return [rewrittenUrl, ...parts].join(" ").trim();
            })
            .join(", ");
    }

    function rewriteBackgroundImageValue(backgroundValue) {
        if (!backgroundValue || backgroundValue === "none") {
            return backgroundValue;
        }

        return backgroundValue.replace(/url\((['"]?)(.*?)\1\)/g, (match, quote, rawUrl) => {
            const rewrittenUrl = rewriteAssetUrl(rawUrl);
            if (!rewrittenUrl || rewrittenUrl === rawUrl) {
                return match;
            }
            return `url("${rewrittenUrl}")`;
        });
    }

    function setOrRemoveAttribute(element, name, value) {
        if (value === null || typeof value === "undefined") {
            element.removeAttribute(name);
            return;
        }

        element.setAttribute(name, value);
    }

    function sanitizeCaptureText(value) {
        return (value || "").replace(/\s+/g, " ").trim();
    }

    function drawRoundedRect(context, x, y, width, height, radius) {
        const safeRadius = Math.max(0, Math.min(radius || 0, width / 2, height / 2));
        context.beginPath();
        context.moveTo(x + safeRadius, y);
        context.lineTo(x + width - safeRadius, y);
        context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
        context.lineTo(x + width, y + height - safeRadius);
        context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
        context.lineTo(x + safeRadius, y + height);
        context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
        context.lineTo(x, y + safeRadius);
        context.quadraticCurveTo(x, y, x + safeRadius, y);
        context.closePath();
        context.fill();
    }

    function drawWrappedCanvasText(context, text, left, top, maxWidth, lineHeight) {
        const words = String(text || "").split(/\s+/).filter(Boolean);
        if (!words.length) {
            return;
        }

        let line = "";
        let currentTop = top;

        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (line && context.measureText(candidate).width > maxWidth) {
                context.fillText(line, left, currentTop);
                line = word;
                currentTop += lineHeight;
            } else {
                line = candidate;
            }
        }

        if (line) {
            context.fillText(line, left, currentTop);
        }
    }

    function createProductInfoCanvasOverlay(captureX, captureY, width, height) {
        const pixelRatio = 1;
        const overlay = document.createElement("canvas");
        const context = overlay.getContext("2d");
        const restorers = [];

        overlay.width = Math.max(1, Math.round(width * pixelRatio));
        overlay.height = Math.max(1, Math.round(height * pixelRatio));
        overlay.style.position = "absolute";
        overlay.style.left = `${captureX}px`;
        overlay.style.top = `${captureY}px`;
        overlay.style.width = `${width}px`;
        overlay.style.height = `${height}px`;
        overlay.style.pointerEvents = "none";
        overlay.style.zIndex = "2147483647";

        document.body.appendChild(overlay);
        restorers.push(() => overlay.remove());

        if (!context) {
            return () => {
                for (let index = restorers.length - 1; index >= 0; index -= 1) {
                    restorers[index]();
                }
            };
        }

        context.scale(pixelRatio, pixelRatio);
        context.textBaseline = "top";

        function hideOriginalNode(node) {
            if (!node) {
                return;
            }

            const originalOpacity = node.style.opacity;
            restorers.push(() => {
                node.style.opacity = originalOpacity;
            });
            node.style.opacity = "0";
        }

        function drawNodeText(node, text, options) {
            if (!node) {
                return;
            }

            const safeText = sanitizeCaptureText(text);
            if (!safeText) {
                return;
            }

            const rect = node.getBoundingClientRect();
            if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= window.innerHeight) {
                return;
            }

            const style = getComputedStyle(node);
            const fontSize = options.fontSize || style.fontSize || "16px";
            const fontWeight = options.fontWeight || style.fontWeight || "400";
            const lineHeight = parseFloat(options.lineHeight || style.lineHeight || fontSize) || 16;
            const paddingLeft = options.paddingLeft || 0;
            const paddingTop = options.paddingTop || 0;
            const drawLeft = rect.left + paddingLeft;
            const drawTop = rect.top + paddingTop;
            const drawWidth = Math.max(rect.width - (paddingLeft * 2), 1);

            if (options.background) {
                context.fillStyle = options.background;
                drawRoundedRect(context, rect.left, rect.top, rect.width, rect.height, options.radius || 4);
            }

            context.fillStyle = options.color || style.color || "#222222";
            context.font = `${fontWeight} ${fontSize} ${style.fontFamily || "sans-serif"}`;

            if (options.whiteSpace === "nowrap") {
                context.fillText(safeText, drawLeft, drawTop);
                return;
            }

            drawWrappedCanvasText(context, safeText, drawLeft, drawTop, drawWidth, lineHeight);
        }

        for (const info of Array.from(document.querySelectorAll(".product-item .prod-info"))) {
            const infoRect = info.getBoundingClientRect();
            if (!infoRect.width || !infoRect.height || infoRect.bottom <= 0 || infoRect.top >= window.innerHeight) {
                continue;
            }

            const badgeNode = info.querySelector(".prod-name .badge-type");
            const nameNode = info.querySelector(".prod-name .link-name");
            const unitNode = info.querySelector(".prod-price-info .unit-per-price");
            const priceNode = info.querySelector(".main-price .price");

            const badgeText = sanitizeCaptureText(badgeNode ? badgeNode.textContent : "");
            let nameText = sanitizeCaptureText(nameNode ? nameNode.textContent : "");
            const unitText = sanitizeCaptureText(unitNode ? unitNode.textContent : "");
            const priceText = sanitizeCaptureText(priceNode ? priceNode.textContent : "");

            if (badgeText && nameText.startsWith(badgeText)) {
                nameText = nameText.slice(badgeText.length).trim();
            }

            hideOriginalNode(badgeNode);
            hideOriginalNode(nameNode);
            hideOriginalNode(unitNode);
            hideOriginalNode(priceNode);

            drawNodeText(badgeNode, badgeText, {
                background: "#f3e1df",
                color: "#4d2424",
                fontSize: "13px",
                fontWeight: "700",
                lineHeight: "18",
                paddingLeft: 8,
                paddingTop: 2,
                radius: 4,
                whiteSpace: "nowrap"
            });
            drawNodeText(nameNode, nameText, {
                color: "#222222",
                fontSize: "18px",
                fontWeight: "600",
                lineHeight: "25"
            });
            drawNodeText(unitNode, unitText, {
                color: "#777777",
                fontSize: "13px",
                fontWeight: "400",
                lineHeight: "19",
                whiteSpace: "nowrap"
            });
            drawNodeText(priceNode, priceText, {
                color: "#111827",
                fontSize: "21px",
                fontWeight: "800",
                lineHeight: "25",
                whiteSpace: "nowrap"
            });
        }

        return () => {
            for (let index = restorers.length - 1; index >= 0; index -= 1) {
                restorers[index]();
            }
        };
    }

    function suppressOffscreenCaptureNoise() {
        const restorers = [];
        const noisySelectors = [
            ".category-tabs-wrap",
            ".section-title-box",
            ".pagination-controls",
            ".line-banner"
        ];

        for (const element of Array.from(document.querySelectorAll(noisySelectors.join(", ")))) {
            const rect = element.getBoundingClientRect();
            if (rect.bottom > 0 && rect.top < window.innerHeight) {
                continue;
            }

            const originalVisibility = element.style.visibility;
            restorers.push(() => {
                element.style.visibility = originalVisibility;
            });
            element.style.visibility = "hidden";
        }

        return () => {
            for (let index = restorers.length - 1; index >= 0; index -= 1) {
                restorers[index]();
            }
        };
    }

    async function prepareAssetsForCapture(captureX, captureY, width, height) {
        const restorers = [];
        const imageLoadPromises = [];

        for (const img of Array.from(document.images || [])) {
            const originalSrc = img.getAttribute("src");
            const originalSrcset = img.getAttribute("srcset");
            const originalCrossorigin = img.getAttribute("crossorigin");
            const rewrittenSrc = rewriteAssetUrl(originalSrc || img.currentSrc || img.src || "");
            const rewrittenSrcset = rewriteSrcsetValue(originalSrcset || "");
            const shouldRewriteSrc = Boolean(rewrittenSrc && rewrittenSrc !== (originalSrc || ""));
            const shouldRewriteSrcset = Boolean(originalSrcset && rewrittenSrcset !== originalSrcset);

            if (!shouldRewriteSrc && !shouldRewriteSrcset) {
                continue;
            }

            restorers.push(() => {
                setOrRemoveAttribute(img, "src", originalSrc);
                setOrRemoveAttribute(img, "srcset", originalSrcset);
                setOrRemoveAttribute(img, "crossorigin", originalCrossorigin);
            });

            if (shouldRewriteSrc) {
                img.src = rewrittenSrc;
            }

            if (shouldRewriteSrcset) {
                img.setAttribute("srcset", rewrittenSrcset);
            }

            img.removeAttribute("crossorigin");

            imageLoadPromises.push(new Promise((resolve) => {
                if (img.complete && img.naturalWidth > 0) {
                    resolve();
                    return;
                }

                const cleanup = () => {
                    img.removeEventListener("load", cleanup);
                    img.removeEventListener("error", cleanup);
                    resolve();
                };

                img.addEventListener("load", cleanup, { once: true });
                img.addEventListener("error", cleanup, { once: true });
            }));
        }

        for (const element of Array.from(document.querySelectorAll("*"))) {
            const computedBackgroundImage = getComputedStyle(element).backgroundImage;
            const rewrittenBackgroundImage = rewriteBackgroundImageValue(computedBackgroundImage);

            if (!rewrittenBackgroundImage || rewrittenBackgroundImage === computedBackgroundImage) {
                continue;
            }

            const originalInlineBackgroundImage = element.style.backgroundImage;
            restorers.push(() => {
                element.style.backgroundImage = originalInlineBackgroundImage;
            });
            element.style.backgroundImage = rewrittenBackgroundImage;
        }

        await Promise.race([
            Promise.all(imageLoadPromises),
            new Promise((resolve) => setTimeout(resolve, 2500))
        ]);

        restorers.push(suppressOffscreenCaptureNoise());
        restorers.push(createProductInfoCanvasOverlay(captureX, captureY, width, height));

        return () => {
            for (let index = restorers.length - 1; index >= 0; index -= 1) {
                restorers[index]();
            }
        };
    }

    async function captureCurrentScreen() {
        const html2canvas = await loadHtml2Canvas();
        await waitForCaptureAssets(1500);

        const captureX = Math.max(window.scrollX || window.pageXOffset || 0, 0);
        const captureY = Math.max(window.scrollY || window.pageYOffset || 0, 0);
        const width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
        const height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
        const scale = getCaptureScale(width, height);

        const restoreAssets = await prepareAssetsForCapture(captureX, captureY, width, height);

        try {
            await new Promise((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            });

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
        } finally {
            restoreAssets();
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

    function resolveCaptureErrorMessage() {
        return "화면 캡처 중 오류가 발생했습니다.";
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
