/*
 *
 * (c) Copyright Ascensio System Limited 2010-2016
 *
 * This program is freeware. You can redistribute it and/or modify it under the terms of the GNU 
 * General Public License (GPL) version 3 as published by the Free Software Foundation (https://www.gnu.org/copyleft/gpl.html). 
 * In accordance with Section 7(a) of the GNU GPL its Section 15 shall be amended to the effect that 
 * Ascensio System SIA expressly excludes the warranty of non-infringement of any third-party rights.
 *
 * THIS PROGRAM IS DISTRIBUTED WITHOUT ANY WARRANTY; WITHOUT EVEN THE IMPLIED WARRANTY OF MERCHANTABILITY OR
 * FITNESS FOR A PARTICULAR PURPOSE. For more details, see GNU GPL at https://www.gnu.org/copyleft/gpl.html
 *
 * You can contact Ascensio System SIA by email at sales@onlyoffice.com
 *
 * The interactive user interfaces in modified source and object code versions of ONLYOFFICE must display 
 * Appropriate Legal Notices, as required under Section 5 of the GNU GPL version 3.
 *
 * Pursuant to Section 7 § 3(b) of the GNU GPL you must retain the original ONLYOFFICE logo which contains 
 * relevant author attributions when distributing the software. If the display of the logo in its graphic 
 * form is not reasonably feasible for technical reasons, you must include the words "Powered by ONLYOFFICE" 
 * in every copy of the program you distribute. 
 * Pursuant to Section 7 § 3(e) we decline to grant you any rights under trademark law for use of our trademarks.
 *
*/


;
window.ASC.Files.Editor = (function () {
    var isInit = false;

    var docIsChanged = false;
    var docIsChangedTimeout = null;
    var canShowHistory = false;

    var docEditor = null;
    var docServiceParams = {};
    var configurationParams = null;

    var trackEditTimeout = null;
    var doStartEdit = true;

    var init = function () {
        if (isInit === false) {
            isInit = true;
        }

        jq("body").css("overflow-y", "hidden");

        window.onbeforeunload = ASC.Files.Editor.finishEdit;

        ASC.Files.ServiceManager.bind(ASC.Files.ServiceManager.events.TrackEditFile, completeTrack);
        ASC.Files.ServiceManager.bind(ASC.Files.ServiceManager.events.StartEdit, onStartEdit);
        ASC.Files.ServiceManager.bind(ASC.Files.ServiceManager.events.GetEditHistory, completeGetEditHistory);
        ASC.Files.ServiceManager.bind(ASC.Files.ServiceManager.events.GetDiffUrl, completeGetDiffUrl);
        ASC.Files.ServiceManager.bind(ASC.Files.ServiceManager.events.RestoreVersion, completeGetEditHistory);
        ASC.Files.ServiceManager.bind(ASC.Files.ServiceManager.events.GetMails, completeGetMails);
        ASC.Files.ServiceManager.bind(ASC.Files.ServiceManager.events.StartMailMerge, completeStartMailMerge);
        ASC.Files.ServiceManager.bind(ASC.Files.ServiceManager.events.FileRename, completeRename);
    };

    var createFrameEditor = function (configuration) {

        jq("#iframeEditor").parents().css("height", "100%");

        var eventsConfig = {
            "onAppReady": ASC.Files.Editor.readyEditor,
            //todo: remove
            "onReady": ASC.Files.Editor.readyEditor,
        };

        if (configuration) {
            var embedded = (configuration.type == "embedded");

            var documentConfig = configuration.document;

            var options = getOptions();
            if (options) {
                documentConfig.options = options;
            }

            var editorConfig = configuration.editorConfig;

            if (embedded) {
                var keyFullscreen = "fullscreen";
                if (location.hash.indexOf(keyFullscreen) < 0) {
                    editorConfig.embedded.fullscreenUrl = editorConfig.embedded.embedUrl + "#" + keyFullscreen;
                }
            } else {
                if (configuration.type != "embedded") {
                    var listRecent = getRecentList();
                    if (listRecent && listRecent.length) {
                        editorConfig.recent = listRecent.toArray();
                    }
                }
            }

            var typeConfig = configuration.type;
            var documentTypeConfig = configuration.documentType;

            eventsConfig.onDocumentStateChange = ASC.Files.Editor.documentStateChangeEditor;
            if (ASC.Files.Editor.docServiceParams.linkToEdit) {
                eventsConfig.onRequestEditRights = ASC.Files.Editor.requestEditRightsEditor;
            }
            eventsConfig.onError = ASC.Files.Editor.errorEditor;
            eventsConfig.onOutdatedVersion = ASC.Files.Editor.reloadPage;
            eventsConfig.onInfo = ASC.Files.Editor.infoEditor;
            eventsConfig.onRequestRename = ASC.Files.Editor.rename;
            eventsConfig.onMetaChange = ASC.Files.Editor.metaChange;

            if (ASC.Files.Constants.URL_MAIL_ACCOUNTS) {
                eventsConfig.onRequestEmailAddresses = ASC.Files.Editor.getMails;
                eventsConfig.onRequestStartMailMerge = ASC.Files.Editor.requestStartMailMerge;
            }

            if (!ASC.Files.Editor.docServiceParams.fileProviderKey
                && !ASC.Files.Editor.docServiceParams.editByUrl
                && !ASC.Files.Editor.docServiceParams.thirdPartyApp) {

                ASC.Files.Editor.canShowHistory = true;
                eventsConfig.onRequestHistory = ASC.Files.Editor.requestHistory;
                eventsConfig.onRequestHistoryData = ASC.Files.Editor.getDiffUrl;
                eventsConfig.onRequestHistoryClose = ASC.Files.Editor.reloadPage;
                eventsConfig.onRequestRestore = ASC.Files.Editor.restoreVersion;
            }
            var token = configuration.token;
        }

        ASC.Files.Editor.docEditor = new DocsAPI.DocEditor("iframeEditor", {
            width: "100%",
            height: "100%",

            type: typeConfig || "desktop",
            documentType: documentTypeConfig,
            document: documentConfig,
            editorConfig: editorConfig,
            token: token,
            events: eventsConfig
        });
    };

    var getOptions = function () {
        try {
            var param = /(?:\?|\&)options=([^&]*)/g.exec(location.href);
            if (param && param[1]) {
                return jq.parseJSON(decodeURIComponent(param[1]));
            }
        } catch (e) {
        }
        return null;
    };

    var fixSize = function () {
        var wrapEl = document.getElementById("wrap");
        if (wrapEl) {
            wrapEl.style.height = screen.availHeight + "px";
            window.scrollTo(0, -1);
            wrapEl.style.height = window.innerHeight + "px";
        }
    };

    var readyEditor = function () {
        if (ASC.Files.Editor.docServiceParams.serverErrorMessage) {
            ASC.Files.Editor.docEditor.showMessage(ASC.Files.Editor.docServiceParams.serverErrorMessage);
            return;
        }

        if (checkMessageFromHash()) {
            location.hash = "";
            return;
        }

        if (ASC.Files.Editor.configurationParams && ASC.Files.Editor.configurationParams.editorConfig.mode === "edit") {
            ASC.Files.Editor.trackEdit();
        }
    };

    var documentStateChangeEditor = function (event) {
        clearTimeout(docIsChangedTimeout);

        if (docIsChanged != event.data) {
            var titleChange = function () {
                document.title = ASC.Files.Editor.configurationParams.document.title + (event.data ? " *" : "");
                docIsChanged = event.data;
            };

            if (event.data) {
                titleChange();
            } else {
                docIsChangedTimeout = setTimeout(titleChange, 500);
            }
        }

        if (event.data) {
            subscribeEdit(ASC.Files.ServiceManager.events.StartEdit);
        }
    };

    var subscribeEdit = function (event) {
        if (doStartEdit) {
            doStartEdit = false;

            ASC.Files.ServiceManager.startEdit(event, {
                fileID: ASC.Files.Editor.docServiceParams.fileId,
                shareLinkParam: ASC.Files.Editor.docServiceParams.shareLinkParam,
            });

            return true;
        }
        return false;
    };

    var errorEditor = function () {
        ASC.Files.Editor.finishEdit();
    };

    var requestEditRightsEditor = function () {
        location.href = ASC.Files.Editor.docServiceParams.linkToEdit + ASC.Files.Editor.docServiceParams.shareLinkParam;
    };

    var requestHistory = function () {
        if (!ASC.Files.Editor.canShowHistory) {
            return;
        }

        ASC.Files.Editor.finishEdit();

        ASC.Files.ServiceManager.getEditHistory(ASC.Files.ServiceManager.events.GetEditHistory,
            {
                fileID: ASC.Files.Editor.docServiceParams.fileId,
                shareLinkParam: ASC.Files.Editor.docServiceParams.shareLinkParam
            });
    };

    var getDiffUrl = function (versionData) {
        if (!ASC.Files.Editor.canShowHistory) {
            return;
        }

        ASC.Files.ServiceManager.getDiffUrl(ASC.Files.ServiceManager.events.GetDiffUrl,
            {
                fileID: ASC.Files.Editor.docServiceParams.fileId,
                version: versionData.data | 0,
                shareLinkParam: ASC.Files.Editor.docServiceParams.shareLinkParam
            });
    };

    var restoreVersion = function (versionData) {
        ASC.Files.ServiceManager.restoreVersion(ASC.Files.ServiceManager.events.RestoreVersion,
            {
                fileID: ASC.Files.Editor.docServiceParams.fileId,
                version: versionData.data.version,
                shareLinkParam: ASC.Files.Editor.docServiceParams.shareLinkParam,
                setLast: true,
                url: versionData.data.url || "",
            });
    };

    var getMails = function () {
        ASC.Files.ServiceManager.getMailAccounts(ASC.Files.ServiceManager.events.GetMails);
    };

    var requestStartMailMerge = function () {
        if (!subscribeEdit(ASC.Files.ServiceManager.events.StartMailMerge)) {
            completeStartMailMerge();
        }
    };

    var infoEditor = function (event) {
        if (event && event.data && event.data.mode == "view") {
            clearTimeout(trackEditTimeout);
            trackEditTimeout = null;
        }
    };

    var rename = function (event) {
        ASC.Files.ServiceManager.renameFile(ASC.Files.ServiceManager.events.FileRename,
            {
                fileId: ASC.Files.Editor.docServiceParams.fileId,
                newname: event.data,
            });
    };

    var metaChange = function (event) {
        if (event && event.data) {
            ASC.Files.Editor.configurationParams.document.title = event.data.title;

            document.title = ASC.Files.Editor.configurationParams.document.title + (docIsChanged ? " *" : "");
        }
    };

    var reloadPage = function () {
        location.reload(true);
    };

    var trackEdit = function () {
        clearTimeout(trackEditTimeout);
        trackEditTimeout = null;
        if (ASC.Files.Editor.docServiceParams.editByUrl || ASC.Files.Editor.docServiceParams.thirdPartyApp) {
            return;
        }
        if (!doStartEdit) {
            return;
        }

        ASC.Files.ServiceManager.trackEditFile(ASC.Files.ServiceManager.events.TrackEditFile,
            {
                fileID: ASC.Files.Editor.docServiceParams.fileId,
                tabId: ASC.Files.Editor.docServiceParams.tabId,
                docKeyForTrack: ASC.Files.Editor.docServiceParams.docKeyForTrack,
                shareLinkParam: ASC.Files.Editor.docServiceParams.shareLinkParam,
            });
    };

    var finishEdit = function () {
        if (trackEditTimeout !== null && doStartEdit) {
            clearTimeout(trackEditTimeout);
            trackEditTimeout = null;
            ASC.Files.ServiceManager.trackEditFile("FinishTrackEditFile",
                {
                    fileID: ASC.Files.Editor.docServiceParams.fileId,
                    tabId: ASC.Files.Editor.docServiceParams.tabId,
                    docKeyForTrack: ASC.Files.Editor.docServiceParams.docKeyForTrack,
                    shareLinkParam: ASC.Files.Editor.docServiceParams.shareLinkParam,
                    finish: true,
                    ajaxsync: true
                });
        }
    };

    var completeTrack = function (jsonData, params, errorMessage) {
        clearTimeout(trackEditTimeout);
        trackEditTimeout = null;
        if (typeof errorMessage != "undefined") {
            if (errorMessage == null || !errorMessage.length) {
                setTimeout(function () {
                    ASC.Files.Editor.docEditor.showMessage("Connection is lost");
                }, 500);
            } else {
                ASC.Files.Editor.docEditor.showMessage(errorMessage || "Connection is lost");
            }
            return;
        }

        if (jsonData.key == true) {
            trackEditTimeout = setTimeout(ASC.Files.Editor.trackEdit, 5000);
        } else {
            errorMessage = jsonData.value;
            denyEditingRights(errorMessage);
        }
    };

    var onStartEdit = function (jsonData, params, errorMessage) {
        if (typeof errorMessage != "undefined") {
            denyEditingRights(errorMessage);
            return;
        }
    };

    var denyEditingRights = function (message) {
        ASC.Files.Editor.docEditor.denyEditingRights(message || "Connection is lost");
    };

    var checkMessageFromHash = function () {
        var regExpError = /^#error\/(\S+)?/;
        if (regExpError.test(location.hash)) {
            var errorMessage = regExpError.exec(location.hash)[1];
            errorMessage = decodeURIComponent(errorMessage).replace(/\+/g, " ");
            if (errorMessage.length) {
                ASC.Files.Editor.docEditor.showMessage(errorMessage);
                return true;
            }
        }
        var regExpMessage = /^#message\/(\S+)?/;
        if (regExpMessage.test(location.hash)) {
            errorMessage = regExpMessage.exec(location.hash)[1];
            errorMessage = decodeURIComponent(errorMessage).replace(/\+/g, " ");
            if (errorMessage.length) {
                ASC.Files.Editor.docEditor.showMessage(errorMessage);
                return true;
            }
        }
        return false;
    };

    var getRecentList = function () {
        if (!localStorageManager.isAvailable) {
            return null;
        }
        var localStorageKey = ASC.Files.Constants.storageKeyRecent;
        var localStorageCount = 50;
        var recentCount = 10;

        var result = new Array();

        try {
            var recordsFromStorage = localStorageManager.getItem(localStorageKey);
            if (!recordsFromStorage) {
                recordsFromStorage = new Array();
            }

            if (recordsFromStorage.length > localStorageCount) {
                recordsFromStorage.pop();
            }

            var currentRecord = {
                url: location.href,
                id: ASC.Files.Editor.docServiceParams.fileId,
                title: ASC.Files.Editor.configurationParams.document.title,
                folder: ASC.Files.Editor.configurationParams.document.info.folder,
                fileType: ASC.Files.Editor.configurationParams.documentType,
            };

            var containRecord = jq(recordsFromStorage).is(function () {
                return this.id == currentRecord.id;
            });

            if (!containRecord) {
                recordsFromStorage.unshift(currentRecord);

                localStorageManager.setItem(localStorageKey, recordsFromStorage);
            }

            result = jq(recordsFromStorage).filter(function () {
                return this.id != currentRecord.id &&
                    this.fileType === currentRecord.fileType;
            });
        } catch (e) {
        }

        return result.slice(0, recentCount);
    };

    var completeGetEditHistory = function (jsonData, params, errorMessage) {
        if (typeof ASC.Files.Editor.docEditor.refreshHistory != "function") {
            if (typeof errorMessage != "undefined") {
                ASC.Files.Editor.docEditor.showMessage(errorMessage || "Connection is lost");
            } else {
                ASC.Files.Editor.docEditor.showMessage("Function is not available");
            }
            return;
        }

        if (typeof errorMessage != "undefined") {
            var data = {
                error: errorMessage || "Connection is lost"
            };
        } else {
            clearTimeout(trackEditTimeout);
            trackEditTimeout = null;

            var currentVersion = params.setLast
                ? jsonData.length
                : ASC.Files.Editor.docServiceParams.fileVersion;

            data = {
                currentVersion: currentVersion,
                history: jsonData,
            };
        }

        ASC.Files.Editor.docEditor.refreshHistory(data);
    };

    var completeGetDiffUrl = function (jsonData, params, errorMessage) {
        if (typeof ASC.Files.Editor.docEditor.setHistoryData != "function") {
            if (typeof errorMessage != "undefined") {
                ASC.Files.Editor.docEditor.showMessage(errorMessage || "Connection is lost");
            } else {
                ASC.Files.Editor.docEditor.showMessage("Function is not available");
            }
            return;
        }

        if (typeof errorMessage != "undefined") {
            jsonData = {
                error: errorMessage || "Connection is lost",
                version: params.version,
            };
        }

        ASC.Files.Editor.docEditor.setHistoryData(jsonData);
    };

    var completeGetMails = function (jsonData, params, errorMessage) {
        if (typeof ASC.Files.Editor.docEditor.setEmailAddresses != "function") {
            if (typeof errorMessage != "undefined") {
                ASC.Files.Editor.docEditor.showMessage(errorMessage || "Connection is lost");
            } else {
                ASC.Files.Editor.docEditor.showMessage("Function is not available");
            }
            return;
        }

        if (typeof errorMessage != "undefined") {
            var data = {
                error: errorMessage || "Connection is lost",
            };
        } else {
            data = {
                emailAddresses: jsonData,
            };
        }

        if (ASC.Files.Constants.URL_MAIL_ACCOUNTS) {
            data.createEmailAccountUrl = ASC.Files.Constants.URL_MAIL_ACCOUNTS;
        }

        ASC.Files.Editor.docEditor.setEmailAddresses(data);
    };

    var completeStartMailMerge = function (jsonData, params, errorMessage) {
        if (typeof ASC.Files.Editor.docEditor.processMailMerge != "function") {
            if (typeof errorMessage != "undefined") {
                ASC.Files.Editor.docEditor.showMessage(errorMessage || "Connection is lost");
            } else {
                ASC.Files.Editor.docEditor.showMessage("Function is not available");
            }
            return;
        }

        ASC.Files.Editor.docEditor.processMailMerge(typeof errorMessage == "undefined", errorMessage);
    };

    var completeRename = function (xmlData, params, errorMessage) {
        if (typeof errorMessage != "undefined") {
            ASC.Files.Editor.docEditor.showMessage(errorMessage || "Connection is lost");
        }
        return;
    };

    return {
        init: init,
        createFrameEditor: createFrameEditor,
        fixSize: fixSize,

        docEditor: docEditor,

        //set in .cs
        docServiceParams: docServiceParams,
        configurationParams: configurationParams,

        trackEdit: trackEdit,
        finishEdit: finishEdit,

        //event
        readyEditor: readyEditor,
        documentStateChangeEditor: documentStateChangeEditor,
        requestEditRightsEditor: requestEditRightsEditor,
        errorEditor: errorEditor,
        reloadPage: reloadPage,
        requestHistory: requestHistory,
        getDiffUrl: getDiffUrl,
        restoreVersion: restoreVersion,
        getMails: getMails,
        requestStartMailMerge: requestStartMailMerge,
        infoEditor: infoEditor,
        rename: rename,
        metaChange: metaChange,

        canShowHistory: canShowHistory,
    };
})();

(function ($) {

    if (jq("#iframeEditor").length == 0)
        return;

    ASC.Files.Editor.init();
    $(function () {
        if (typeof DocsAPI === "undefined") {
            alert("ONLYOFFICE™ is not available. Please contact us at support@onlyoffice.com");
            ASC.Files.Editor.errorEditor();

            return;
        }

        var fixPageCaching = function (delta) {
            if (location.hash.indexOf("reload") == -1) {
                var openingDateParse = Date.parse(ASC.Files.Editor.docServiceParams.openinigDate);
                if (!openingDateParse) {
                    return;
                }
                var openinigDate = new Date();
                openinigDate.setTime(openingDateParse);

                var currentTime = new Date();
                var currentUTCTime = new Date(currentTime.getUTCFullYear(), currentTime.getUTCMonth(), currentTime.getUTCDate(), currentTime.getUTCHours(), currentTime.getUTCMinutes());
                if (Math.abs(currentUTCTime - openinigDate) > delta) {
                    location.hash = "reload";
                    location.reload(true);
                }
            } else {
                location.hash = "";
            }
        };
        fixPageCaching(10 * 60 * 1000);

        var $icon = jq("#docsEditorFavicon");
        if ($icon.attr('href').indexOf('logo_favicon_general.ico') !== -1) { //not default
            $icon.attr('href', $icon.attr('href'));
        }

        ASC.Files.Editor.createFrameEditor(ASC.Files.Editor.configurationParams);

        if (jq("body").hasClass("mobile") || ASC.Files.Editor.configurationParams && ASC.Files.Editor.configurationParams.type === "mobile") {
            if (window.addEventListener) {
                window.addEventListener("load", ASC.Files.Editor.fixSize);
                window.addEventListener("resize", ASC.Files.Editor.fixSize);
            } else if (window.attachEvent) {
                window.attachEvent("onload", ASC.Files.Editor.fixSize);
                window.attachEvent("onresize", ASC.Files.Editor.fixSize);
            }
        }
    });
})(jQuery);

String.prototype.format = function () {
    var txt = this,
        i = arguments.length;

    while (i--) {
        txt = txt.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return txt;
};