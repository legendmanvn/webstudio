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


window.TMMail = (function($) {
    var isInit = false,
        requiredFieldErrorCss = "requiredFieldError",
        options = {
            MessagesPageSize: 25,
            ContactsPageSize: 25,
            ConversationSortAsc: "true"
        },
        saveMessageInterval = 5000, // 5 seconds for autosave
        showNextAlertTimeout = 60000,
        constants = {
            pageTitle: '',
            pageHeader: ''
        },

        optionCookieName = 'tmmail',
        optionSeparator = '&',
        maxWordLength = 10, //like google
        systemFolders = {
            inbox: { id: 1, name: 'inbox', displayName: ASC.Mail.Resources.MailResource.FolderNameInbox },
            sent: { id: 2, name: 'sent', displayName: ASC.Mail.Resources.MailResource.FolderNameSent },
            drafts: { id: 3, name: 'drafts', displayName: ASC.Mail.Resources.MailResource.FolderNameDrafts },
            trash: { id: 4, name: 'trash', displayName: ASC.Mail.Resources.MailResource.FolderNameTrash },
            spam: { id: 5, name: 'spam', displayName: ASC.Mail.Resources.MailResource.FolderNameSpam }
        },
        actionTypes = {
            'move': 1,
            'restore': 2,
            'delete_messages': 3,
            'clear_folder': 4,
            'move_filtered': 5,
            'restore_filtered': 6,
            'delete_filtered': 7
        },
        anchorRegExp = {
            sysfolders: /^$|^(inbox|sent|drafts|trash|spam)\/?(.+)*/,

            inbox: /^$|^inbox\/?(.+)*/,
            sent: /^sent\/?(.+)*/,
            drafts: /^drafts\/?(.+)*/,
            trash: /^trash\/?(.+)*/,
            spam: /^spam\/?(.+)*/,

            reply: /^reply\/(\d+)\/?$/,
            forward: /^forward\/(\d+)\/?$/,
            compose: /^compose\/?$/,
            composeto: /^composeto\/?(.+)*/,
            replyAll: /^replyAll\/(\d+)$/,
            writemessage: /^(compose|composeto|draftitem|forward|reply|replyAll)\/?(.+)*/,
            viewmessage: /^(message|conversation)\/?(.+)*/,

            message: /^message\/(\d+)\/?$/,
            next_message: /^message\/(\d+)\/next\/?$/,
            prev_message: /^message\/(\d+)\/prev\/?$/,

            conversation: /^conversation\/(\d+)\/?$/,
            next_conversation: /^conversation\/(\d+)\/next\/?$/,
            prev_conversation: /^conversation\/(\d+)\/prev\/?$/,

            draftitem: /^draftitem\/(\d+)\/?$/,

            accounts: /^accounts\/?$/,
            tags: /^tags\/?$/,
            administration: /^administration\/?$/,
            commonSettings: /^common\/?$/,

            teamlab: /^tlcontact\/?(.+)*/,
            crm: /^crmcontact\/?(.+)*/,
            personal_contact: /^customcontact\/?(.+)*/,
            helpcenter: /^help(?:=(\d+))?/,

            common: /(.+)*/,

            messagePrint: /^message\/print\/(\d+)\/?(.+)*/,
            conversationPrint: /^conversation\/print\/(\d+)\/?(.+)*/
        },
        providerRegExp = {
            gmail: /@(gmail\.com|google\.com|googlemail\.com)/,
            outlook: /@(hotmail\.com|hotmail\.co\.jp|hotmail\.co\.uk|hotmail\.com\.br|hotmail\.de|hotmail\.es|hotmail\.fr|hotmail\.it|live\.com|live\.co\.jp|live\.de|live\.fr|live\.it|live\.jp|live\.ru|live\.co\.uk|msn\.com|outlook\.com)/,
            yahoo: /@(yahoo\.com|yahoo\.com\.ar|yahoo\.com\.au|yahoo\.com\.br|yahoo\.com\.mx|yahoo\.co\.nz|yahoo\.co\.uk|yahoo\.de|yahoo\.es|yahoo\.fr|yahoo\.it|ymail\.com)/,
            mailru: /@(mail\.ru|bk\.ru|inbox\.ru|list\.ru)/,
            yandex: /@(yandex\.ru|yandex\.com|yandex\.ua|yandex\.com\.tr|yandex\.kz|yandex\.by|yandex\.net|ya\.ru|narod\.ru)/,
            rambler: /@(rambler\.ru|lenta\.ru|autorambler\.ru|myrambler\.ru|r0\.ru|ro\.ru)/,
            qip: /@(qip\.ru|5ballov\.ru|aeterna\.ru|fotoplenka\.ru|fromru\.com|front\.ru|hotbox\.ru|hotmail\.ru|krovatka\.su|land\.ru|mail15\.com|mail333\.com|memori\.ru|newmail\.ru|nightmail\.ru|nm\.ru|photofile\.ru|pisem\.net|pochta\.ru|pochtamt\.ru|pop3\.ru|rbcmail\.ru|smtp\.ru|ziza\.ru)/,
        };

    function init() {
        if (isInit === true) {
            return;
        }

        isInit = true;
        loadOptions();

        serviceManager.init();

        constants.pageTitle = document.title;
        constants.pageHeader = ASC.Mail.Resources.MailResource.MailTitle || 'Mail';

        ASC.Controls.AnchorController.bind(TMMail.anchors.common, checkAnchor);
    }

    function setPageHeaderFolderName(folderId) {
        // ToDo: fix this workaround for 'undefined' in title
        // case: open conversation by direct link, and 'undefined' word will appear in page title
        if (0 == folderId) {
            return;
        }

        var unread = $('#foldersContainer').children('[folderid=' + folderId + ']').attr('unread');

        var title = (unread == 0 || unread == undefined ? "" : ('(' + unread + ') ')) + getSysFolderDisplayNameById(folderId);

        setPageHeaderTitle(title);
    }

    function setPageHeaderTitle(title) {
        title = "{0} - {1}".format(title, constants.pageTitle);

        if ($.browser.msie) {
            setImmediate(function() {
                document.title = title;
            });
        } else {
            document.title = title;
        }
    }

    function option(name, value) {
        if (typeof name !== 'string') {
            return undefined;
        }
        if (typeof value === 'undefined') {
            return options[name];
        }
        options[name] = value;
        saveOptions();
        return value;
    }

    function loadOptions() {
        var fieldSeparator = ':',
            pos,
            name,
            value,
            collect = ASC.Mail.cookies.get(optionCookieName).split(optionSeparator);

        for (var i = 0, n = collect.length; i < n; i++) {
            if ((pos = collect[i].indexOf(fieldSeparator)) === -1) {
                continue;
            }
            name = collect[i].substring(0, pos);
            value = collect[i].substring(pos + 1);
            if (!name.length) {
                continue;
            }
            options[name] = value;
        }
    }

    function saveOptions() {
        var fieldSeparator = ':',
            collect = [];
        for (var name in options) {
            if (options.hasOwnProperty(name)) {
                collect.push(name + fieldSeparator + options[name]);
            }
        }
        ASC.Mail.cookies.set(optionCookieName, collect.join(optionSeparator));
    }

    function ltgt(str) {
        if (str.indexOf('<') !== false || str.indexOf('>') !== false) {
            str = str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        return str;
    }

    function inArray(needle, haystack, strict) {
        strict = !!strict;
        var found = false, key;
        for (key in haystack) {
            if ((strict && haystack[key] === needle) || (!strict && haystack[key] == needle)) {
                found = true;
                break;
            }
        }
        return found;
    }

    function getErrorMessage(errors) {
        if ($.isArray(errors) && errors.length === 1) {
            return errors[0];
        }

        var mes = [];
        mes.push('<ul class="errors">');
        for (var i = 0, n = errors.length; i < n; i++) {
            mes.push('<li class="error-message">' + errors[i] + '</li>');
        }
        mes.push('</ul>');
        return mes.join('');
    }

    function isInvalidPage() {
        var anchor = ASC.Controls.AnchorController.getAnchor();
        return !(anchorRegExp.message.test(anchor) || anchorRegExp.accounts.test(anchor) || anchorRegExp.teamlab.test(anchor) ||
            anchorRegExp.crm.test(anchor) || anchorRegExp.sysfolders.test(anchor) || anchorRegExp.writemessage.test(anchor) ||
            anchorRegExp.tags.test(anchor) || anchorRegExp.conversation.test(anchor) || anchorRegExp.helpcenter.test(anchor) ||
            anchorRegExp.next_message.test(anchor) || anchorRegExp.prev_message.test(anchor) || anchorRegExp.next_conversation.test(anchor) ||
            anchorRegExp.prev_conversation.test(anchor) || anchorRegExp.administration.test(anchor) || anchorRegExp.commonSettings.test(anchor) ||
            anchorRegExp.messagePrint.test(anchor) || anchorRegExp.conversationPrint.test(anchor) || anchorRegExp.personal_contact.test(anchor));
    }

    function pageIs(pageType) {
        var anchor = ASC.Controls.AnchorController.getAnchor();
        switch (pageType) {
            case 'message':
                if (anchorRegExp.message.test(anchor)) {
                    return true;
                }
                break;
            case 'inbox':
                if (anchorRegExp.inbox.test(anchor) || anchor == '') {
                    return true;
                }
                break;
            case 'sent':
                if (anchorRegExp.sent.test(anchor)) {
                    return true;
                }
                break;
            case 'drafts':
                if (anchorRegExp.drafts.test(anchor)) {
                    return true;
                }
                break;
            case 'trash':
                if (anchorRegExp.trash.test(anchor)) {
                    return true;
                }
                break;
            case 'spam':
                if (anchorRegExp.spam.test(anchor)) {
                    return true;
                }
                break;
            case 'compose':
                if (anchorRegExp.compose.test(anchor)) {
                    return true;
                }
                break;
            case 'composeto':
                if (anchorRegExp.composeto.test(anchor)) {
                    return true;
                }
                break;
            case 'draftitem':
                if (anchorRegExp.draftitem.test(anchor)) {
                    return true;
                }
                break;
            case 'reply':
                if (anchorRegExp.reply.test(anchor)) {
                    return true;
                }
                break;
            case 'forward':
                if (anchorRegExp.forward.test(anchor)) {
                    return true;
                }
                break;
            case 'accounts':
                if (anchorRegExp.accounts.test(anchor)) {
                    return true;
                }
                break;
            case 'tlContact':
                if (anchorRegExp.teamlab.test(anchor)) {
                    return true;
                }
                break;
            case 'crmContact':
                if (anchorRegExp.crm.test(anchor)) {
                    return true;
                }
                break;
            case 'personalContact':
                if (anchorRegExp.personal_contact.test(anchor)) {
                    return true;
                }
                break;
            case 'sysfolders':
                if (anchorRegExp.sysfolders.test(anchor) || anchor == '') {
                    return true;
                }
                break;
            case 'writemessage':
                if (anchorRegExp.writemessage.test(anchor)) {
                    return true;
                }
                break;
            case 'viewmessage':
                if (anchorRegExp.viewmessage.test(anchor)) {
                    return true;
                }
                break;
            case 'tags':
                if (anchorRegExp.tags.test(anchor)) {
                    return true;
                }
                break;
            case 'administration':
                if (anchorRegExp.administration.test(anchor)) {
                    return true;
                }
                break;
            case 'common':
                if (anchorRegExp.commonSettings.test(anchor)) {
                    return true;
                }
                break;
            case 'conversation':
                if (anchorRegExp.conversation.test(anchor)) {
                    return true;
                }
                break;
            case 'helpcenter':
                if (anchorRegExp.helpcenter.test(anchor)) {
                    return true;
                }
            case 'messagePrint':
                if (anchorRegExp.messagePrint.test(anchor)) {
                    return true;
                }
            case 'conversationPrint':
                if (anchorRegExp.conversationPrint.test(anchor)) {
                    return true;
                }
            case 'print':
                if (anchorRegExp.messagePrint.test(anchor) || anchorRegExp.conversationPrint.test(anchor)) {
                    return true;
                }
                break;
        }
        return false;
    }

    function getSysFolderNameById(sysfolderId, defaultValue) {
        var sysfolder = getSysFolderById(sysfolderId);
        return typeof sysfolder != 'undefined' && sysfolder ? sysfolder.name : defaultValue;
    }

    function getSysFolderDisplayNameById(sysfolderId, defaultValue) {
        var sysfolder = getSysFolderById(sysfolderId);
        return typeof sysfolder != 'undefined' && sysfolder ? sysfolder.displayName : defaultValue;
    }

    function getSysFolderIdByName(sysfolderName, defaultValue) {
        for (var sysfolderNameIn in systemFolders) {
            var sysfolder = systemFolders[sysfolderNameIn];
            if (sysfolder.name == sysfolderName) {
                return sysfolder.id;
            }
        }
        return defaultValue;
    }

    // private
    function getSysFolderById(sysfolderId) {
        for (var sysfolderName in systemFolders) {
            var sysfolder = systemFolders[sysfolderName];
            if (sysfolder.id == +sysfolderId) {
                return sysfolder;
            }
        }
        return undefined;
    }

    function extractFolderIdFromAnchor() {
        var anchor = ASC.Controls.AnchorController.getAnchor();
        if (anchor === "") {
            return systemFolders.inbox.id;
        }
        var sysfolderRes = anchorRegExp.sysfolders.exec(anchor);
        if (sysfolderRes != null) {
            return getSysFolderIdByName(sysfolderRes[1]);
        }
        return 0;
    }

    function extractConversationIdFromAnchor() {
        var anchor = ASC.Controls.AnchorController.getAnchor();

        if (anchor !== "") {
            var conversationId = anchorRegExp.conversation.exec(anchor);
            if (conversationId != null) {
                return conversationId[1];
            }
        }

        return 0;
    }

    function getAccountErrorFooter(address) {
        return window.MailScriptResource.AccountCreationErrorGmailFooter
            .format('<a target="blank" class="linkDescribe" href="' + getFaqLink(address) + '">', '</a>');
    }

    function getSupportLink() {
        return ASC.Mail.Constants.SUPPORT_URL;
    }

    function getFaqLink(address) {
        address = (address || "").toLowerCase();

        var anchor = "";

        if (providerRegExp.gmail.test(address)) {
            anchor = "#IssueswithGmailcomService_block";
        }
        else if (providerRegExp.outlook.test(address) || providerRegExp.yahoo.test(address)) {
            anchor = "#IssueswithHotmailcomandYahoocomServices_block";
        }
        else if (providerRegExp.mailru.test(address)) {
            anchor = "#IssueswithMailruService_block";
        }
        else if (providerRegExp.yandex.test(address)) {
            anchor = "#IssueswithYandexruService_block";
        }

        return ASC.Mail.Constants.FAQ_URL + anchor;
    }

    function getOAuthFaqLink() {
        return ASC.Mail.Constants.FAQ_URL + "#GmailcomService_12";
    }

    function moveToReply(msgid) {
        ASC.Controls.AnchorController.move('#reply/' + msgid);
    }

    function moveToReplyAll(msgid) {
        ASC.Controls.AnchorController.move('#replyAll/' + msgid);
    }

    function moveToForward(msgid) {
        ASC.Controls.AnchorController.move('#forward/' + msgid);
    }

    function moveToMessagePrint(messageId, showImages, showQuotes) {
        var href = window.location.href.split('#')[0] + '?blankpage=true#message/print/' + messageId;

        if (showImages) {
            href += '?sim=' + messageId;
        }
        if (showQuotes) {
            href += showImages ? '&' : '?';
            href += 'squ=' + messageId;
        }
        
        window.open(href);
    }

    function moveToConversationPrint(conversationId, simIds, squIds, sortAsc) {
        var href = window.location.href.split('#')[0] + '?blankpage=true#conversation/print/' + conversationId;

        if (simIds && simIds.length) {
            href += '?sim=' + simIds.join(',');
        }
        if (squIds && squIds.length) {
            href += simIds && simIds.length ? '&' : '?';
            href += 'squ=' + squIds.join(',');
        }

        href += (simIds && simIds.length) || (squIds && squIds.length) ? '&' : '?';
        href += 'sortAsc=' + (sortAsc === undefined || sortAsc === true ? '1' : '0');

        window.open(href);
    }

    function moveToInbox() {
        ASC.Controls.AnchorController.move(systemFolders.inbox.name);
    }

    function openMessage(id) {
        window.open('#message/' + id, '_blank');
    }

    function openConversation(id) {
        window.open('#conversation/' + id, '_blank');
    }

    function openDraftItem(id) {
        window.open('#draftitem/' + id, '_blank');
    }

    function moveToConversation(id, safe) {
        var anchor = '#conversation/' + id;
        if (safe) {
            ASC.Controls.AnchorController.safemove(anchor);
        } else {
            ASC.Controls.AnchorController.move(anchor);
        }
    }

    function moveToMessage(id, safe) {
        var anchor = '#message/' + id;
        if (safe) {
            ASC.Controls.AnchorController.safemove(anchor);
        } else {
            ASC.Controls.AnchorController.move(anchor);
        }
    }

    function moveToDraftItem(id, safe) {
        var anchor = '#draftitem/' + id;
        if (safe) {
            ASC.Controls.AnchorController.safemove(anchor);
        } else {
            ASC.Controls.AnchorController.move(anchor);
        }
    }

    function wordWrap(string) {
        var words = string.split(' ');
        for (var i = 0; i < words.length; i++) {
            var newWord = '';
            var lastIndex = 0;
            for (var j = maxWordLength; j < words[i].length; j += maxWordLength) {
                newWord += htmlEncode(words[i].slice(j - maxWordLength, j)) + '<wbr/>';
                lastIndex = j;
            }
            if (lastIndex > 0) {
                newWord += htmlEncode(words[i].slice(lastIndex));
                words[i] = newWord;
            } else {
                words[i] = htmlEncode(words[i]);
            }
        }
        string = words.join(' ');
        return string;
    }

    function getParamsValue(params, reg) {
        var myArray = reg.exec(params);
        if (myArray === null) {
            return undefined;
        }
        return myArray[1];
    }

    function showCompleteActionHint(actionType, isConversation, count, dstFolderId) {
        var hintText;
        var folderName = TMMail.getSysFolderDisplayNameById(dstFolderId, '');
        switch (actionType) {
            case TMMail.action_types.move:
                hintText =
                    count == 1 ?
                        (isConversation ?
                            window.MailActionCompleteResource.moveOneConversationTo :
                            window.MailActionCompleteResource.moveOneMessageTo)
                            .replace('%folder%', folderName) :
                        (isConversation ?
                            window.MailActionCompleteResource.moveManyConversationsTo :
                            window.MailActionCompleteResource.moveManyMessagesTo)
                            .replace('%folder%', folderName)
                            .replace('%count%', count);
                break;
            case TMMail.action_types.restore:
                hintText =
                    count == 1 ?
                        (isConversation ?
                            window.MailActionCompleteResource.restoreOneConversationTo :
                            window.MailActionCompleteResource.restoreOneMessageTo)
                            .replace('%folder%', folderName) :
                        (isConversation ?
                            window.MailActionCompleteResource.restoreManyConversations :
                            window.MailActionCompleteResource.restoreManyMessages)
                            .replace('%count%', count);
                break;
            case TMMail.action_types.delete_messages:
                hintText =
                    count == 1 ?
                        (isConversation ?
                            window.MailActionCompleteResource.deleteOneConversation :
                            window.MailActionCompleteResource.deleteOneMessage)
                        :
                        (isConversation ?
                            window.MailActionCompleteResource.deleteManyConversations :
                            window.MailActionCompleteResource.deleteManyMessages)
                            .replace('%count%', count);
                break;
            case TMMail.action_types.clear_folder:
                hintText = window.MailActionCompleteResource.clearFolder.replace('%folder%', folderName);
                break;
            case TMMail.action_types.move_filtered:
                hintText = isConversation ?
                    window.MailActionCompleteResource.moveFilteredConversationsTo.replace('%folder%', folderName) :
                    window.MailActionCompleteResource.moveFilteredMessagesTo.replace('%folder%', folderName);
                break;
            case TMMail.action_types.restore_filtered:
                hintText = isConversation ?
                    window.MailActionCompleteResource.restoreFilteredConversations :
                    window.MailActionCompleteResource.restoreFilteredMessages;
                break;
            case TMMail.action_types.delete_filtered:
                hintText = isConversation ?
                    window.MailActionCompleteResource.deleteFilteredConversations :
                    window.MailActionCompleteResource.deleteFilteredMessages;
                break;
            default:
                return;
        }

        setTimeout(function() {
            window.LoadingBanner.hideLoading();
            window.toastr.success(hintText);
        }, 1000);
    }

    function strHash(str) {
        var hash = 0, i, l;
        if (str.length == 0) {
            return hash;
        }
        for (i = 0, l = str.length; i < l; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

    function canViewInDocuments(url) {
        return ASC.Files.Utility.CanWebView(url);
    }

    function canEditInDocuments(url) {
        return ASC.Files.Utility.CanWebEdit(url);
    }

    function canViewAsCalendar(filename) {
        return filename.match(/.ics$/i) !== null ||
            filename.match(/.ical$/i) !== null ||
            filename.match(/.ifb$/i) !== null ||
            filename.match(/.icalendar$/i) !== null;
    }

    function fixMailtoLinks(element) {
        element.find("a[href*='mailto:']").click(function() {
            messagePage.setToEmailAddresses([$(this).attr('href').substr(7, $(this).attr('href').length - 1)]);
            window.location.href = "#composeto";
            return false;
        });
    }

    function isIe() {
        var ua = navigator.userAgent;
        return ua.match(/Trident\/7\./) || ua.match(/MSIE *\d+\.\w+/i);
    }

    function getAttachmentDownloadUrl(attachmentId) {
        return ASC.Mail.Constants.DOWNLOAD_HANDLER_URL.format(attachmentId);
    }

    function getAttachmentsDownloadAllUrl(messageId) {
        return ASC.Mail.Constants.DOWNLOAD_ALL_HANDLER_URL.format(messageId);
    }

    function getViewDocumentUrl(attachmentId) {
        return ASC.Mail.Constants.VIEW_DOCUMENT_HANDLER_URL.format(attachmentId);
    }

    function getEditDocumentUrl(attachmentId) {
        return ASC.Mail.Constants.EDIT_DOCUMENT_HANDLER_URL.format(attachmentId);
    }

    function getContactPhototUrl(contactId, photoSize) {
        return ASC.Mail.Constants.CONTACT_PHOTO_HANDLER_URL.format(contactId, photoSize);
    }

    function htmlEncode(value) {
        var entities = {
            '&nbsp;': ' ',
            '&': '&amp;',
            '>': '&gt;',
            '<': '&lt;',
            '"': '&quot;'
        }, keys = [], p, regex;

        for (p in entities) {
            keys.push(p);
        }

        regex = new RegExp('(' + keys.join('|') + ')', 'g');

        var result = (!value) ? value : String(value).replace(regex, function(match, capture) {
            return entities[capture];
        }).replace(/^\s+|\s+$/g, '');

        return result;
    }

    function htmlDecode(value) {
        var result = window.Encoder.htmlDecode(value);
        return result;
    }

    // checks current page anchor and change it to inbox folder if required

    function checkAnchor() {
        if (isInvalidPage()) {
            moveToInbox();
        }
    }

    function disableButton(button, disable) {
        button.toggleClass("disable", disable);
        if (disable) {
            button.attr("disabled", "disabled");
        } else {
            button.removeAttr("disabled");
        }
    }

    function disableInput(input, disable) {
        if (disable) {
            input.attr('disabled', 'true');
        } else {
            input.removeAttr('disabled');
        }
    }

    function setRequiredHint(containerId, text) {
        var hint = $("#" + containerId + ".requiredField span.requiredErrorText");
        hint.text(text);
        hint.attr('title', text);
    }

    function setRequiredError(containerId, needShow) {
        $("#" + containerId + ".requiredField").toggleClass(requiredFieldErrorCss, needShow);
    }

    function isRequiredErrorVisible(containerId) {
        return $("#" + containerId + ".requiredField").hasClass(requiredFieldErrorCss);
    }

    function isPopupVisible() {
        return $('#manageWindow').is(':visible') || $('#commonPopup').is(':visible') || $("#popupDocumentUploader").is(':visible') || $('#tagWnd').is(':visible');
    }

    function getDateFormated(date, format) {
        return window.ServiceFactory.formattingDate(date, format,
                                    ASC.Resources.Master.DayNames,
                                    ASC.Resources.Master.DayNamesFull,
                                    ASC.Resources.Master.MonthNames,
                                    ASC.Resources.Master.MonthNamesFull);
    }

    function getMapUrl(location) {
        if (!location)
            return '';

        return "https://maps.google.com/maps?q={0}".format(location.split(/[,\s]/).join('+'));
    }

    function resizeContent() {
        if (!TMMail.pageIs("viewmessage"))
            return;

        var mainPageEl = jq(".mainPageLayout"),
            mainPageContentEl = mainPageEl.find(".mainPageContent"),
            sidePanelEl = mainPageEl.find(".mainPageTableSidePanel"),
            mainPageWidth = parseInt(mainPageEl.width()),
            mainPageMinWidth = parseInt(mainPageEl.css("min-width")),
            sidePanelWidth = parseInt(sidePanelEl.width()),
            k = parseInt(mainPageEl.css("padding-left")) +
                parseInt(mainPageEl.css("padding-right")) +
                parseInt(mainPageContentEl.css("padding-left")) -
                parseInt(sidePanelEl.find(".ui-resizable-handle").width());

        var newWidth = (mainPageWidth > mainPageMinWidth ? mainPageWidth : mainPageMinWidth) - sidePanelWidth - k + "px";

        //console.log("Browser viewport: %sx%s", jq(window).width(), jq(window).height());
        //console.log("HTML document: %sx%s", jq(document).width(), jq(document).height());
        //console.log("windowWidth: %s, mainBlockWidth: %s, sidePanelWidth: %s, newWidth: %s ", windowWidth, mainBlockWidth, sidePanelWidth, newWidth);

        jq(".body").each(
            function () {
                jq(this).css("max-width", newWidth);
            }
        );
    };

    function getFileIconByExt(fileExt) {
        var utility = ASC.Files.Utility,
            fileExtensionLibrary = utility.FileExtensionLibrary,
            iconSrc = "",
            checkInArray = function (extsArray) {
                return jq.inArray(fileExt, extsArray) !== -1;
            };

        if (checkInArray(fileExtensionLibrary.ArchiveExts))
            iconSrc = "archive";
        else if (checkInArray(fileExtensionLibrary.AviExts))
            iconSrc = "avi";
        else if (checkInArray(fileExtensionLibrary.CsvExts))
            iconSrc = "csv";
        else if (checkInArray(fileExtensionLibrary.DjvuExts))
            iconSrc = "djvu";
        else if (checkInArray(fileExtensionLibrary.DocExts))
            iconSrc = "doc";
        else if (checkInArray(fileExtensionLibrary.DocxExts))
            iconSrc = "docx";
        else if (checkInArray(fileExtensionLibrary.DoctExts))
            iconSrc = "doct";
        else if (checkInArray(fileExtensionLibrary.EbookExts))
            iconSrc = "ebook";
        else if (checkInArray(fileExtensionLibrary.FlvExts))
            iconSrc = "flv";
        else if (checkInArray(fileExtensionLibrary.HtmlExts))
            iconSrc = "html";
        else if (checkInArray(fileExtensionLibrary.IafExts))
            iconSrc = "iaf";
        else if (checkInArray(fileExtensionLibrary.ImgExts))
            iconSrc = "image";
        else if (checkInArray(fileExtensionLibrary.M2tsExts))
            iconSrc = "m2ts";
        else if (checkInArray(fileExtensionLibrary.MkvExts))
            iconSrc = "mkv";
        else if (checkInArray(fileExtensionLibrary.MovExts))
            iconSrc = "mov";
        else if (checkInArray(fileExtensionLibrary.Mp4Exts))
            iconSrc = "mp4";
        else if (checkInArray(fileExtensionLibrary.MpgExts))
            iconSrc = "mpg";
        else if (checkInArray(fileExtensionLibrary.OdpExts))
            iconSrc = "odp";
        else if (checkInArray(fileExtensionLibrary.OdtExts))
            iconSrc = "odt";
        else if (checkInArray(fileExtensionLibrary.OdsExts))
            iconSrc = "ods";
        else if (checkInArray(fileExtensionLibrary.PdfExts))
            iconSrc = "pdf";
        else if (checkInArray(fileExtensionLibrary.PpsExts))
            iconSrc = "pps";
        else if (checkInArray(fileExtensionLibrary.PpsxExts))
            iconSrc = "ppsx";
        else if (checkInArray(fileExtensionLibrary.PptExts))
            iconSrc = "ppt";
        else if (checkInArray(fileExtensionLibrary.PptxExts))
            iconSrc = "pptx";
        else if (checkInArray(fileExtensionLibrary.PpttExts))
            iconSrc = "pptt";
        else if (checkInArray(fileExtensionLibrary.RtfExts))
            iconSrc = "rtf";
        else if (checkInArray(fileExtensionLibrary.SoundExts))
            iconSrc = "sound";
        else if (checkInArray(fileExtensionLibrary.SvgExts))
            iconSrc = "svg";
        else if (checkInArray(fileExtensionLibrary.TxtExts))
            iconSrc = "txt";
        else if (checkInArray(fileExtensionLibrary.DvdExts))
            iconSrc = "dvd";
        else if (checkInArray(fileExtensionLibrary.XlsExts))
            iconSrc = "xls";
        else if (checkInArray(fileExtensionLibrary.XlsxExts))
            iconSrc = "xlsx";
        else if (checkInArray(fileExtensionLibrary.XlstExts))
            iconSrc = "xlst";
        else if (checkInArray(fileExtensionLibrary.XmlExts))
            iconSrc = "xml";
        else if (checkInArray(fileExtensionLibrary.XpsExts))
            iconSrc = "xps";
        else if (checkInArray(fileExtensionLibrary.GdocExts))
            iconSrc = "gdoc";
        else if (checkInArray(fileExtensionLibrary.GsheetExts))
            iconSrc = "gsheet";
        else if (checkInArray(fileExtensionLibrary.GslidesExts))
            iconSrc = "gslides";
        else if (checkInArray(fileExtensionLibrary.CalendarExts))
            iconSrc = "cal";

        return ASC.Mail.Master["file_" + iconSrc + "_21"] || ASC.Mail.Master.file_21;
    };

    return {
        sysfolders: systemFolders,
        action_types: actionTypes,
        anchors: anchorRegExp,

        init: init,
        option: option,

        saveMessageInterval: saveMessageInterval,
        showNextAlertTimeout: showNextAlertTimeout,

        ltgt: ltgt,
        inArray: inArray,

        setPageHeaderFolderName: setPageHeaderFolderName,
        setPageHeaderTitle: setPageHeaderTitle,
        getErrorMessage: getErrorMessage,
        pageIs: pageIs,

        getSysFolderNameById: getSysFolderNameById,
        getSysFolderIdByName: getSysFolderIdByName,
        getSysFolderDisplayNameById: getSysFolderDisplayNameById,
        extractFolderIdFromAnchor: extractFolderIdFromAnchor,
        extractConversationIdFromAnchor: extractConversationIdFromAnchor,

        getFaqLink: getFaqLink,
        getSupportLink: getSupportLink,

        moveToReply: moveToReply,
        moveToReplyAll: moveToReplyAll,
        moveToForward: moveToForward,
        moveToMessagePrint: moveToMessagePrint,
        moveToConversationPrint: moveToConversationPrint,
        openMessage: openMessage,
        openConversation: openConversation,
        openDraftItem: openDraftItem,
        moveToConversation: moveToConversation,
        moveToMessage: moveToMessage,
        moveToDraftItem: moveToDraftItem,
        moveToInbox: moveToInbox,

        getParamsValue: getParamsValue,
        showCompleteActionHint: showCompleteActionHint,

        strHash: strHash,

        canViewInDocuments: canViewInDocuments,
        canEditInDocuments: canEditInDocuments,
        canViewAsCalendar: canViewAsCalendar,
        fixMailtoLinks: fixMailtoLinks,
        isIe: isIe,
        getAttachmentDownloadUrl: getAttachmentDownloadUrl,
        getAttachmentsDownloadAllUrl: getAttachmentsDownloadAllUrl,
        getViewDocumentUrl: getViewDocumentUrl,
        getEditDocumentUrl: getEditDocumentUrl,
        getContactPhototUrl: getContactPhototUrl,

        wordWrap: wordWrap,
        htmlEncode: htmlEncode,
        htmlDecode: htmlDecode,

        checkAnchor: checkAnchor,
        disableButton: disableButton,
        disableInput: disableInput,
        setRequiredHint: setRequiredHint,
        setRequiredError: setRequiredError,
        isRequiredErrorVisible: isRequiredErrorVisible,
        isPopupVisible: isPopupVisible,
        getDateFormated: getDateFormated,
        getMapUrl: getMapUrl,
        resizeContent: resizeContent,
        getAccountErrorFooter: getAccountErrorFooter,
        getFileIconByExt: getFileIconByExt,
        getOAuthFaqLink: getOAuthFaqLink
    };
})(jQuery);