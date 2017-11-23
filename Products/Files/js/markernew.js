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


window.ASC.Files.Marker = (function () {
    var isInit = false;

    var init = function () {
        if (isInit === false) {
            isInit = true;

            ASC.Files.ServiceManager.bind(ASC.Files.ServiceManager.events.MarkAsRead, ASC.Files.EventHandler.onGetTasksStatuses);

            ASC.Files.ServiceManager.bind(ASC.Files.ServiceManager.events.GetNews, ASC.Files.Marker.onGetNews);

            jq(document).click(function (event) {
                jq.dropdownToggle().registerAutoHide(event, ".is-new", "#filesNewsPanel");
            });
        }
    };

    var markRootAsNew = function (xmlData) {
        if (typeof xmlData == "undefined" || xmlData == null) {
            return false;
        }

        jq("#studio_sidePanel .page-menu .is-new").hide();

        jq(xmlData.childNodes).each(function (i, childNode) {
            var xmlKey = childNode.childNodes[0];
            var xmlValue = childNode.childNodes[1];
            var folderId = xmlKey.textContent || xmlKey.text;
            var valueNew = xmlValue.textContent || xmlValue.text;
            if (valueNew > 0) {
                jq("#studio_sidePanel .page-menu .is-new" + ASC.Files.UI.getSelectorId(folderId)).text(valueNew).show();
            }
        });

        return true;
    };

    var removeNewIcon = function (entryType, entryId) {
        return ASC.Files.Marker.setNewCount(entryType, entryId, 0);
    };

    var setNewCount = function (entryType, entryId, countNew) {
        var result = false;

        var isUpdate = (countNew | 0) > 0;
        var newsObj = ASC.Files.UI.getEntryObject(entryType, entryId).find(".is-new");
        if (newsObj.is(":visible")) {
            var diffCount = (entryType == "file"
                ? -Math.pow(-1, countNew)
                : countNew - (newsObj.html() | 0));

            var rootId = ASC.Files.Tree.pathParts[0];
            var rootObj = jq("#studio_sidePanel .page-menu .is-new" + ASC.Files.UI.getSelectorId(rootId));
            var prevCount = rootObj.html() | 0;
            var rootCountNew = prevCount + diffCount;

            rootObj.html(rootCountNew > 0 ? rootCountNew : 0);
            if (rootCountNew > 0) {
                rootObj.show();
            } else {
                rootObj.hide();
            }

            if (isUpdate) {
                if (entryType == "folder") {
                    newsObj.html(countNew);
                }
            } else {
                newsObj.remove();
            }
            result = true;
        }

        if (entryType === "folder") {
            newsObj = jq("#studio_sidePanel .page-menu .is-new" + ASC.Files.UI.getSelectorId(entryId));
            if (newsObj.is(":visible")) {
                newsObj.html(countNew > 0 ? countNew : 0);
                if (isUpdate) {
                    newsObj.show();
                } else {
                    newsObj.hide();

                    if (jq.inArray(entryId + "", ASC.Files.Tree.pathParts) != -1) {
                        jq("#filesMainContent .is-new").remove();
                    }
                }
                result = true;
            }
        }

        return result;
    };

    //request

    var markAsRead = function (event) {
        var itemData;

        var data = {};
        data.entry = new Array();

        if (typeof event == "undefined") {
            jq("#filesMainContent .file-row:not(.checkloading):not(.new-folder):not(.new-file):has(.checkbox input:checked)").each(function () {
                itemData = ASC.Files.UI.getObjectData(this);

                if (itemData.entryObject.find(".is-new").length > 0) {
                    data.entry.push(itemData.entryType + "_" + itemData.entryId);
                }
            });
        } else if (typeof event == "object") {
            itemData = event;

            data.entry.push(itemData.entryType + "_" + itemData.entryId);
        } else if (ASC.Files.Common.isCorrectId(event)) {
            data.entry.push("folder_" + event);
        }

        if (data.entry.length == 0) {
            return false;
        }

        ASC.Files.ServiceManager.markAsRead(
            ASC.Files.ServiceManager.events.MarkAsRead,
            { list: data.entry, doNow: true },
            { stringList: data });

        return false;
    };

    var getNews = function (target, folderId) {
        ASC.Files.Actions.hideAllActionPanels();

        if (!ASC.Files.Common.isCorrectId(folderId)) {
            var itemData = ASC.Files.UI.getObjectData(target);

            if (itemData.entryType == "file") {
                ASC.Files.Marker.markAsRead(itemData);
                return;
            }

            folderId = itemData.entryId;
        }

        //track event

        trackingGoogleAnalitics("documents", "shownews", "folder");

        var targetSize = {
            top: target.offset().top,
            left: target.offset().left,
            width: target.width(),
            height: target.height()
        };

        ASC.Files.ServiceManager.getNews(ASC.Files.ServiceManager.events.GetNews, { folderId: folderId, targetSize: targetSize, showLoading: true });
    };

    //event handler

    var onMarkAsRead = function (listData) {
        jq("#studio_sidePanel .page-menu .is-new").hide();

        for (var i = 0; i < listData.length; i++) {
            var curItem = ASC.Files.UI.parseItemId(listData[i]);
            if (curItem == null) {
                if (listData[i].indexOf("new_") == 0) {
                    var itemDataStr = listData[i].substring(("new_").length).replace(/\?/g, ":");
                    var itemData = JSON.parse(itemDataStr);
                    var folderId = itemData.key;
                    var valueNew = itemData.value;
                    if (valueNew > 0) {
                        jq("#studio_sidePanel .page-menu .is-new" + ASC.Files.UI.getSelectorId(folderId)).text(valueNew).show();
                    }
                }
                continue;
            }
            var entryType = curItem.entryType;
            var entryId = curItem.entryId;

            ASC.Files.UI.blockObjectById(curItem.entryType, curItem.entryId, false, null, true);
            ASC.Files.Marker.removeNewIcon(entryType, entryId);

            if (entryType == "folder" && jq.inArray(entryId + "", ASC.Files.Tree.pathParts) != -1) {
                jq("#filesMainContent .is-new").remove();
            }
        }

        ASC.Files.UI.updateMainContentHeader();
        ASC.Files.Actions.showActionsViewPanel();
    };

    var onGetNews = function (xmlData, params, errorMessage) {
        if (typeof errorMessage != "undefined") {
            ASC.Files.UI.displayInfoPanel(errorMessage, true);
            return;
        }

        var htmlData = ASC.Files.TemplateManager.translate(xmlData);

        if (htmlData.length) {
            jq("#filesNewsList").html(htmlData);

            jq("#filesNewsList .file-row").each(function () {
                var entryData = ASC.Files.UI.getObjectData(this);

                var entryId = entryData.entryId;
                var entryType = entryData.entryType;
                var entryObj = entryData.entryObject;
                var entryTitle = entryData.title;

                var ftClass = (entryType == "file" ? ASC.Files.Utility.getCssClassByFileTitle(entryTitle, true) : ASC.Files.Utility.getFolderCssClass(true));
                entryObj.find(".thumb-" + entryType).addClass(ftClass);

                var rowLink = entryObj.find(".entry-title .name a");

                if (entryType == "file" && rowLink.is(":not(:has(.file-extension))")) {
                    ASC.Files.UI.highlightExtension(rowLink, entryTitle);
                }

                var entryUrl = ASC.Files.UI.getEntryLink(entryType, entryId, entryTitle);
                rowLink.attr("href", entryUrl).attr("target", "_blank");
            });

            var targetSize = params.targetSize;
            jq("#filesNewsPanel").css(
                {
                    "top": targetSize.top + targetSize.height,
                    "left": targetSize.left
                })
                .toggle()
                .attr("data-id", params.folderId);

            var countNew = jq("#filesNewsList .file-row").length;
            ASC.Files.Marker.setNewCount("folder", params.folderId, countNew);
        } else {
            ASC.Files.Marker.removeNewIcon("folder", params.folderId);
        }
    };

    return {
        init: init,

        removeNewIcon: removeNewIcon,
        setNewCount: setNewCount,

        markAsRead: markAsRead,
        markRootAsNew: markRootAsNew,

        getNews: getNews,

        onMarkAsRead: onMarkAsRead,
        onGetNews: onGetNews
    };
})();

(function ($) {
    $(function () {
        ASC.Files.Marker.init();

        jq(document).on("click", ".is-new", function () {
            var target = jq(this);
            var folderId = target.attr("data-id");
            ASC.Files.Marker.getNews(target, folderId);
            return false;
        });

        jq("#mainMarkRead").click(function () {
            ASC.Files.Actions.hideAllActionPanels();
            ASC.Files.Marker.markAsRead();
        });

        jq("#filesNewsMarkRead").click(function () {
            ASC.Files.Actions.hideAllActionPanels();
            var folderId = jq("#filesNewsPanel").attr("data-id");
            ASC.Files.Marker.markAsRead(folderId);
        });

        jq("#filesNewsList").on("click", ".folder-row:not(.error-entry) .entry-title .name a, .folder-row:not(.error-entry) .thumb-folder", function () {
            ASC.Files.Actions.hideAllActionPanels();
            var folderId = ASC.Files.UI.getObjectData(this).id;
            ASC.Files.Folders.clickOnFolder(folderId);
            return false;
        });

        jq("#filesNewsList").on("click", ".file-row:not(.folder-row):not(.error-entry) .entry-title .name a, .file-row:not(.folder-row):not(.error-entry) .thumb-file", function () {
            //ASC.Files.Actions.hideAllActionPanels();
            var fileData = ASC.Files.UI.getObjectData(this);
            var updated = ASC.Files.Folders.clickOnFile(fileData);

            if (!updated) {
                var newFolderId = jq("#filesNewsPanel").attr("data-id");
                var newObj = jq(".is-new" + ASC.Files.UI.getSelectorId(newFolderId));
                if (!newObj.is(":visible")) {
                    newObj = ASC.Files.UI.getEntryObject("folder", newFolderId).find(".is-new");
                }
                var prevCount = newObj.html() | 0;
                ASC.Files.Marker.setNewCount("folder", newFolderId, prevCount - 1);
            }

            return false;
        });

        jq("#studio_sidePanel .page-menu .is-new").trackEvent("files_tree", "action-click", "mark_as_read");
    });
})(jQuery);