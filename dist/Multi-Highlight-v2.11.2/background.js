// debugger;

const DEFAULT_SETTINGS = {
    CSS_COLORS_COUNT: 20,
    CSSprefix1: "chrome-extension-FindManyStrings",
    CSSprefix2: "chrome-extension-FindManyStrings-style-",
    CSSprefix3: "CE-FMS-",
    delim: ',',
    isAlwaysSearch: true,
    isOn: true,
    isCasesensitive: false,
    isInstant: true,
    isNewlineNewColor: false,
    isSaveKws: true,
    isWholeWord: false,
    latest_keywords: [],
    element: 'mh',
    blacklist: [],
    enableAddKw: true,
    enableRemoveKw: true
};
const DEFAULT_POPUP_CONFIG = { popup_width: 400, popup_height: 100 };

// Migrate older installs without discarding the user's saved settings.
chrome.runtime.onInstalled.addListener(function () {
    chrome.storage.local.get(['settings', 'popupConfig'], function (result) {
        const settings = Object.assign({}, DEFAULT_SETTINGS, result.settings || {});
        const popupConfig = Object.assign({}, DEFAULT_POPUP_CONFIG, result.popupConfig || {});
        if (!Array.isArray(settings.latest_keywords)) settings.latest_keywords = [];
        if (!Array.isArray(settings.blacklist)) {
            settings.blacklist = String(settings.blacklist || '').split(/\r?\n/).map(function (site) {
                return site.trim();
            }).filter(Boolean);
        }

        chrome.storage.local.set({ settings: settings, popupConfig: popupConfig }, function () {
            sync_context_menus(settings);
        });
    });
});


// handle tab update
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
    if (changeInfo.status === 'complete') {
        chrome.storage.local.get(['settings'], function (result) {
            var settings = result.settings;
            var tabkey = get_tabkey(tabId);
            var tabinfo = init_tabinfo(tabId, settings);
            chrome.storage.local.set({[tabkey]: tabinfo});
            set_badge('normal');
        });
    }
});

chrome.tabs.onRemoved.addListener(function (tabId) {
    chrome.storage.local.remove(get_tabkey(tabId));
});

function init_tabinfo(tabId, settings) {
    return {
        id: tabId,
        keywords: (settings && settings.isSaveKws && Array.isArray(settings.latest_keywords))
            ? settings.latest_keywords.slice()
            : []
    };
}

// handle activate tab switch in a window
chrome.tabs.onActivated.addListener(function (activeInfo) {
    var tabkey = get_tabkey(activeInfo.tabId);
    chrome.storage.local.get([tabkey], function (result) {
        set_badge(result[tabkey] ? 'normal' : 'error');
    });
});

function set_badge(status) {
    if (status === 'error') {
        chrome.action.setBadgeBackgroundColor({
            color: '#FF0000'
        });
        chrome.action.setBadgeText({
            text: '!'
        });
    } else if (status === 'normal') {
        chrome.action.setBadgeBackgroundColor({
            color: 'white'
        });
        chrome.action.setBadgeText({
            text: ''
        });
    }
    ;
}


// handle context menu item
chrome.contextMenus.onClicked.addListener(function getword(info, tab) {
    if (!tab || typeof tab.id !== 'number' || !info.selectionText) return;
    var tabId = tab.id;
    var tabkey = get_tabkey(tabId);
    var kw = info.selectionText.trim();
    if (!kw) return;

    if (info.menuItemId === "removeKw") {
        chrome.storage.local.get(["settings", tabkey], function (result) {
            // init
            var settings = result.settings;
            var tabinfo = result[tabkey];
            if (!settings || !tabinfo || !Array.isArray(tabinfo.keywords)) return;
            var kws = tabinfo.keywords;

            var pos = -1;
            for (var i = 0, len = kws.length; i < len; ++i) { // if selected kw isn't in saved list, set pos=-1
                if (kws[i].kwStr === kw) {
                    pos = i;
                    break;
                }
            }
            if (pos < 0) return;
            safeSendTabMessage(tabId, {
                action: "_hl_clear",
                removedKws: [kws[pos]],
            });
            // settings.isNewlineNewColor || (tabinfo.style_nbr -= [kws[pos]].length); // !! always keep this after _hl_clear function !!
            // _hl_clear([kws[pos]], settings, tabinfo);
            tabinfo.keywords.splice(pos, 1);
            settings.latest_keywords = tabinfo.keywords;
            chrome.storage.local.set({[tabkey]: tabinfo, "settings": settings}, function () {
            });
        });
    } else if (info.menuItemId === "addKw") {
        chrome.storage.local.get(["settings", tabkey], function (result) {
            var settings = result.settings;
            var tabinfo = result[tabkey];
            if (!settings || !tabinfo || !Array.isArray(tabinfo.keywords)) return;

            var addedKw;
            if (settings.isNewlineNewColor) {
                addedKw = {kwGrp: 0, kwStr: kw};
                tabinfo.keywords.unshift(addedKw);
            } else {
                addedKw = {kwGrp: (tabinfo.keywords.length % 20), kwStr: kw};
                tabinfo.keywords.push(addedKw);
            }
            safeSendTabMessage(tabId, {
                action: "_hl_search",
                addedKws: [addedKw],
            });
            // _hl_search([addedKw], settings, tabinfo);

            settings.latest_keywords = tabinfo.keywords;
            chrome.storage.local.set({[tabkey]: tabinfo, "settings": settings}, function () {
            });
        });
    }

});


function handle_addKw_change(enableIt) { // option page
    chrome.storage.local.get(['settings'], function (result) {
        if (!result.settings) return;
        result.settings.enableAddKw = Boolean(enableIt);

        chrome.storage.local.set({'settings': result.settings}, function () {
            set_context_menu('addKw', 'Add Keyword', Boolean(enableIt));
        });
    });
}


function handle_removeKw_change(enableIt) { // option page
    chrome.storage.local.get(['settings'], function (result) {
        if (!result.settings) return;
        result.settings.enableRemoveKw = Boolean(enableIt);

        chrome.storage.local.set({'settings': result.settings}, function () {
            set_context_menu('removeKw', 'Remove Keyword', Boolean(enableIt));
        });
    });
}

function sync_context_menus(settings) {
    chrome.contextMenus.removeAll(function () {
        if (settings.enableAddKw) set_context_menu('addKw', 'Add Keyword', true);
        if (settings.enableRemoveKw) set_context_menu('removeKw', 'Remove Keyword', true);
    });
}

function set_context_menu(id, title, enabled) {
    chrome.contextMenus.remove(id, function () {
        // remove() reports an error when the menu has not been created yet.
        void chrome.runtime.lastError;
        if (enabled) {
            chrome.contextMenus.create({ id: id, title: title, contexts: ['selection'] }, function () {
                void chrome.runtime.lastError;
            });
        }
    });
}


function handle_popupSize_change(newHeight, newWidth) { // option page
    chrome.storage.local.get(['popupConfig'], function (result) {
        var popupConfig = Object.assign({}, DEFAULT_POPUP_CONFIG, result.popupConfig || {});
        var is_changed = false;
        if (newHeight) {
            popupConfig.popup_height = Math.min(500, Math.max(100, Number(newHeight) || DEFAULT_POPUP_CONFIG.popup_height));
            is_changed = true;
        }
        if (newWidth) {
            popupConfig.popup_width = Math.min(760, Math.max(400, Number(newWidth) || DEFAULT_POPUP_CONFIG.popup_width));
            is_changed = true;
        }
        if (is_changed) {
            chrome.storage.local.set({'popupConfig': popupConfig});
        }
    });
}

function handle_blacklist_change(newBlacklist) {
    chrome.storage.local.get(['settings'], function (result) {
        if (!result || !result.settings) return;
        if (!newBlacklist || newBlacklist === "" || (Array.isArray(newBlacklist) && newBlacklist.length === 0)) {
            result.settings.blacklist = [];
            chrome.storage.local.set({'settings': result.settings});
            return;
        }

        if (Array.isArray(newBlacklist)) {
            result.settings.blacklist = newBlacklist.map(s => String(s).trim()).filter(Boolean);
        } else {
            result.settings.blacklist = String(newBlacklist).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        }
        chrome.storage.local.set({'settings': result.settings});
    });
}


// handle message
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "getTabId") {
        var tabId = sender.tab && sender.tab.id;
        if (typeof tabId !== 'number') {
            sendResponse({});
            return false;
        }
        var tabkey = get_tabkey(tabId);
        chrome.storage.local.get(['settings', tabkey], function (result) {
            if (result[tabkey]) {
                sendResponse({tabId: tabId});
                return;
            }
            var tabinfo = init_tabinfo(tabId, result.settings);
            chrome.storage.local.set({[tabkey]: tabinfo}, function () {
                sendResponse({tabId: tabId});
            });
        });
        return true;
    } else if (request.action === "handle_addKw_change") {
        handle_addKw_change(request.enableIt);
    } else if (request.action === "handle_removeKw_change") {
        handle_removeKw_change(request.enableIt);
    } else if (request.action === "handle_popupSize_change") {
        handle_popupSize_change(request.newHeight, request.newWidth);
    } else if (request.action === "handle_blacklist_change") {
        handle_blacklist_change(request.newBlacklist);
    }
});


// handle popup close
chrome.runtime.onConnect.addListener(function (port) {
    if (port.name.startsWith("popup_")) {
        port.onDisconnect.addListener(function (port) {
            var tabId = parseInt(port.name.substring(6), 10);
            var tabkey = get_tabkey(tabId);
            chrome.storage.local.get(['settings', tabkey], function (result) {
                var settings = result.settings;
                if (settings && settings.isOn) {
                    safeSendTabMessage(tabId, {
                        action: "hl_refresh_existing",
                    });
                }
            });
        });
    }
});


// convertion between tabkey and tabId
function get_tabkey(tabId) {
    return "multi-highlight_" + tabId;
}

function get_tabId(tabkey) {
    return parseInt(tabkey.substring(16))
}

function safeSendTabMessage(tabId, message, callback) {
    if (!tabId) return;
    try {
        chrome.tabs.sendMessage(tabId, message, function (response) {
            var err = chrome.runtime.lastError;
            if (callback) {
                callback(response, err);
            }
        });
    } catch (e) {
        // Silently ignore connection errors to unloaded or restricted tabs
    }
}
