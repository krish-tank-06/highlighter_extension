// ************************************************************************
// Multi Highlight options js
// ************************************************************************
// debugger;
document.addEventListener('DOMContentLoaded', function () {

    chrome.storage.local.get(['settings', 'popupConfig'], function (result) {
        // init
        var settings = result.settings;
        var popupConfig = result.popupConfig;
        // set html
        // delimiter.value = settings.delim;
        // instant.checked = settings.isInstant;
        // saveWords.checked = settings.isSaveKws;
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

        $("#popupHeight").on("input", function () {
            safeSendMessage({
                action: "handle_popupSize_change",
                newHeight: $(this)[0].value,
                newWidth: null,
            });
        });
        $("#popupWidth").on("input", function () {
            safeSendMessage({
                action: "handle_popupSize_change",
                newHeight: null,
                newWidth: $(this)[0].value,
            });
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
            safeSendMessage({
                action: "handle_blacklist_change",
                newBlacklist: $(this)[0].value
            });
        });
    });
});


