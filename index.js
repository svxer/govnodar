(() => {
    // local storage keys for ui state that should survive reloads.
    const STORAGE_KEYS = {
        clicks: "slimeClicks",
        followCursor: "followCursor",
        layoutControlMode: "layoutControlMode",
        layoutMode: "layoutMode",
        menuLayoutMode: "menuLayoutMode",
        hueOff: "hueOff",
        bgOff: "bgOff",
        lastNotifyAt: "slimeLastNotifyAt",
    };

    const AUDIO_SOURCES = {
        reset: "./index_files/explode.wav",
        chime: "./index_files/clock_chime.mp3",
        uiIn: "./index_files/ui-in.ogg",
        uiOut: "./index_files/ui-out.ogg",
        bonk: "./index_files/bonk.mp3",
    };

    const NOTIFY_CONFIG = {
        endpoint: "/slime-click",
        cooldownMs: 60 * 60 * 1000,
    };

    // keep all dom lookups in one place so the feature modules stay focused.
    const refs = getRefs();
    const state = createState();
    const audio = createAudioLibrary(AUDIO_SOURCES);
    const rollingText = createRollingTextRenderer();
    const background = createBackgroundAnimator(refs.bgCanvas, state);
    const layout = createLayoutManager(refs, state);
    const counter = createCounterController(refs, state, rollingText, audio);
    const notifier = createSlimeNotifier(NOTIFY_CONFIG);
    const clock = createClockController(refs, state, rollingText, audio);
    const overlays = createOverlayController(refs, audio, layout);
    const slime = createSlimeController(refs, state, audio, layout, counter, notifier);

    initialize();

    // boot the page after the shared helpers are ready.
    function initialize() {
        syncControlsFromState();
        bindEvents();
        layout.updateLayoutControlVisibility();
        counter.updateDisplay();
        background.start();
        clock.start();

        if (state.hueOff) {
            refs.slime.classList.remove("hue-anim");
        }

        if (refs.slime.complete) {
            layout.updateResponsiveLayout();
            layout.positionTextContainer();
        }
    }

    // wire the dom to the focused feature modules.
    function bindEvents() {
        window.addEventListener("resize", handleResize);
        window.addEventListener("load", handleWindowLoad);
        window.addEventListener("mouseup", slime.handleWindowMouseUp);
        window.addEventListener("wheel", slime.handleWheel, { passive: true });

        document.addEventListener("mousemove", slime.handlePointerMove);

        refs.slime.addEventListener("load", handleImageLoad);
        refs.body.addEventListener("mousedown", slime.handleBodyMouseDown);
        refs.slime.addEventListener("click", slime.handleSlimeClick);

        refs.resetBtn.addEventListener("click", counter.handleResetClick);
        refs.spotifyBtn.addEventListener("click", overlays.toggleSpotifyWidget);

        refs.pagesBtn.addEventListener("click", handlePagesButtonClick);
        refs.pagesClose.addEventListener("click", () => overlays.togglePagesMenu(false));
        refs.pagesMenu.addEventListener("click", handlePagesBackdropClick);

        refs.settingsBtn.addEventListener("click", handleSettingsButtonClick);
        refs.settingsClose.addEventListener("click", () => overlays.toggleSettingsMenu(false));
        refs.settingsMenu.addEventListener("click", handleSettingsBackdropClick);

        refs.followToggle.addEventListener("change", handleFollowChange);
        refs.layoutControlModeSelect.addEventListener("change", handleLayoutControlModeChange);
        refs.layoutModeSelect.addEventListener("change", handleLayoutModeChange);
        refs.menuLayoutModeSelect.addEventListener("change", handleMenuLayoutModeChange);
        refs.hueToggle.addEventListener("change", handleHueToggleChange);
        refs.bgToggle.addEventListener("change", handleBackgroundToggleChange);
        refs.closeBtn.addEventListener("click", overlays.closePrimaryUi);
        refs.hammer.addEventListener("mousedown", slime.handleHammerMouseDown);

        refs.selectTriggers.forEach((item) => {
            item.addEventListener("click", handleSelectTriggerClick);
        });
    }

    function handleResize() {
        layout.updateResponsiveLayout();
        layout.positionTextContainer();
    }

    function handleWindowLoad() {
        // one delayed pass helps after fonts and image metrics settle.
        layout.updateResponsiveLayout();
        layout.positionTextContainer();
        window.setTimeout(() => {
            layout.positionTextContainer();
        }, 200);
    }

    function handleImageLoad() {
        layout.updateResponsiveLayout();
        layout.positionTextContainer();
    }

    function handlePagesButtonClick(event) {
        event.stopPropagation();
        overlays.togglePagesMenu();
    }

    function handlePagesBackdropClick(event) {
        if (event.target === refs.pagesMenu) {
            overlays.togglePagesMenu(false);
        }
    }

    function handleSettingsButtonClick(event) {
        event.stopPropagation();
        overlays.toggleSettingsMenu();
    }

    function handleSettingsBackdropClick(event) {
        if (event.target === refs.settingsMenu) {
            overlays.toggleSettingsMenu(false);
        }
    }

    function handleFollowChange() {
        // when follow mode turns off, return the slime to its neutral pose.
        state.followCursor = refs.followToggle.checked;
        storeValue(STORAGE_KEYS.followCursor, state.followCursor);

        if (!state.followCursor) {
            state.lastX = 0;
            state.lastY = 0;
            slime.applyTransform();
        }
    }

    function handleLayoutControlModeChange() {
        state.layoutControlMode = refs.layoutControlModeSelect.value;
        storeValue(STORAGE_KEYS.layoutControlMode, state.layoutControlMode);
        layout.updateLayoutControlVisibility();
        layout.updateResponsiveLayout();
    }

    function handleLayoutModeChange() {
        state.layoutMode = refs.layoutModeSelect.value;
        storeValue(STORAGE_KEYS.layoutMode, state.layoutMode);
        layout.updateResponsiveLayout();
    }

    function handleMenuLayoutModeChange() {
        state.menuLayoutMode = refs.menuLayoutModeSelect.value;
        storeValue(STORAGE_KEYS.menuLayoutMode, state.menuLayoutMode);
        layout.updateResponsiveLayout();
    }

    function handleHueToggleChange() {
        state.hueOff = !refs.hueToggle.checked;
        storeValue(STORAGE_KEYS.hueOff, state.hueOff);

        if (state.hueOff) {
            refs.slime.classList.remove("hue-anim");
        } else if (state.activated) {
            refs.slime.classList.add("hue-anim");
        }
    }

    function handleBackgroundToggleChange() {
        state.bgOff = !refs.bgToggle.checked;
        storeValue(STORAGE_KEYS.bgOff, state.bgOff);

        if (state.bgOff) {
            refs.bgCanvas.style.opacity = "0";
        } else if (state.activated) {
            refs.bgCanvas.style.opacity = "1";
        }
    }

    function handleSelectTriggerClick(event) {
        const item = event.currentTarget;
        const targetId = item.getAttribute("data-select-target");
        const select = document.getElementById(targetId);

        if (!select || event.target === select) {
            return;
        }

        openSelect(select);
    }

    function syncControlsFromState() {
        refs.followToggle.checked = state.followCursor;
        refs.layoutControlModeSelect.value = state.layoutControlMode;
        refs.layoutModeSelect.value = state.layoutMode;
        refs.menuLayoutModeSelect.value = state.menuLayoutMode;
        refs.hueToggle.checked = !state.hueOff;
        refs.bgToggle.checked = !state.bgOff;
    }

    // shared helpers

    function getRefs() {
        return {
            body: document.getElementById("main-body"),
            bgCanvas: document.getElementById("bg-canvas"),
            slime: document.getElementById("slime"),
            bwScene: document.getElementById("bw-scene"),
            bwSlime: document.getElementById("bw-slime"),
            textContainer: document.getElementById("text-container"),
            date: document.getElementById("date"),
            clock: document.getElementById("clock"),
            counter: document.getElementById("counter"),
            menu: document.getElementById("menu"),
            resetBtn: document.getElementById("reset"),
            settingsBtn: document.getElementById("settings-btn"),
            pagesBtn: document.getElementById("pages-btn"),
            spotifyBtn: document.getElementById("spotify-btn"),
            closeBtn: document.getElementById("close"),
            spotifyWidget: document.getElementById("spotify-widget"),
            pagesMenu: document.getElementById("pages-menu"),
            pagesClose: document.getElementById("pages-close"),
            settingsMenu: document.getElementById("settings-menu"),
            settingsCard: document.getElementById("settings-card"),
            settingsClose: document.getElementById("settings-close"),
            followToggle: document.getElementById("follow"),
            layoutControlModeSelect: document.getElementById("layout-control-mode"),
            layoutModeSelect: document.getElementById("layout-mode"),
            menuLayoutModeSelect: document.getElementById("menu-layout-mode"),
            separateLayoutSettings: document.getElementById("separate-layout-settings"),
            hueToggle: document.getElementById("hue-toggle"),
            bgToggle: document.getElementById("bg-toggle"),
            hammer: document.getElementById("hammer"),
            selectTriggers: Array.from(document.querySelectorAll(".settings-item[data-select-target]")),
        };
    }

    function createState() {
        // keep mutable runtime state in one object so the feature modules can share it.
        return {
            clicks: loadNumber(STORAGE_KEYS.clicks, 0),
            activated: false,
            followCursor: loadBoolean(STORAGE_KEYS.followCursor),
            layoutControlMode: loadString(STORAGE_KEYS.layoutControlMode, "separate"),
            layoutMode: loadString(STORAGE_KEYS.layoutMode, "auto"),
            menuLayoutMode: loadString(STORAGE_KEYS.menuLayoutMode, "auto"),
            hueOff: loadBoolean(STORAGE_KEYS.hueOff),
            bgOff: loadBoolean(STORAGE_KEYS.bgOff),
            resetPending: false,
            resetTimeoutId: null,
            isSlimeDown: false,
            lastX: 0,
            lastY: 0,
            isBwMode: false,
            isBwLocked: false,
            isSlimeBlocked: false,
            isDraggingHammer: false,
            hammerProgress: 0,
            comboTimeoutId: null,
            // mouse drives both the background dots and optional slime follow movement.
            mouse: {
                x: -2000,
                y: -2000,
                active: false,
            },
            backgroundOffset: 0,
            lastChimedHour: new Date().getHours(),
        };
    }

    function createAudioLibrary(sources) {
        const library = Object.fromEntries(
            Object.entries(sources).map(([name, src]) => [name, new Audio(src)]),
        );

        return {
            play(name) {
                const source = library[name];

                if (!source) {
                    return;
                }

                // clone audio nodes so rapid interactions can overlap cleanly.
                const clone = source.cloneNode();
                clone.play().catch(() => {});
                clone.onended = () => clone.remove();
            },
        };
    }

    function createRollingTextRenderer() {
        return {
            update,
        };

        function update(element, nextValue) {
            const currentValue = element.getAttribute("data-value") || "";

            if (currentValue === nextValue) {
                return;
            }

            element.setAttribute("data-value", nextValue);

            if (document.hidden || currentValue.length !== nextValue.length) {
                renderStaticValue(element, nextValue);
                return;
            }

            const containers = element.querySelectorAll(".digit-container");

            for (let index = 0; index < nextValue.length; index += 1) {
                const container = containers[index];
                const oldDigit = container ? container.querySelector(".digit.current") : null;

                if (!oldDigit || oldDigit.textContent === nextValue[index]) {
                    continue;
                }

                const newDigit = document.createElement("span");
                newDigit.className = "digit new";
                newDigit.textContent = nextValue[index];
                container.appendChild(newDigit);

                // wait two frames so the browser can see both states for the transition.
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        oldDigit.classList.replace("current", "old");
                        newDigit.classList.replace("new", "current");
                        window.setTimeout(() => oldDigit.remove(), 600);
                    });
                });
            }
        }

        function renderStaticValue(element, value) {
            element.innerHTML = "";

            for (const char of value) {
                const wrap = document.createElement("span");
                const digit = document.createElement("span");
                const isNumeric = Number.isFinite(Number.parseInt(char, 10));

                wrap.className = `digit-container${isNumeric ? "" : " sep"}`;
                digit.className = "digit current";
                digit.textContent = char;
                wrap.appendChild(digit);
                element.appendChild(wrap);
            }
        }
    }

    function createBackgroundAnimator(canvas, stateValue) {
        const ctx = canvas.getContext("2d");
        const spacing = 45;

        if (!ctx) {
            return {
                start() {},
            };
        }

        return {
            start,
        };

        function start() {
            window.addEventListener("resize", resizeCanvas);
            resizeCanvas();
            animate();
        }

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            stateValue.backgroundOffset += 0.4;

            const time = Date.now() / 50;
            const startX = -spacing;
            const startY = -spacing;
            const endX = canvas.width + spacing;
            const endY = canvas.height + spacing;

            // the dot grid drifts diagonally and bends toward the cursor when active.
            for (let x = startX; x < endX; x += spacing) {
                for (let y = startY; y < endY; y += spacing) {
                    const offset = stateValue.backgroundOffset % spacing;
                    const posX = x + offset;
                    const posY = y + offset;
                    let drawX = posX;
                    let drawY = posY;

                    if (stateValue.mouse.active) {
                        const dx = stateValue.mouse.x - posX;
                        const dy = stateValue.mouse.y - posY;
                        const dist = Math.hypot(dx, dy);
                        const maxDist = 180;

                        if (dist < maxDist) {
                            const force = (maxDist - dist) / maxDist;
                            drawX += dx * force * 0.25;
                            drawY += dy * force * 0.25;
                        }
                    }

                    const hue = (time + (x + y) * 0.1) % 360;
                    ctx.fillStyle = `hsla(${hue}, 60%, 15%, 0.8)`;
                    ctx.beginPath();
                    ctx.arc(drawX, drawY, 4.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            requestAnimationFrame(animate);
        }
    }

    function createClockController(refsValue, stateValue, rollingTextValue, audioValue) {
        const timeZoneLabel = buildTimeZoneLabel();

        return {
            start,
        };

        function start() {
            updateClock();
            window.setInterval(updateClock, 1000);
        }

        function updateClock() {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();
            const timeText = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
            const dateText = now.toLocaleDateString();

            // chime once at the top of the hour, then re-arm after minute zero passes.
            if (minutes === 0 && seconds === 0 && hours !== stateValue.lastChimedHour) {
                audioValue.play("chime");
                stateValue.lastChimedHour = hours;
            } else if (minutes !== 0) {
                stateValue.lastChimedHour = -1;
            }

            rollingTextValue.update(refsValue.clock, timeText);
            rollingTextValue.update(refsValue.date, dateText);

            if (refsValue.clock.title !== timeZoneLabel) {
                refsValue.clock.title = timeZoneLabel;
            }
        }

        function buildTimeZoneLabel() {
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const now = new Date();
            const offsetMinutes = -now.getTimezoneOffset();
            const hours = Math.floor(Math.abs(offsetMinutes) / 60);
            const minutes = Math.abs(offsetMinutes) % 60;
            const sign = offsetMinutes >= 0 ? "+" : "-";

            return `${timeZone}, utc${sign}${hours}:${String(minutes).padStart(2, "0")}`.toLowerCase();
        }
    }

    function createLayoutManager(refsValue, stateValue) {
        return {
            getSlimeBaseY,
            positionTextContainer,
            updateLayoutControlVisibility,
            updateResponsiveLayout,
        };

        function updateLayoutControlVisibility() {
            refsValue.separateLayoutSettings.hidden = stateValue.layoutControlMode !== "separate";
        }

        function getSlimeBaseY() {
            return Number.parseFloat(getComputedStyle(refsValue.body).getPropertyValue("--slime-base-y")) || -45;
        }

        function getEffectiveLayoutMode() {
            return stateValue.layoutControlMode === "separate" ? stateValue.layoutMode : stateValue.layoutControlMode;
        }

        function getEffectiveMenuLayoutMode() {
            return stateValue.layoutControlMode === "separate" ? stateValue.menuLayoutMode : stateValue.layoutControlMode;
        }

        function positionTextContainer() {
            if (refsValue.body.classList.contains("split-layout")) {
                refsValue.textContainer.style.top = "0px";
                return;
            }

            // in stacked layouts the clock block sits directly under the slime image.
            const imageRect = refsValue.slime.getBoundingClientRect();
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const naturalTop = imageRect.bottom + scrollTop - 20;
            refsValue.textContainer.style.top = `${naturalTop}px`;
        }

        function updateResponsiveLayout() {
            const menuRect = refsValue.menu.classList.contains("show")
                ? refsValue.menu.getBoundingClientRect()
                : null;
            const effectiveLayoutMode = getEffectiveLayoutMode();
            const effectiveMenuLayoutMode = getEffectiveMenuLayoutMode();
            // wide landscape screens get the split layout automatically unless settings override it.
            const shouldSplitLayoutAuto = window.innerWidth >= 900 && window.innerWidth > window.innerHeight;
            const shouldSplitLayout = effectiveLayoutMode === "auto"
                ? shouldSplitLayoutAuto
                : effectiveLayoutMode === "horizontal";
            const splitMenuSpace = menuRect ? Math.max(window.innerHeight - menuRect.top, 120) : 0;
            const shouldUseShortSplitLayout = shouldSplitLayout && window.innerHeight <= 720;
            const settingsMenuSafeBottom = menuRect
                ? Math.max(window.innerHeight - menuRect.top + 12, 28)
                : 16;

            // these css vars let the layout and overlays dodge the bottom menu.
            refsValue.body.style.setProperty("--split-menu-space", `${splitMenuSpace}px`);
            refsValue.body.style.setProperty("--settings-menu-safe-bottom", `${settingsMenuSafeBottom}px`);

            if (stateValue.isBwMode) {
                return;
            }

            refsValue.body.classList.toggle("viewport-vertical", window.innerHeight > window.innerWidth);
            refsValue.body.classList.toggle("split-layout", shouldSplitLayout);
            refsValue.body.classList.toggle("short-split-layout", shouldUseShortSplitLayout);
            refsValue.body.classList.toggle("menu-force-horizontal", effectiveMenuLayoutMode === "horizontal");
            refsValue.body.classList.toggle("menu-force-vertical", effectiveMenuLayoutMode === "vertical");

            if (!shouldSplitLayout) {
                refsValue.body.classList.remove("compact-stack");
                positionTextContainer();

                const imageRect = refsValue.slime.getBoundingClientRect();
                const scrollTop = window.scrollY || document.documentElement.scrollTop;
                const naturalTop = imageRect.bottom + scrollTop - 20;
                const menuTop = menuRect ? menuRect.top + scrollTop : Number.POSITIVE_INFINITY;
                const availableSpace = menuTop - naturalTop - 16;

                refsValue.body.classList.toggle("compact-stack", availableSpace < refsValue.textContainer.offsetHeight);
            } else {
                refsValue.body.classList.remove("compact-stack");
            }

            positionTextContainer();
        }
    }

    function createCounterController(refsValue, stateValue, rollingTextValue, audioValue) {
        return {
            handleResetClick,
            spawnEffect,
            updateDisplay,
        };

        function updateDisplay() {
            rollingTextValue.update(refsValue.counter, String(stateValue.clicks));
            storeValue(STORAGE_KEYS.clicks, stateValue.clicks);
            bumpCounter();
        }

        function bumpCounter() {
            refsValue.counter.classList.add("combo");
            window.clearTimeout(stateValue.comboTimeoutId);
            stateValue.comboTimeoutId = window.setTimeout(() => {
                refsValue.counter.classList.remove("combo");
            }, 800);
        }

        function animateIncrement(amount) {
            let current = 0;
            // +10 is paced out so the recovery after bw mode feels more dramatic.
            const intervalId = window.setInterval(() => {
                stateValue.clicks += 1;
                updateDisplay();
                current += 1;

                if (current >= amount) {
                    window.clearInterval(intervalId);
                }
            }, 120);
        }

        function spawnEffect(event, isTen) {
            const plus = document.createElement("div");
            plus.className = isTen ? "plusten" : "plusone";

            if (isTen) {
                ["+", "1", "0"].forEach((char) => {
                    const span = document.createElement("span");
                    span.textContent = char;
                    plus.appendChild(span);
                });
            } else {
                plus.textContent = "+1";
            }

            document.body.appendChild(plus);
            plus.style.left = `${event.clientX}px`;
            plus.style.top = `${event.clientY - 20}px`;

            if (isTen) {
                window.setTimeout(() => {
                    animateIncrement(10);
                }, 500);
            }

            window.setTimeout(() => {
                plus.remove();
            }, isTen ? 2100 : 800);
        }

        function handleResetClick(event) {
            event.stopPropagation();

            // reset is intentionally two-step to avoid losing the score by accident.
            if (!stateValue.resetPending) {
                armResetButton();
                return;
            }

            confirmReset();
        }

        function armResetButton() {
            stateValue.resetPending = true;
            refsValue.resetBtn.classList.add("is-armed", "shake");
            window.clearTimeout(stateValue.resetTimeoutId);
            stateValue.resetTimeoutId = window.setTimeout(clearResetState, 3000);
        }

        function clearResetState() {
            stateValue.resetPending = false;
            stateValue.resetTimeoutId = null;
            refsValue.resetBtn.classList.remove("is-armed", "shake");
        }

        function confirmReset() {
            stateValue.clicks = 0;
            window.clearTimeout(stateValue.resetTimeoutId);
            clearResetState();
            updateDisplay();
            audioValue.play("reset");
            spawnExplosion();
        }

        function spawnExplosion() {
            const boom = document.createElement("img");
            const rect = refsValue.counter.getBoundingClientRect();

            boom.className = "explosion-effect";
            boom.src = `./index_files/explosion-boom.gif?t=${Date.now()}`;
            boom.style.width = `${rect.width + 120}px`;
            boom.style.left = `${rect.left + rect.width / 2}px`;
            boom.style.top = `${rect.top + rect.height / 2}px`;

            document.body.appendChild(boom);
            window.setTimeout(() => boom.remove(), 1600);
        }
    }

    function createSlimeNotifier(config) {
        return {
            notify,
        };

        async function notify() {
            const now = Date.now();
            const lastNotifyAt = Number(localStorage.getItem(STORAGE_KEYS.lastNotifyAt)) || 0;

            // throttle network pings so repeated clicking does not spam the endpoint.
            if (now - lastNotifyAt < config.cooldownMs) {
                return;
            }

            try {
                const response = await fetch(config.endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        language: navigator.language || "unknown",
                        screen: `${window.screen.width}x${window.screen.height}`,
                        page: window.location.href,
                        userAgent: navigator.userAgent,
                    }),
                    keepalive: true,
                });

                if (response.ok) {
                    storeValue(STORAGE_KEYS.lastNotifyAt, now);
                }
            } catch (error) {}
        }
    }

    function createOverlayController(refsValue, audioValue, layoutValue) {
        return {
            closePrimaryUi,
            togglePagesMenu,
            toggleSettingsMenu,
            toggleSpotifyWidget,
        };

        function toggleSpotifyWidget() {
            const isOpen = refsValue.spotifyWidget.classList.toggle("open");
            refsValue.spotifyBtn.classList.toggle("active-widget", isOpen);
            audioValue.play(isOpen ? "uiIn" : "uiOut");
        }

        function togglePagesMenu(forceOpen) {
            const isOpen = typeof forceOpen === "boolean"
                ? forceOpen
                : !refsValue.pagesMenu.classList.contains("open");

            // pages and settings behave like sibling drawers, so opening one closes the other.
            if (isOpen && refsValue.settingsMenu.classList.contains("open")) {
                setOverlayState(refsValue.settingsMenu, refsValue.settingsBtn, false);
            }

            setOverlayState(refsValue.pagesMenu, refsValue.pagesBtn, isOpen);
            audioValue.play(isOpen ? "uiIn" : "uiOut");
        }

        function toggleSettingsMenu(forceOpen) {
            const isOpen = typeof forceOpen === "boolean"
                ? forceOpen
                : !refsValue.settingsMenu.classList.contains("open");

            if (isOpen && refsValue.pagesMenu.classList.contains("open")) {
                setOverlayState(refsValue.pagesMenu, refsValue.pagesBtn, false);
            }

            setOverlayState(refsValue.settingsMenu, refsValue.settingsBtn, isOpen);
            audioValue.play(isOpen ? "uiIn" : "uiOut");
        }

        function closePrimaryUi() {
            refsValue.menu.classList.remove("show");
            setOverlayState(refsValue.pagesMenu, refsValue.pagesBtn, false);
            setOverlayState(refsValue.settingsMenu, refsValue.settingsBtn, false);
            audioValue.play("uiOut");
            layoutValue.updateResponsiveLayout();
        }

        function setOverlayState(menuElement, buttonElement, isOpen) {
            menuElement.classList.toggle("open", isOpen);
            menuElement.setAttribute("aria-hidden", String(!isOpen));
            buttonElement.classList.toggle("active-widget", isOpen);
        }
    }
    function createSlimeController(refsValue, stateValue, audioValue, layoutValue, counterValue, notifierValue) {
        return {
            applyTransform,
            handleBodyMouseDown,
            handleHammerMouseDown,
            handlePointerMove,
            handleSlimeClick,
            handleWheel,
            handleWindowMouseUp,
        };

        function applyTransform(x = 0, y = 0) {
            if (stateValue.isBwMode || stateValue.isSlimeBlocked) {
                return;
            }

            const scale = stateValue.isSlimeDown ? 0.92 : 1;
            const translateY = layoutValue.getSlimeBaseY() + y;
            refsValue.slime.style.transform = `translateY(${translateY}px) translateX(${x}px) scale(${scale})`;
        }

        function showUi() {
            // the first click reveals the hidden ui and optionally fades in the background canvas.
            if (!stateValue.activated) {
                stateValue.activated = true;
                refsValue.counter.style.opacity = "1";
                audioValue.play("uiIn");

                if (!stateValue.bgOff) {
                    refsValue.bgCanvas.style.opacity = "1";
                }
            }

            if (!refsValue.menu.classList.contains("show")) {
                refsValue.menu.classList.add("show");

                if (stateValue.activated && stateValue.clicks > 0) {
                    audioValue.play("uiIn");
                }
            }

            layoutValue.updateResponsiveLayout();
        }

        function handleBodyMouseDown(event) {
            if (stateValue.isBwMode) {
                if (stateValue.isBwLocked) {
                    return;
                }

                // clicking during bw mode cashes out the +10 reward and restores the normal scene.
                stateValue.isSlimeBlocked = true;
                refsValue.slime.classList.add("blocked");
                refsValue.slime.style.transform = `translateY(${layoutValue.getSlimeBaseY()}px) translateX(0px) scale(1)`;
                exitBwMode();
                counterValue.spawnEffect(event, true);

                window.setTimeout(() => {
                    stateValue.isSlimeBlocked = false;
                    refsValue.slime.classList.remove("blocked");
                    refsValue.slime.classList.add("nod-ready");

                    window.setTimeout(() => {
                        refsValue.slime.classList.remove("nod-ready");
                    }, 350);

                    applyTransform();
                }, 800);

                return;
            }

            if (event.target === refsValue.slime && !stateValue.isDraggingHammer && !stateValue.isSlimeBlocked) {
                stateValue.isSlimeDown = true;
                applyTransform(stateValue.lastX, stateValue.lastY);
            }
        }

        function handleSlimeClick(event) {
            if (stateValue.isBwMode || stateValue.isSlimeBlocked) {
                return;
            }

            showUi();
            stateValue.clicks += 1;
            counterValue.updateDisplay();
            counterValue.spawnEffect(event, false);
            notifierValue.notify();

            if (!stateValue.hueOff) {
                refsValue.slime.classList.add("hue-anim");
            }
        }

        function handlePointerMove(event) {
            stateValue.mouse.x = event.clientX;
            stateValue.mouse.y = event.clientY;
            stateValue.mouse.active = true;

            // dragging the hammer takes priority over cursor-follow transforms.
            if (stateValue.isDraggingHammer) {
                refsValue.hammer.style.left = `${event.clientX - 30}px`;
                refsValue.hammer.style.top = `${event.clientY - 30}px`;
                refsValue.hammer.style.bottom = "auto";
            }

            if (!stateValue.followCursor || stateValue.isBwMode || stateValue.isSlimeBlocked) {
                return;
            }

            stateValue.lastX = (event.clientX / window.innerWidth - 0.5) * 50;
            stateValue.lastY = (event.clientY / window.innerHeight - 0.5) * 50;
            applyTransform(stateValue.lastX, stateValue.lastY);
        }

        function handleWheel(event) {
            if (refsValue.settingsMenu.classList.contains("open") && refsValue.settingsCard.contains(event.target)) {
                return;
            }

            // the wheel lifts the hammer into view so it can be dragged onto the slime.
            if (stateValue.isBwMode || stateValue.isDraggingHammer) {
                return;
            }

            if (event.deltaY < 0) {
                stateValue.hammerProgress = Math.min(1, stateValue.hammerProgress + 0.1);
            } else {
                stateValue.hammerProgress = Math.max(0, stateValue.hammerProgress - 0.1);
            }

            refsValue.hammer.style.bottom = `${-100 + stateValue.hammerProgress * 150}px`;
        }

        function handleHammerMouseDown(event) {
            event.stopPropagation();

            if (stateValue.hammerProgress > 0.05) {
                stateValue.isDraggingHammer = true;
                refsValue.hammer.style.transition = "none";
            }
        }

        function handleWindowMouseUp(event) {
            stateValue.isSlimeDown = false;
            applyTransform(stateValue.lastX, stateValue.lastY);

            if (!stateValue.isDraggingHammer) {
                return;
            }

            stateValue.isDraggingHammer = false;
            refsValue.hammer.style.transition = "all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
            refsValue.hammer.style.pointerEvents = "none";

            // temporarily disable hammer hit testing so elementFromPoint can see the slime underneath it.
            const hitElement = document.elementFromPoint(event.clientX, event.clientY);

            refsValue.hammer.style.pointerEvents = "auto";

            if (hitElement === refsValue.slime) {
                audioValue.play("bonk");
                enterBwMode();
            }

            stateValue.hammerProgress = 0;
            refsValue.hammer.style.left = "60px";
            refsValue.hammer.style.bottom = "-100px";
            refsValue.hammer.style.top = "auto";
        }

        function enterBwMode() {
            // bw mode swaps the normal scene for the grayscale reveal and briefly locks input.
            stateValue.isBwMode = true;
            stateValue.isBwLocked = true;
            refsValue.body.classList.add("bw-mode");
            refsValue.slime.classList.remove("hue-anim");
            refsValue.bwSlime.classList.remove("faded-in");
            refsValue.bwScene.setAttribute("aria-hidden", "false");

            requestAnimationFrame(() => {
                refsValue.bwSlime.classList.add("faded-in");
            });

            window.setTimeout(() => {
                stateValue.isBwLocked = false;
            }, 2000);
        }

        function exitBwMode() {
            // returning from bw mode restores layout classes and the live transform state.
            stateValue.isBwMode = false;
            refsValue.body.classList.remove("bw-mode");
            refsValue.bwSlime.classList.remove("faded-in");
            refsValue.bwScene.setAttribute("aria-hidden", "true");

            if (!stateValue.hueOff) {
                refsValue.slime.classList.add("hue-anim");
            }

            layoutValue.updateResponsiveLayout();
            applyTransform();
        }
    }

    function openSelect(selectElement) {
        selectElement.focus({ preventScroll: true });

        if (typeof selectElement.showPicker === "function") {
            try {
                selectElement.showPicker();
                return;
            } catch (error) {}
        }

        selectElement.click();
    }

    function loadBoolean(key) {
        return localStorage.getItem(key) === "true";
    }

    function loadNumber(key, fallback) {
        const rawValue = localStorage.getItem(key);
        const parsedValue = Number(rawValue);
        return Number.isFinite(parsedValue) ? parsedValue : fallback;
    }

    function loadString(key, fallback) {
        return localStorage.getItem(key) || fallback;
    }

    function storeValue(key, value) {
        localStorage.setItem(key, String(value));
    }
})();
