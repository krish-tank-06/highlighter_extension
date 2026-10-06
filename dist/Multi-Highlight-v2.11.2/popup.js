// ************************************************************************
// Multi Highlight popup js
// ************************************************************************
// debugger;

var container = document.getElementById('container');
var highlightWords = document.getElementById('highlightWords');
var delimiter = document.getElementById('delimiter');
var instant = document.getElementById('instant');
var toggleMHL = document.getElementById('toggleMHL');
var alwaysSearch = document.getElementById('alwaysSearch');
var newlineNewColor = document.getElementById('newlineNewColor');
var casesensitive = document.getElementById('casesensitive');
var wholeWord = document.getElementById('wholeWord');
var saveWords = document.getElementById('saveWords');

var defaultSettings = {
    CSS_COLORS_COUNT: 20,
    CSSprefix1: "chrome-extension-FindManyStrings",
    CSSprefix2: "chrome-extension-FindManyStrings-style-",
    CSSprefix3: "CE-FMS-",
    delim: ",",
    isAlwaysSearch: true,
    isOn: true,
    isCasesensitive: false,
    isInstant: true,
    isNewlineNewColor: false,
    isSaveKws: true,
    isWholeWord: false,
    latest_keywords: [],
    element: "span",
    blacklist: [],
    enableAddKw: true,
    enableRemoveKw: true
};
var defaultPopupConfig = {
    popup_height: 100,
    popup_width: 400,
}

// document.addEventListener('DOMContentLoaded', function () {
window.addEventListener('load', function () {
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        var currTab = tabs[0];
        if (!currTab || typeof currTab.id !== "number") {
            showUnavailable("There is no active tab to highlight.");
            return;
        }

        var tabId = currTab.id;
        var tabkey = get_tabkey(tabId);
        chrome.storage.local.get(['settings', 'popupConfig', tabkey], function (result) {
            var settings = Object.assign({}, defaultSettings, result.settings || {});
            var popupConfig = Object.assign({}, defaultPopupConfig, result.popupConfig || {});
            var tabinfo = result[tabkey] || {
                id: tabId,
                keywords: settings.isSaveKws && Array.isArray(settings.latest_keywords)
                    ? settings.latest_keywords.slice()
                    : []
            };
            if (!Array.isArray(tabinfo.keywords)) tabinfo.keywords = [];

            container.style.width = popupConfig.popup_width + "px";
            highlightWords.style.minHeight = popupConfig.popup_height + "px";
            highlightWords.disabled = false;
            highlightWords.style.backgroundColor = 'transparent';
            highlightWords.value = keywordsToStr(tabinfo.keywords, settings);
            delimiter.value = settings.delim;
            instant.checked = settings.isInstant;
            toggleMHL.checked = settings.isOn;
            alwaysSearch.checked = settings.isAlwaysSearch;
            newlineNewColor.checked = settings.isNewlineNewColor;
            casesensitive.checked = settings.isCasesensitive;
            wholeWord.checked = settings.isWholeWord;
            saveWords.checked = settings.isSaveKws;
            build_keywords_list(tabinfo.keywords);

            chrome.storage.local.set({
                [tabkey]: tabinfo,
                settings: settings,
                popupConfig: popupConfig
            }, function () {
                registerPopupEvents(tabkey, tabId);
                ensureContentScript(tabId, function (error) {
                    if (error) {
                        showUnavailable("This page does not allow extensions to run. Try a regular website tab.");
                        return;
                    }
                    if (settings.isOn) {
                        safeSendTabMessage(tabId, {
                            action: "hl_refresh",
                            inputKws: tabinfo.keywords.slice()
                        });
                    } else {
                        safeSendTabMessage(tabId, {action: "hl_clearall"});
                    }
                    check_keywords_existence(tabId);
                });
            });
        });
    });
});

function registerPopupEvents(tabkey, tabId) {
    $("#highlightWords").on("input", function () {
        handle_highlightWords_change(tabkey, {fromBgOrPopup: true});
    });
    $("#highlightWords").inactivity({timeout: 300, mouse: false, keyboard: true, touch: false});
    $("#highlightWords").on("inactivity", function () {
        handle_highlightWords_change(tabkey, {refresh: true, fromBgOrPopup: true});
    });
    $("#kw-list").on("click", function (event) {
        handle_keyword_removal(event, tabkey, {fromBgOrPopup: true});
    });
    $("#toggleMHL,#casesensitive, #wholeWord, #delimiter, #instant, #saveWords,#alwaysSearch,#newlineNewColor")
        .on("input", function (event) {
            handle_option_change(tabkey, event);
        });
    $('#forceRefresh').on("click", function () {
        handle_highlightWords_change(tabkey, {refresh: true, fromBgOrPopup: true});
    });
    $("#options_icon").on("click", function () {
        chrome.runtime.openOptionsPage();
    });
    chrome.runtime.connect({name: "popup_" + tabId});
}


function build_keywords_list(inputKws) {
    var list = document.getElementById('kw-list');
    list.querySelectorAll('.keywords').forEach(function (element) { element.remove(); });
    inputKws.forEach(function (keyword) {
        var chip = document.createElement('span');
        chip.className = 'keywords';
        chip.textContent = keyword.kwStr;
        list.appendChild(chip);
    });
}

function check_keywords_existence(tabId) {
    chrome.scripting.executeScript({
        target: {tabId: tabId},
        files: ["getPagesSource.js"]
    }, function () {
        // If you try and inject into an extensions page or the webstore/NTP you'll get an error
        if (chrome.runtime.lastError) {
            console.warn('There was an error injecting script : \n' + chrome.runtime.lastError.message);
        } else {
            chrome.action.setBadgeText({text: ''});
        }
    });
}

function ensureContentScript(tabId, callback) {
    chrome.scripting.insertCSS({
        target: {tabId: tabId},
        files: ["highlight.css"]
    }, function () {
        var cssError = chrome.runtime.lastError;
        if (cssError) {
            callback(cssError.message);
            return;
        }
        chrome.scripting.executeScript({
            target: {tabId: tabId},
            files: ["jquery/jquery.js", "jquery/jquery.highlight.js", "content-action.js"]
        }, function () {
            var scriptError = chrome.runtime.lastError;
            callback(scriptError ? scriptError.message : null);
        });
    });
}

function showUnavailable(message) {
    highlightWords.value = "";
    highlightWords.disabled = true;
    highlightWords.style.backgroundColor = '#E4E5E7';
    highlightWords.placeholder = '[ Disabled ]\n\n' + message;
    chrome.action.setBadgeBackgroundColor({color: '#FF0000'});
    chrome.action.setBadgeText({text: '!'});
}

chrome.runtime.onMessage.addListener(function (request, sender) {
    if (request.action === "getVisibleText") {
        var visibleText = request.source || "";
        chrome.storage.local.get(['settings'], function (result) {
            var settings = Object.assign({}, defaultSettings, result.settings || {});
            document.querySelectorAll('#kw-list>.keywords').forEach(elem => {
                var word = elem.innerText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                var pattern = settings.isWholeWord ? '\\b(' + word + ')\\b' : '(' + word + ')';
                var exists = false;
                try {
                    exists = new RegExp(pattern, settings.isCasesensitive ? '' : 'i').test(visibleText);
                } catch (error) {}
                elem.classList.toggle("notAvailable", !exists);
            });
        });
    }
});


function handle_keyword_removal(event, tabkey, option = {}) {
    if (event.ctrlKey && event.target.matches('.keywords')) { // bugfix: don't remove the container
        chrome.storage.local.get(['settings'], function (result) {
            var settings = Object.assign({}, defaultSettings, result.settings || {});
            event.target.remove();
            highlightWords.value = [...document.querySelectorAll('#kw-list>.keywords')].map(elem => elem.innerText).join(settings.delim);
            handle_highlightWords_change(tabkey, option); // update highlights
        });
    }
}

// ****** Multi Highlight functions
// option.refresh -- when true, rehighlight webpage content
// option.useSavedKws -- when true, use saved kws instead of highlightWords.value as inputStr
// option.fromBgOrPopup -- if you run this function from popup or background, remember to set it to true. Otherwise, we expect the call is from content script
function handle_highlightWords_change(tabkey, option = {}, callback = null) {
    chrome.storage.local.get(['settings', tabkey], function (result) {
        var settings = Object.assign({}, defaultSettings, result.settings || {});
        var tabinfo = result[tabkey] || {id: get_tabId(tabkey), keywords: []};
        if (!Array.isArray(tabinfo.keywords)) tabinfo.keywords = [];
        var tabId = get_tabId(tabkey);

        var inputStr = option.useSavedKws
            ? keywordsToStr(tabinfo.keywords, settings)
            : highlightWords.value;

        // (instant search mode) or (last char of input is delimiter)
        if (settings.isInstant || !inputStr || inputStr.slice(-1) === settings.delim) {
            var inputKws = keywordsFromStr(inputStr, settings);
            var savedKws = tabinfo.keywords;

            // differ it
            var addedKws = KeywordsMinus(inputKws, savedKws);
            var removedKws = KeywordsMinus(savedKws, inputKws);

            if (!settings.isOn) {
                safeSendTabMessage(tabId, {action: "hl_clearall"});
            } else if (option.refresh) {
                safeSendTabMessage(tabId, {
                    action: "hl_refresh",
                    inputKws: [...inputKws], // make a copy to avoid affection from sorting the _hl_search
                });
            } else {
                safeSendTabMessage(tabId, {
                    action: "_hl_clear",
                    removedKws: removedKws,
                }, function (response, err) {
                    if (err) return;
                    safeSendTabMessage(tabId, {
                        action: "_hl_search",
                        addedKws: addedKws,
                    });
                });
            }

            tabinfo.keywords = inputKws;

            if (option.fromBgOrPopup) {
                build_keywords_list(inputKws);
            }

            settings.latest_keywords = inputKws;
            chrome.storage.local.set({[tabkey]: tabinfo, "settings": settings}, function () {
                callback && callback();
            });
        } else {
            callback && callback();
        }
    });
}


function handle_option_change(tabkey, event) { // tabkey of popup window
    chrome.storage.local.get(['settings'], function (result) {
        var settings = Object.assign({}, defaultSettings, result.settings || {});

        var forceRefresh = (settings.isWholeWord != wholeWord.checked)
            || (settings.isCasesensitive != casesensitive.checked)
            || (settings.isNewlineNewColor != newlineNewColor.checked)
            || event.currentTarget === toggleMHL;

        // update settings
        settings.isOn = toggleMHL.checked;
        settings.delim = delimiter.value || ",";
        delimiter.value = settings.delim;
        settings.isInstant = instant.checked;
        settings.isAlwaysSearch = alwaysSearch.checked;
        settings.isNewlineNewColor = newlineNewColor.checked;
        settings.isCasesensitive = casesensitive.checked;
        settings.isWholeWord = wholeWord.checked;
        settings.isSaveKws = saveWords.checked;

        if (settings.isSaveKws) {
            $('#alwaysSearch').removeAttr('disabled'); // enable input
        } else {
            $('#alwaysSearch').prop("checked", false); // uncheck alwaysSearch
            settings.isAlwaysSearch = false; // set alwaysSearch to false
            $('#alwaysSearch').attr('disabled', true); // disable alwaysSearch checkbox
        }

        chrome.storage.local.set({'settings': settings}, function () {
            if (tabkey) {
                handle_highlightWords_change(tabkey, {refresh: forceRefresh, fromBgOrPopup: true});
            }
        });
    });
}


// return an array of keyword object:
// [{kwGrp: kwGrpNum, kwStr: keywordString}, {kwGrp: ..., kwStr: ...}, ...]
// The kwGrp is defined in two ways, if in the NewColorNewLine mode, the kwGrp
// is the same for keywords on the same line; otherwise, the kwGrp increases
// every keywords
function keywordsFromStr(inputStr, settings) {
    if (!inputStr) return [];
    var separator = settings.delim || ",";
    if (settings.isNewlineNewColor) {
        return inputStr.split(/\n/g).filter(i => i).reduce((arr, line, lineCnt) => {
            arr = arr.concat(line.split(separator).filter(i => i).map(kws => {
                return {kwGrp: (lineCnt % 20), kwStr: kws};
            }));
            return arr;
        }, []);
    } else {
        return inputStr.split(separator).filter(i => i).map((kws, cnt) => {
            return {kwGrp: (cnt % 20), kwStr: kws};
        });
    }
}

function keywordsToStr(kws, settings) {
    if (!Array.isArray(kws)) return "";
    var separator = settings.delim || ",";
    var str = "";
    if (settings.isNewlineNewColor) {
        for (var i = 0, len = kws.length - 1; i < len; ++i) {
            str += kws[i].kwStr + ((kws[i].kwGrp != kws[i + 1].kwGrp) ? "\n" : separator);
        }
        // and the last one
        kws.length && (str += kws[kws.length - 1].kwStr);
    } else {
        str = kws.map(kw => kw.kwStr).join(separator);
        // append deliminator if there are words
        str += str ? settings.delim : "";
    }
    return str
}

function KeywordsMinus(kwListA, kwListB) {
    if (!Array.isArray(kwListA)) kwListA = [];
    if (!Array.isArray(kwListB)) kwListB = [];
    function KwListContain(kwList, kwA) {
        for (const kw of kwList) {
            if (kw.kwStr === kwA.kwStr && kw.kwGrp === kwA.kwGrp) {
                return true;
            }
        }
        return false;
    }

    // console.log(kwListA.map(x=>KwListContain(kwListB, x)));
    return kwListA.filter(x => !KwListContain(kwListB, x));

}


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
