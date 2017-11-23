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


window.ASC.Files.EmptyScreen = (function () {
    var isInit = false;

    var init = function () {
        if (isInit === false) {
            isInit = true;
        }
        jq.dropdownToggle({
            switcherSelector: "#emptyContainer .hintCreate",
            dropdownID: "hintCreatePanel",
            fixWinSize: false
        });

        jq.dropdownToggle({
            switcherSelector: "#emptyContainer .hintUpload",
            dropdownID: "hintUploadPanel",
            fixWinSize: false
        });

        jq.dropdownToggle({
            switcherSelector: "#emptyContainer .hintOpen",
            dropdownID: "hintOpenPanel",
            fixWinSize: false
        });

        jq.dropdownToggle({
            switcherSelector: "#emptyContainer .hintEdit",
            dropdownID: "hintEditPanel",
            fixWinSize: false
        });
    };

    var displayEmptyScreen = function () {
        ASC.Files.UI.hideAllContent(true);
        if (ASC.Files.Mouse) {
            ASC.Files.Mouse.finishMoveTo();
            ASC.Files.Mouse.finishSelecting();
        }

        jq("#filesMainContent, #switchViewFolder, #mainContentHeader, #pageNavigatorHolder, .folder-row-toparent").hide();
        jq("#emptyContainer > div").hide();

        if (!ASC.Files.Filter || ASC.Files.Filter.getFilterSettings().filter == 0 && ASC.Files.Filter.getFilterSettings().text == "") {
            jq(".files-filter").hide();

            jq("#emptyContainer .empty-folder-create").toggle(ASC.Files.UI.accessEdit());

            jq("#emptyContainer_" + ASC.Files.Folders.folderContainer).show();

            ASC.Files.UI.checkButtonBack(".empty-folder-toparent");
        } else {
            jq("#emptyContainer_filter").show();
        }

        jq("#emptyContainer").show();
        ASC.Files.UI.stickContentHeader();
    };

    var hideEmptyScreen = function () {
        if (jq("#filesMainContent").is(":visible")) {
            return;
        }
        ASC.Files.UI.hideAllContent(true);
        if (ASC.Files.Mouse) {
            ASC.Files.Mouse.finishMoveTo();
            ASC.Files.Mouse.finishSelecting();
        }

        jq("#emptyContainer").hide();

        ASC.Files.UI.checkButtonBack(".to-parent-folder", ".folder-row-toparent");

        jq(".files-filter").show();
        if (ASC.Files.Filter) {
            ASC.Files.Filter.resize();
        }

        jq("#filesMainContent, #switchViewFolder, #mainContentHeader").show();
        ASC.Files.UI.stickContentHeader();
    };

    return {
        init: init,

        hideEmptyScreen: hideEmptyScreen,
        displayEmptyScreen: displayEmptyScreen
    };
})();

(function ($) {

    if (jq("#hintCreatePanel").length == 0)
        return;

    ASC.Files.EmptyScreen.init();
    $(function () {
    });
})(jQuery);