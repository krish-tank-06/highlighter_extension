// ************************************************************************
// Multi Highlight options js
// ************************************************************************
// debugger;
var popupHeight = document.getElementById('popupHeight');
var popupWidth = document.getElementById('popupWidth');
var addKw = document.getElementById('addKw');
var removeKw = document.getElementById('removeKw');
var blacklist = document.getElementById('blacklist');
document.addEventListener('DOMContentLoaded', function () {

    chrome.storage.local.get(['settings', 'popupConfig'], function (result) {
        var settings = Object.assign({enableAddKw: true, enableRemoveKw: true, blacklist: []}, result.settings || {});
        var popupConfig = Object.assign({popup_height: 100, popup_width: 400}, result.popupConfig || {});
        popupHeight.value = popupConfig.popup_height;
        popupWidth.value = popupConfig.popup_width;
        addKw.checked = settings.enableAddKw;
        removeKw.checked = settings.enableRemoveKw;
        blacklist.value = Array.isArray(settings.blacklist) ? settings.blacklist.join('\n') : (settings.blacklist || '');

        // register listener
        function safeSendMessage(msg) {
            try {
                chrome.runtime.sendMessage(msg, function () {
                    var err = chrome.runtime.lastError;
                });
            } catch (e) {}
        }

        var blacklistTimer;
        var popupHeightTimer;
        var popupWidthTimer;

        $("#popupHeight").on("input", function () {
            clearTimeout(popupHeightTimer);
            popupHeightTimer = setTimeout(function () {
                safeSendMessage({
                    action: "handle_popupSize_change",
                    newHeight: popupHeight.value,
                    newWidth: null,
                });
            }, 200);
        });
        $("#popupWidth").on("input", function () {
            clearTimeout(popupWidthTimer);
            popupWidthTimer = setTimeout(function () {
                safeSendMessage({
                    action: "handle_popupSize_change",
                    newHeight: null,
                    newWidth: popupWidth.value,
                });
            }, 200);
        });
        $("#addKw").on("input", function () {
            safeSendMessage({
                action: "handle_addKw_change",
                enableIt: $(this)[0].checked,
            });
        });
        $("#removeKw").on("input", function () {
            safeSendMessage({
                action: "handle_removeKw_change",
                enableIt: $(this)[0].checked,
            });
        });
        $("#blacklist").on("input", function () {
            clearTimeout(blacklistTimer);
            blacklistTimer = setTimeout(function () {
                safeSendMessage({
                    action: "handle_blacklist_change",
                    newBlacklist: blacklist.value
                });
            }, 200);
        });
    });
});


