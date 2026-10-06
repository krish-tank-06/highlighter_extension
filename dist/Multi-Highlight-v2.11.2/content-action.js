(function () {
    // The popup injects this script into tabs that were open before install.
    // Keep one listener and observer per tab when that happens.
    if (window.__multiHighlightInitialized) return;
    window.__multiHighlightInitialized = true;

    const DEFAULT_SETTINGS = {
        CSSprefix1: "chrome-extension-FindManyStrings",
        CSSprefix2: "chrome-extension-FindManyStrings-style-",
        CSSprefix3: "CE-FMS-",
        isOn: true,
        isAlwaysSearch: true,
        isCasesensitive: false,
        isWholeWord: false,
        element: "span",
        blacklist: []
    };
    const supportedActions = new Set([
        "hl_clearall", "hl_refresh", "hl_refresh_existing", "_hl_search", "_hl_clear"
    ]);
    const observerConfig = { childList: true, subtree: true, characterData: true };
    const Observer = window.MutationObserver || window.WebKitMutationObserver;
    const root = document.body || document.documentElement;
    let tabId = null;
    let tabkey = null;
    let ready = false;
    let observer = null;
    const pendingMessages = [];

    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (!request || !supportedActions.has(request.action)) return false;
        if (ready) {
            dispatchMessage(request, sendResponse);
        } else {
            pendingMessages.push({ request: request, sendResponse: sendResponse });
        }
        return true;
    });

    chrome.runtime.sendMessage({ action: "getTabId" }, function (response) {
        if (chrome.runtime.lastError || !response || typeof response.tabId !== "number") return;
        tabId = response.tabId;
        tabkey = "multi-highlight_" + tabId;

        if (Observer && root) {
            observer = new Observer(function () {
                chrome.storage.local.get(["settings", tabkey], function (result) {
                    const settings = Object.assign({}, DEFAULT_SETTINGS, result.settings || {});
                    const tabinfo = result[tabkey] || { keywords: [] };
                    if (settings.isOn && settings.isAlwaysSearch && Array.isArray(tabinfo.keywords)) {
                        refresh(tabinfo.keywords, settings);
                    }
                });
            });
            observer.observe(root, observerConfig);
        }

        ready = true;
        pendingMessages.splice(0).forEach(function (message) {
            dispatchMessage(message.request, message.sendResponse);
        });
        chrome.storage.local.get(["settings", tabkey], function (result) {
            const settings = Object.assign({}, DEFAULT_SETTINGS, result.settings || {});
            const tabinfo = result[tabkey] || { keywords: [] };
            if (settings.isOn && settings.isAlwaysSearch && Array.isArray(tabinfo.keywords)) {
                refresh(tabinfo.keywords, settings);
            }
        });
    });

    function dispatchMessage(request, sendResponse) {
        chrome.storage.local.get(["settings", tabkey], function (result) {
            const settings = Object.assign({}, DEFAULT_SETTINGS, result.settings || {});
            const tabinfo = result[tabkey] || { keywords: [] };
            if (!Array.isArray(tabinfo.keywords)) tabinfo.keywords = [];

            switch (request.action) {
                case "hl_clearall":
                    clearAll(settings);
                    break;
                case "hl_refresh":
                    refresh(Array.isArray(request.inputKws) ? request.inputKws : [], settings);
                    break;
                case "hl_refresh_existing":
                    refresh(tabinfo.keywords, settings);
                    break;
                case "_hl_search":
                    search(Array.isArray(request.addedKws) ? request.addedKws : [], settings);
                    break;
                case "_hl_clear":
                    clear(Array.isArray(request.removedKws) ? request.removedKws : [], settings);
                    break;
            }
            sendResponse({ action: "ok" });
        });
    }

    function refresh(keywords, settings) {
        clearAll(settings);
        search(keywords, settings);
    }

    function search(keywords, settings) {
        if (!Array.isArray(keywords) || isBlacklisted(settings) || !root || !window.jQuery) return;
        const sortedKeywords = keywords.slice().sort(function (a, b) {
            return String(b.kwStr || "").length - String(a.kwStr || "").length;
        });
        const classPrefix = settings.CSSprefix1 + " " + settings.CSSprefix2;
        if (!settings.CSSprefix1 || !settings.CSSprefix2 || !settings.CSSprefix3) return;

        if (observer) observer.disconnect();
        try {
            sortedKeywords.forEach(function (keyword) {
                if (!keyword || typeof keyword.kwStr !== "string" || !keyword.kwStr) return;
                const className = classPrefix + (Number(keyword.kwGrp) || 0) + " " +
                    settings.CSSprefix3 + encodeURI(keyword.kwStr);
                $(root).highlight(keyword.kwStr, {
                    className: className,
                    wordsOnly: Boolean(settings.isWholeWord),
                    caseSensitive: Boolean(settings.isCasesensitive),
                    element: settings.element || "span"
                });
            });
        } finally {
            if (observer) observer.observe(root, observerConfig);
        }
    }

    function clear(keywords, settings) {
        if (!Array.isArray(keywords) || !root || !window.jQuery) return;
        if (observer) observer.disconnect();
        try {
            keywords.flat().forEach(function (keyword) {
                if (!keyword || typeof keyword.kwStr !== "string") return;
                const className = (settings.CSSprefix3 + encodeURI(keyword.kwStr)).replace(
                    /[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g,
                    "\\$&"
                );
                $(root).unhighlight({ className: className, element: settings.element || "span" });
            });
        } finally {
            if (observer) observer.observe(root, observerConfig);
        }
    }

    function clearAll(settings) {
        if (!settings.CSSprefix1 || !root || !window.jQuery) return;
        if (observer) observer.disconnect();
        try {
            $(root).unhighlight({ className: settings.CSSprefix1, element: settings.element || "span" });
        } finally {
            if (observer) observer.observe(root, observerConfig);
        }
    }

    function isBlacklisted(settings) {
        if (!Array.isArray(settings.blacklist) || settings.blacklist.length === 0) return false;
        const currentHost = window.location.host.toLowerCase();
        return settings.blacklist.some(function (entry) {
            return entry && currentHost.includes(String(entry).trim().toLowerCase());
        });
    }
})();
