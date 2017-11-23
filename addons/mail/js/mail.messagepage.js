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


window.messagePage = (function ($) {
    var isInit = false,
        saveTimeout = null,
        messageIsDirty = false,
        messageIsSending = false,
        isMessageRead = false,
        sortConversationByAsc = true,
        maxConversationShow = 5,
        attachmentMenuItems,
        attachmentEditMenuItems,
        messageMenuItems,
        toEmailAddresses = [],
        savingLock = false,
        repeatSaveFlag = false,
        conversationMoved = false,
        conversationDeleted = false,
        hasLinked = false,
        crmContactsInfo = [],
        lastSendMessageId;

    function setHasLinked(val) {
        if (hasLinked !== val) {
            hasLinked = val;
            mailCache.setHasLinked(mailBox.currentMessageId, hasLinked);
            $('#itemContainer').find('.viewTitle').trigger("update");
        }
    }

    function init() {
        if (isInit === false) {
            isInit = true;
            sortConversationByAsc = (TMMail.option('ConversationSortAsc') === 'true');

            serviceManager.bind(window.Teamlab.events.saveMailMessage, onSaveMessage);
            serviceManager.bind(window.Teamlab.events.markChainAsCrmLinked, onMarkChainAsCrmLinked);
            serviceManager.bind(window.Teamlab.events.createMailContact, onCreateMailContact);
        }

        attachmentMenuItems = [
            { selector: "#attachmentActionMenu .downloadAttachment", handler: downloadAttachment },
            { selector: "#attachmentActionMenu .viewAttachment", handler: viewAttachment },
            { selector: "#attachmentActionMenu .editAttachment", handler: editDocumentAttachment },
            { selector: "#attachmentActionMenu .saveAttachmentToDocs", handler: saveAttachmentToDocs },
            { selector: "#attachmentActionMenu .saveAttachmentToCalendar", handler: saveAttachmentToCalendar }
        ];

        attachmentEditMenuItems = [
            { selector: "#attachmentEditActionMenu .downloadAttachment", handler: downloadAttachment },
            { selector: "#attachmentEditActionMenu .viewAttachment", handler: viewAttachment },
            { selector: "#attachmentEditActionMenu .deleteAttachment", handler: deleteAttachment }
        ];

        messageMenuItems = [
            {
                selector: "#messageActionMenu .replyMail", handler: function (id) {
                    window.ASC.Mail.ga_track(ga_Categories.message, ga_Actions.buttonClick, "reply");
                    return checkhBlockedImagesBeforeCompose(id, function() {
                        return TMMail.moveToReply(id);
                    });
                }
            },
            {
                selector: "#messageActionMenu .replyAllMail", handler: function (id) {
                    window.ASC.Mail.ga_track(ga_Categories.message, ga_Actions.buttonClick, "replyAll");
                    return checkhBlockedImagesBeforeCompose(id, function() {
                        return TMMail.moveToReplyAll(id);
                    });
                }
            },
            {
                selector: "#messageActionMenu .forwardMail",
                handler: function (id) {
                    window.ASC.Mail.ga_track(ga_Categories.message, ga_Actions.buttonClick, "forward");
                    return checkhBlockedImagesBeforeCompose(id, function() {
                        return TMMail.moveToForward(id);
                    });
                }
            },
            { selector: "#messageActionMenu .singleViewMail", handler: TMMail.openMessage },
            { selector: "#messageActionMenu .deleteMail", handler: deleteMessage },
            { selector: "#messageActionMenu .printMail", handler: moveToMessagePrint },
            { selector: "#messageActionMenu .alwaysHideImages", handler: alwaysHideImages },
            { selector: "#messageActionMenu .createCrmPerson", handler: createNewCrmPerson },
            { selector: "#messageActionMenu .createCrmCompany", handler: createNewCrmCompany },
            { selector: "#messageActionMenu .createPersonalContact", handler: createPersonalContact }
        ];

        if (ASC.Mail.Constants.CRM_AVAILABLE) {
            messageMenuItems.push({ selector: "#messageActionMenu .exportMessageToCrm", handler: crmLinkPopup.showCrmExportMessagePopup });
        } else {
            $('.exportMessageToCrm.dropdown-item').hide();
        }

        wysiwygEditor.unbind(wysiwygEditor.events.OnChange).bind(wysiwygEditor.events.OnChange, onMessageChanged);
    }

    function hide() {
        closeMessagePanel();
        var magnificPopup = $.magnificPopup.instance;
        if (magnificPopup) magnificPopup.close();
    }

    function showConversationMessage(id, noBlock, checkSender) {
        var params = { action: 'view', conversation_message: true, message_id: id, checkSender: checkSender, loadImages: noBlock };
        //TODO: Load message from cache -> uncomment and fix
        /*var message = mailCache.getMessage(id);
        if (message && isMessageExpanded(message)) {
            console.log("%s found in cache", id);
            params.notRememberContent = true;
            onGetMailMessage(params, message);
        } else {
            console.log("%s not found in cache", id);*/
            serviceManager.getMessage(id, noBlock, params,
            {
                success: onGetMailMessage,
                error: onOpenConversationMessageError
            });
        //}
    }

    function checkCrmLinked(id) {
        if (ASC.Mail.Constants.CRM_AVAILABLE) {
            serviceManager.isConversationLinkedWithCrm(id, { messageId: id },
            {
                success: function (params, status) {
                    hasLinked = status.isLinked;
                },
                error: function (params, e) {
                    hasLinked = false;
                    console.error(e);
                },
                async: true
            });
        }
    }

    function view(id, noBlock) {
        var content = null;
        if(!commonSettingsPage.isConversationsEnabled())
            content = mailCache.get(id);

        if (!content) {
            checkCrmLinked(id);

            serviceManager.getMessage(id,
                noBlock,
                { action: 'view', loadImages: noBlock },
                {
                    success: onGetMailMessage,
                    error: onOpenMessageError
                },
                ASC.Resources.Master.Resource.LoadingProcessing);
        } else {
            console.log("%s found in cache", id);

            var rootMessage = content.messages[0];
            if (rootMessage && rootMessage.wasNew) {
                mailBox.setMessagesReadUnread([id], true, true);
            }

            var params = { action: 'view', id: id, loadImages: noBlock, conversation_message: false };
            hasLinked = content.hasLinked;
            params.notRememberContent = true;
            onGetMailMessage(params, rootMessage);
        }
    }

    function conversation(id, loadAllContent) {
        var params = { action: 'conversation', id: id, loadImages: loadAllContent };
        var content = mailCache.get(id);
        if (content) {
            var chainCountEl = $('#itemContainer .messages .row[data_id="' + id + '"] .chain-counter');
            if (chainCountEl.length > 0 && chainCountEl.attr("value") != content.messages.length) {
                mailCache.remove(id);
                content = null;
            }
        }

        if (!content) {
            console.log("%s not found in cache", id);
            checkCrmLinked(id);
            serviceManager.getConversation(id, loadAllContent, params,
                {
                    success: onGetMailConversation,
                    error: onOpenMessageError
                },
                ASC.Resources.Master.Resource.LoadingProcessing);
        } else {
            console.log("%s found in cache", id);

            var rootMessage = mailCache.getRootMessage(id);
            if (rootMessage && rootMessage.wasNew) {
                mailBox.setConversationReadUnread([id], true, true);
            }
            hasLinked = content.hasLinked;
            params.notRememberContent = true;
            onGetMailConversation(params, content.messages);
        }
    }

    function onOpenConversationMessageError(event) {
        var shortView = $('#itemContainer .itemWrapper .short-view[message_id=' + event.message_id + ']');
        shortView.removeClass('loading');
        shortView.find('.loader').hide();
        window.LoadingBanner.hideLoading();
        window.toastr.error(TMMail.getErrorMessage([window.MailScriptResource.ErrorOpenMessage]));
    }

    function onOpenMessageError() {
        TMMail.moveToInbox();
        window.LoadingBanner.hideLoading();
        window.toastr.error(TMMail.getErrorMessage([window.MailScriptResource.ErrorOpenMessage]));
    }

    function onCompose() {
        return openEmptyComposeForm();
    }

    function onComposeTo(params) {
        var addresses;
        if (params) {
            addresses = params.join(', ');
        } else {
            addresses = toEmailAddresses.join(', ');
        }
        return openEmptyComposeForm(addresses ? { email: addresses } : {});
    }

    function onComposeFromCrm(params) {
        crmContactsInfo = params.contacts_info;
        onComposeTo(params.addresses);
    }

    function compose() {
        if (accountsManager.any()) {
            ASC.Controls.AnchorController.move('compose');
            return;
        }
        // no accounts added yet
        var body = $.tmpl('addFirstAccountTmpl');
        popup.addBig(window.MailScriptResource.NewAccount, body);
    }

    function composeTo() {
        if (accountsManager.any()) {
            ASC.Controls.AnchorController.move('composeto');
            return;
        }
        // no accounts added yet
        var body = $.tmpl('addFirstAccountTmpl');
        popup.addBig(window.MailScriptResource.NewAccount, body);
    }

    function edit(id) {
        mailBox.currentMessageId = id;
        serviceManager.getMessage(id, true, { action: 'draft', loadImages: true },
        {
            success: onGetMailMessage,
            error: onOpenMessageError
        }, ASC.Resources.Master.Resource.LoadingProcessing);
    }

    function deleteMessage(id) {
        var chainFlag = false;
        if (TMMail.pageIs('conversation')) {
            chainFlag = true;
        }
        mailBox.deleteMessage(id, MailFilter.getFolder(), chainFlag);
    }

    function alwaysHideImages(id) {
        if (TMMail.pageIs('conversation')) {
            var senderAddress = ASC.Mail.Utility.ParseAddress(getFromAddress(id));
            hideImagesAction(null, { address: senderAddress.email });
        }
    }

    function isContentBlocked(id) {
        var fullView = $('#itemContainer .full-view[message_id="' + id + '"]');
        var contentBlocked = (fullView.length == 0 ? true : fullView.attr('content_blocked') == "true");
        return contentBlocked;
    }

    function reply(id) {
        var noBlock = !isContentBlocked(id);
        serviceManager.getMessage(id, noBlock, { action: 'reply', loadImages: noBlock },
        {
            success: onGetMailMessage,
            error: onOpenMessageError
        }, ASC.Resources.Master.Resource.LoadingProcessing);
    }

    function replyAll(id) {
        var noBlock = !isContentBlocked(id);
        serviceManager.getMessage(id, noBlock, { action: 'replyAll', loadImages: noBlock },
        {
            success: onGetMailMessage,
            error: onOpenMessageError
        }, ASC.Resources.Master.Resource.LoadingProcessing);
    }

    function forward(id) {
        var noBlock = !isContentBlocked(id);
        serviceManager.getMessage(id, noBlock, { action: 'forward', loadImages: noBlock },
        {
            success: onGetMailMessage,
            error: onOpenMessageError
        }, ASC.Resources.Master.Resource.LoadingProcessing);
    }

    // obtains message saving "lock" flag and remembers repeat attempts
    // returns true if lock obtained and false otherwise

    function obtainSavingLock() {
        if (true === savingLock) {
            repeatSaveFlag = true;
            return false;
        } else {
            savingLock = true;
            return true;
        }
    }

    // releases message saving lock and tries to repeat saving
    // if repeat attempt flag is set

    function releaseSavingLock() {
        savingLock = false;
        if (repeatSaveFlag) {
            repeatSaveFlag = false;
            saveMessage(false);
        }
    }

    function getEditingMessage() {
        return $('#editMessagePage').data('message');
    }

    function prepareMessageData(id) {
        var from = $('#newmessageFromSelected').attr('mailbox_email'),
            to = jq("#newmessageTo").AdvancedEmailSelector('get'),
            cc = jq("#newmessageCopy").AdvancedEmailSelector('get'),
            bcc = jq("#newmessageBCC").AdvancedEmailSelector('get'),
            subject = $('#newmessageSubject').val(),
            importance = $('#newmessageImportance')[0].checked,
            body = wysiwygEditor.getValue();

        var labelsCollection = $.makeArray($(".tags .itemTags a").map(function () { return parseInt($(this).attr("tagid")); }));

        var original = getEditingMessage();

        var message = new ASC.Mail.Message();
        message.id = id;
        message.from = from;
        message.to = to;
        message.cc = cc;
        message.bcc = bcc;
        message.subject = subject;
        message.mimeReplyToId = original.mimeReplyToId;
        message.importance = importance;
        message.tags = labelsCollection;
        message.body = body;
        message.attachments = AttachmentManager.GetAttachments();
        message.fileLinksShareMode = $('#sharingSettingForFileLinksTmplBox input[name="shareFileLinksAccessSelector"]:checked').val() || ASC.Files.Constants.AceStatusEnum.Read;

        return message;
    }

    function resetDirtyMessage() {
        if (!AttachmentManager.IsLoading()) {
            messageIsDirty = false;
            $('#newMessageSaveMarker').text('');
        }
    }

    function saveMessage(showLoader) {
        if (!obtainSavingLock()) {
            return;
        }

        if (mailBox.currentMessageId < 1) {
            mailBox.currentMessageId = message_id = 0;
        } else {
            message_id = mailBox.currentMessageId;
        }

        resetDirtyMessage();

        var message = prepareMessageData(message_id);

        if (showLoader)
            LoadingBanner.displayLoading(window.MailScriptResource.SavingMessage);

        ASC.Mail.Utility.SaveMessageInDrafts(message)
            .then(function() {
                    if (message_id === 0)
                        serviceManager.updateFolders();
                },
                onErrorSendMessage)
            .always(function() {
                LoadingBanner.hideLoading();
            });

        if (message_id === 0)
            mailBox.markFolderAsChanged(TMMail.sysfolders.drafts.id);
    }

    function saveMessagePomise() {
        var d = jq.Deferred();

        if (mailBox.currentMessageId < 1) {
            mailBox.currentMessageId = message_id = 0;
        } else {
            message_id = mailBox.currentMessageId;
        }

        var message = prepareMessageData(message_id);
        ASC.Mail.Utility.SaveMessageInDrafts(message)
           .fail(onErrorSendMessage)
           .always(function () {
                d.resolve();
            });

        return d.promise();
    }

    function onAttachmentsUploadComplete() {
        sendMessage();
        messageIsSending = false;
    }

    function getMessageErrors(message) {
        var errors = [];

        function hasInvalidEmails(emails) {
            return jq.grep(emails, function(v) {
                return !v.isValid;
            }).length > 0;
        }

        function collectErrors(emails) {
            jq.each(emails, function(i, v) {
                if (!v.isValid)
                    errors.push(window.MailScriptResource.ErrorIncorrectAddress + " \"" + TMMail.htmlEncode(v.email) + "\"");
            });
        }

        $("#newmessageTo").removeClass("invalidField");
        if (message.to.length === 0) {
            $("#newmessageTo").addClass("invalidField");
            errors.push(window.MailScriptResource.ErrorEmptyToField);
        }
        else if (hasInvalidEmails(message.to)) {
            $("#newmessageTo").addClass("invalidField");
            collectErrors(message.to);
        }   

        $("#newmessageCopy").removeClass("invalidField");
        if (message.cc.length > 0 && hasInvalidEmails(message.cc)) {
            $("#newmessageCopy").addClass("invalidField");
            collectErrors(message.cc);
        }

        $("#newmessageBCC").removeClass("invalidField");
        if (message.bcc.length > 0 && hasInvalidEmails(message.bcc)) {
            $("#newmessageBCC").addClass("invalidField");
            collectErrors(message.bcc);
        }

        return errors;
    }

    function needCrmLink() {
        return crmContactsInfo.length > 0;
    }

    function sendMessage(messageId) {
        if (messageId == undefined) {
            if (mailBox.currentMessageId < 1) {
                mailBox.currentMessageId = messageId = 0;
            } else {
                messageId = mailBox.currentMessageId;
            }
        }

        if (AttachmentManager.IsLoading()) {
            messageIsSending = true;
            window.AttachmentManager.Bind(window.AttachmentManager.CustomEvents.UploadComplete, onAttachmentsUploadComplete);
            window.LoadingBanner.strLoading = window.MailScriptResource.SendingMessage + ": " + window.MailScriptResource.LoadingAttachments;
            window.LoadingBanner.displayMailLoading(true, true);
            return;
        }

        if (needCrmLink()) {
            messageIsSending = true;
            saveMessage(true);
            return;
        }

        messageIsSending = false;

        var message = prepareMessageData(messageId);

        var errors = getMessageErrors(message);

        if (errors.length > 0) {
            window.LoadingBanner.hideLoading();
            var i, len = errors.length;
            for (i = 0; i < len; i++) {
                window.toastr.error(errors[i]);
            }

            TMMail.disableButton($('#editMessagePage .btnSend'), false);
            TMMail.disableButton($('#editMessagePage .btnSave'), false);
            if (messageId > 0) {
                TMMail.disableButton($('#editMessagePage .btnDelete'), false);
                TMMail.disableButton($('#editMessagePage .btnAddTag'), false);
            }
            return;
        }

        window.LoadingBanner.hideLoading();
        window.LoadingBanner.strLoading = ASC.Resources.Master.Resource.LoadingProcessing;
        clearTimeout(saveTimeout);

        LoadingBanner.displayLoading(window.MailScriptResource.SendingMessage);

        ASC.Mail.Utility.SendMessage(message, { skipAccountsCheck: true, skipSave: true })
            .done(onSendMessage)
            .fail(onErrorSendMessage);
    }

    function getMessageFileLinks() {
        var fileLinks = [];
        $($('<div/>').append(wysiwygEditor.getValue())).find('.mailmessage-filelink').each(function () {
            fileLinks.push({ id: $(this).attr('data-fileid'), title: $(this).find('.mailmessage-filelink-link').attr('title') });
        });

        return fileLinks;
    }

    /* redraw item`s custom labels */

    function updateMessageTags(message) {
        var tagsPanel = $('#itemContainer .head[message_id=' + message.id + '] .tags');
        if (tagsPanel) {
            if (message.tagIds && message.tagIds.length) {
                tagsPanel.find('.value .itemTags').empty();
                var foundTags = false;
                $.each(message.tagIds, function (i, value) {
                    if (updateMessageTag(message.id, value)) {
                        foundTags = true;
                    }
                });

                if (foundTags) {
                    tagsPanel.show();
                }
            } else {
                tagsPanel.hide();
            }
        }
    }

    function updateMessageTag(messageId, tagId) {
        var tag = tagsManager.getTag(tagId);
        if (tag) {
            var tagsPanel = $('#itemContainer .head[message_id=' + messageId + '] .tags');
            if (tagsPanel) {
                var html = $.tmpl('tagInMessageTmpl', tag, { htmlEncode: TMMail.htmlEncode });
                var $html = $(html);

                tagsPanel.find('.value .itemTags').append($html);

                tagsPanel.find('a.tagDelete').unbind('click').click(function () {
                    messageId = $(this).closest('.message-wrap').attr('message_id');
                    var idTag = $(this).attr('tagid');
                    mailBox.unsetTag(idTag, [messageId]);
                });

                tagsPanel.show(); // show tags panel

                mailCache.setTag(messageId, tagId);

                return true;
            }
        } else // if crm tag was deleted then delete it from mail
        {
            mailBox.unsetTag(tagId, [messageId]);
        }

        return false;
    }

    function setTag(messageId, tagId) {
        updateMessageTag(messageId, tagId);
    }

    function unsetTag(messageId, tagId) {
        var tagsPanel = $('#itemContainer .head[message_id=' + messageId + '] .tags');

        if (tagsPanel) {
            var delEl = tagsPanel.find('.value .itemTags .tagDelete[tagid="' + tagId + '"]');

            if (delEl.length) {
                delEl.parent().remove();
            }

            if (!tagsPanel.find('.tag').length) {
                tagsPanel.hide();
            } else {
                tagsPanel.show();
            }
        }

        mailCache.setTag(messageId, tagId, true);
    }

    function isMessageDirty() {
        return messageIsDirty;
    }

    function isMessageSending() {
        return messageIsSending;
    }

    function isSortConversationByAsc() {
        return sortConversationByAsc;
    }

    /* -= Private Methods =- */

    function insertBody(message) {
        var $messageBody = $('#itemContainer .itemWrapper .body[message_id=' + message.id + ']');
        TMMail.resizeContent();
        $messageBody.data('message', message);

        var html;
        if (message.isBodyCorrupted) {
            html = $.tmpl('errorBodyTmpl', {
                errorBodyHeader: ASC.Mail.Resources.MailScriptResource.ErrorOpenMessage,
                errorBody: $.trim($.tmpl("messageOpenErrorBodyTmpl").text())
            });

            $messageBody.html(html);
            $messageBody.toggleClass("body-error");
            TMMail.fixMailtoLinks($messageBody);
        } else if (message.hasParseError) {
            html = $.tmpl('errorBodyTmpl', {
                errorBodyHeader: ASC.Mail.Resources.MailScriptResource.ErrorOpenMessage,
                errorBody: $.trim($.tmpl("messageParseErrorBodyTmpl").text())
            });

            $messageBody.html(html);
            $messageBody.toggleClass("body-error");
            TMMail.fixMailtoLinks($messageBody);
        } else {
            if (message.textBodyOnly) {
                if (message.htmlBody) {
                    var quoteRegexp = new RegExp('(^|<br>|<body><pre>)&gt((?!<br>[^&gt]).)*(^|<br>)', 'ig');
                    var quoteArray = quoteRegexp.exec(message.htmlBody);

                    while (quoteArray) {
                        var lastIndex = quoteRegexp.lastIndex;
                        var substr = message.htmlBody.substring(quoteArray.index, lastIndex);
                        var searchStr = quoteArray[0].replace(/^(<br>|<body><pre>)/, '').replace(/<br>$/, '');
                        substr = substr.replace(searchStr, "<blockquote>" + searchStr + "</blockquote>");
                        message.htmlBody = message.htmlBody.substring(0, quoteArray.index) + substr + message.htmlBody.substr(lastIndex);
                        quoteArray = quoteRegexp.exec(message.htmlBody);
                    }
                }
                $messageBody.toggleClass("textOnly", true);
                $messageBody.html(message.htmlBody);

                $messageBody.find('blockquote').each(function () {
                    insertBlockquoteBtn($(this));
                });

                $messageBody.find('.tl-controll-blockquote').each(function () {
                    $(this).click(function () {
                        $(this).next('blockquote').toggle();
                        return false;
                    });
                });

                TMMail.fixMailtoLinks($messageBody);
                $messageBody.find("a").attr('target', '_blank');
                $("#delivery_failure_button").attr('target', '_self');
                if (message.to != undefined) {
                    $("#delivery_failure_faq_link").attr('href', TMMail.getFaqLink(message.to));
                }
                $messageBody.find("a[href*='mailto:']").removeAttr('target');
                displayTrustedImages(message);
            } else {
                var htmlText,
                    contentIsHidden = false;

                if (message.calendarUid) {
                    htmlText = "<blockquote>" + message.htmlBody + "</blockquote>";
                    contentIsHidden = true;
                } else {
                    htmlText = message.htmlBody;
                }

                $messageBody.html(htmlText);
                $messageBody.find("a[href*='mailto:']").removeAttr('target');
                $messageBody.find("a[href*='mailto:']").click(function () {
                    messagePage.setToEmailAddresses([$(this).attr('href').substr(7, $(this).attr('href').length - 1)]);
                    window.location.href = "#composeto";
                    return false;
                });
                $messageBody.find("a").attr('target', '_blank');

                var $blockquote = $($messageBody.find('div.gmail_quote:first, div.yahoo_quoted:first, ' +
                    'blockquote:first, div:has(hr#stopSpelling):last')[0]);
                if ($blockquote) {
                    insertBlockquoteBtn($blockquote);

                    var $btnBlockquote = $messageBody.find('.tl-controll-blockquote');
                    if ($btnBlockquote) {
                        $btnBlockquote.click(function () {
                            if (contentIsHidden) {
                                displayTrustedImages(message);
                                contentIsHidden = false;
                            }
                            $blockquote.toggle();
                            return false;
                        });
                    }
                }

                if (message.to != undefined) {
                    $messageBody.find("a#delivery_failure_faq_link").attr('href', TMMail.getFaqLink(message.to));
                }

                $messageBody.find("a[id='delivery_failure_button']").click(function () {
                    var deliveryFailureMessageId = $(this).attr("mailid");
                    messagePage.edit(deliveryFailureMessageId);
                });

                if (contentIsHidden) {
                    if (message.contentIsBlocked) {
                        var senderAddress = ASC.Mail.Utility.ParseAddress(message.from).email;
                        if (!trustedAddresses.isTrusted(senderAddress)) {
                            $('#id_block_content_popup_' + message.id).show();
                        }
                    }
                } else {
                    displayTrustedImages(message);
                }
            }

            if (message.calendarUid) {
                mailCalendar.loadAttachedCalendar(message);
            }
        }
        $('#itemContainer').height('auto');
    }

    function insertBlockquoteBtn(element) {
        element.before($.tmpl('blockquoteTmpl', {}).get(0).outerHTML);
        element.hide();
    }

    function updateFromSelected() {
        var accounts = accountsManager.getAccountList();
        var account;
        if (accounts.length > 1) {
            var buttons = [];
            for (var i = 0; i < accounts.length; i++) {
                account = accounts[i];
                var explanation = undefined;
                if (account.is_alias) {
                    explanation = window.MailScriptResource.AliasLabel;
                } else if (account.is_group) {
                    continue;
                }

                var text = (new ASC.Mail.Address(TMMail.htmlDecode(account.name), account.email).ToString(true));
                var cssClass = account.enabled ? '' : 'disabled';

                var accountInfo = {
                    text: text,
                    explanation: explanation,
                    handler: selectFromAccount,
                    account: account,
                    css_class: cssClass,
                    signature: account.signature
                };

                buttons.push(accountInfo);

            }
            $('#newmessageFromSelected').actionPanel({ buttons: buttons });
            $('#newmessageFromSelected .arrow-down').show();
            $('#newmessageFromSelected').addClass('pointer');
            $('#newmessageFromSelected .baseLinkAction').addClass('baseLinkAction');
        } else {
            $('#newmessageFromSelected .arrow-down').hide();
            $('#newmessageFromSelected .baseLinkAction').removeClass('baseLinkAction');
            $('#newmessageFromSelected').removeClass('pointer');
            if (accounts.length === 1) {
                account = accounts[0];
                selectFromAccount({}, {
                    account: account
                });
            } else {
                ASC.Controls.AnchorController.move('#accounts');
            }
        }
    }

    function setEditMessageButtons() {
        updateFromSelected();

        // Send
        $('#editMessagePage .btnSend').unbind('click').click(sendAction);

        // Save
        $('#editMessagePage .btnSave').unbind('click').click(saveAction);
        // Delete
        $('#editMessagePage .btnDelete').unbind('click').click(deleteAction);

        if (mailBox.currentMessageId < 1) {
            TMMail.disableButton($('#editMessagePage .btnDelete'), true);
            TMMail.disableButton($('#editMessagePage .btnAddTag'), true);
        }

        // Add tag
        $('#editMessagePage .btnAddTag.unlockAction').unbind('click').click(function () {
            if ($(this).hasClass('disable')) {
                return false;
            }
            tagsDropdown.show($(this));
        });

        $('#AddCopy:visible').unbind('click').click(function () {
            $('.value-group.cc').show();
            $('.value-group.bcc').show();
            $('#newmessageCopy').focus();
            $(this).remove();
        });
    }

    function setMenuActionButtons(senderAddress) {
        isMessageRead = true;

        $('.btnReply.unlockAction').unbind('click').click(function () {
            // Google Analytics
            window.ASC.Mail.ga_track(ga_Categories.message, ga_Actions.buttonClick, "reply");
            var messageId = mailBox.currentMessageId;

            if (TMMail.pageIs('conversation')) {
                messageId = getActualConversationLastMessageId();
            }

            checkhBlockedImagesBeforeCompose(messageId, function() {
                return TMMail.moveToReply(messageId);
            });
        });

        $('.btnReplyAll.unlockAction').unbind('click').click(function () {
            // Google Analytics
            window.ASC.Mail.ga_track(ga_Categories.message, ga_Actions.buttonClick, "replyAll");
            var messageId = mailBox.currentMessageId;

            if (TMMail.pageIs('conversation')) {
                messageId = getActualConversationLastMessageId();
            }

            checkhBlockedImagesBeforeCompose(messageId, function () {
                return TMMail.moveToReplyAll(messageId);
            });
        });

        $('.btnForward.unlockAction').unbind('click').click(function () {
            // Google Analytics
            window.ASC.Mail.ga_track(ga_Categories.message, ga_Actions.buttonClick, "forward");
            var messageId = mailBox.currentMessageId;
            var activeFolderId = $('#studio_sidePanel #foldersContainer .active').attr('folderid');

            if (TMMail.pageIs('conversation')) {
                messageId = getActualConversationLastMessageId('[folder="' + activeFolderId + '"]');
            }

            checkhBlockedImagesBeforeCompose(messageId, function () {
                return TMMail.moveToForward(messageId);
            });            
        });

        $('.btnDelete.unlockAction').unbind('click').click(deleteAction);

        $('.btnSpam.unlockAction').unbind('click').click(spamCurrent);
        $('.btnNotSpam.unlockAction').unbind('click').click(unspamCurrent);

        $('.btnRestore.unlockAction').unbind('click').click(restoreMessageAction);

        // Delete
        $('#itemContainer .contentMenuWrapper:visible .menuActionDelete').unbind('click').click(function () {
            if ($(this).hasClass('unlockAction')) {
                deleteCurrent();
            }
        });

        $('#menuActionBack').unbind('click').click(function () {
            mailBox.updateAnchor(true, true);
        });

        $('#itemContainer .contentMenuWrapper:visible .menuActionSpam').toggle(MailFilter.getFolder() != TMMail.sysfolders.spam.id);
        $('#itemContainer .contentMenuWrapper:visible .menuActionNotSpam').toggle(MailFilter.getFolder() == TMMail.sysfolders.spam.id);

        // Spam
        $('#itemContainer .contentMenuWrapper:visible .menuActionSpam').unbind('click').click(function () {
            spamCurrent();
        });

        // NotSpam
        $('#itemContainer .contentMenuWrapper:visible .menuActionNotSpam').unbind('click').click(function () {
            unspamCurrent();
        });

        var moreButton = $('.btnMore');

        if (moreButton != undefined) {
            var folderId = parseInt(MailFilter.getFolder());
            var buttons = [];

            var printBtnLabel = $("#itemContainer .message-wrap").length > 1 ? window.MailScriptResource.PrintAllBtnLabel : window.MailScriptResource.PrintBtnLabel;

            switch (folderId) {
                case TMMail.sysfolders.inbox.id:
                    if (ASC.Mail.Constants.PRINT_AVAILABLE)
                        buttons.push({ text: printBtnLabel, handler: moveToPrint });

                    buttons.push({ text: window.MailScriptResource.UnreadLabel, handler: readUnreadMessageAction });
                    if (ASC.Mail.Constants.CRM_AVAILABLE) {
                        buttons.push({ text: window.MailResource.LinkChainWithCRM, handler: crmLinkPopup.showCrmLinkConversationPopup });
                    }
                    break;
                case TMMail.sysfolders.sent.id:
                    if (ASC.Mail.Constants.PRINT_AVAILABLE)
                        buttons.push({ text: printBtnLabel, handler: moveToPrint });
                    buttons.push({ text: window.MailScriptResource.UnreadLabel, handler: readUnreadMessageAction });
                    if (ASC.Mail.Constants.CRM_AVAILABLE) {
                        buttons.push({ text: window.MailResource.LinkChainWithCRM, handler: crmLinkPopup.showCrmLinkConversationPopup });
                    }
                    break;
                case TMMail.sysfolders.trash.id:
                    if (ASC.Mail.Constants.PRINT_AVAILABLE)
                        buttons.push({ text: printBtnLabel, handler: moveToPrint });

                    buttons.push({ text: window.MailScriptResource.UnreadLabel, handler: readUnreadMessageAction });
                    break;
                case TMMail.sysfolders.spam.id:
                    if (ASC.Mail.Constants.PRINT_AVAILABLE)
                        buttons.push({ text: printBtnLabel, handler: moveToPrint });

                    buttons.push({ text: window.MailScriptResource.UnreadLabel, handler: readUnreadMessageAction });
                    break;
                default:
            }

            if (senderAddress) {
                if (!commonSettingsPage.AlwaysDisplayImages()) {
                    if (trustedAddresses.isTrusted(senderAddress)) {
                        buttons.push({
                            text: window.MailScriptResource.HideImagesLabel + ' "' + senderAddress + '"',
                            handler: hideImagesAction,
                            address: senderAddress
                        });
                    }
                }
            }

            moreButton.actionPanel({ buttons: buttons, css: 'stick-over' });
        }

        // Add tag
        $('.btnAddTag.unlockAction').unbind('click').click(function () {
            if ($(this).hasClass('disable')) {
                return false;
            }
            tagsDropdown.show($(this));
        });
    }

    function setConversationViewActions() {
        $('#sort-conversation').toggleClass('asc', isSortConversationByAsc()).toggleClass('desc', !isSortConversationByAsc());

        $('#sort-conversation').unbind('click').click(function () {
            sortConversationByAsc = !isSortConversationByAsc();

            $('#sort-conversation').toggleClass('asc', isSortConversationByAsc()).toggleClass('desc', !isSortConversationByAsc());

            $('.itemWrapper').append($('.message-wrap, .collapsed-messages').get().reverse());

            //restore iframe contents


            TMMail.option('ConversationSortAsc', sortConversationByAsc);
        });

        $('#collapse-conversation').unbind('click').click(function () {
            if ($('.full-view:hidden').length > 0) {
                showCollapsedMessages();

                $('.full-view[loaded="true"]').each(function (index, el) {
                    var messageId = $(el).attr('message_id');
                    if (typeof (messageId) !== 'undefined') {
                        expandConversation(messageId);
                    }
                });

                var messages = [];

                $('.full-view[loaded!="true"]').each(function(index, el) {
                    var messageId = $(el).attr('message_id'),
                        parentWrap = $(el).closest('.message-wrap'),
                        shortView = parentWrap.children('.short-view'),
                        loader = shortView.find('.loader');

                    showConversationMessage(messageId, false, false);
                    shortView.addClass('loading');
                    loader.show();

                    var folder = $(parentWrap).attr('folder');
                    var from = $(el).find('.from').text();
                    messages.push({ folder: folder, from: from });
                });

                checkMessagesSender(messages);
            } else {
                $('.full-view').each(function (index, el) {
                    var messageId = $(el).attr('message_id');
                    collapseConversation(messageId);
                });
            }
        });
    }

    function showBlockquote(messageId) {
        var body = $('#itemContainer .itemWrapper .body[message_id=' + messageId + ']');
        var blockquote = body.find('.tl-controll-blockquote');
        if (blockquote.length > 0) {
            var $blockquote = $(body.find('div.gmail_quote:first, div.yahoo_quoted:first, ' +
                'blockquote:first, div:has(hr#stopSpelling):last')[0]);

            if ($blockquote.is(':hidden'))
                blockquote.trigger("click");
        }
    }

    function initBlockContent(message) {
        $('#id-btn-block-content-' + message.id).unbind('click').click(function () {
            showBlockquote(message.id);
            displayImages(message.id);
        });

        $('#id-btn-always-block-content-' + message.id).unbind('click').click(function () {
            if (TMMail.pageIs('conversation')) {
                var currentSender = message.sender_address;
                trustedAddresses.add(currentSender);
                var conversationMessages = $('#itemContainer').find('.message-wrap');
                var i, len;
                for (i = 0, len = conversationMessages.length; i < len; i++) {
                    var currentMessage = $(conversationMessages[i]);
                    if (currentMessage.find('.full-view[loaded="true"]').length === 1) {
                        // message is loaded
                        var messageId = currentMessage.attr('message_id');
                        var senderAddress = ASC.Mail.Utility.ParseAddress(getFromAddress(messageId));
                        if (senderAddress.EqualsByEmail(currentSender)) {
                            showBlockquote(messageId);
                            displayImages(messageId);
                        }
                    }
                }
                setMenuActionButtons(currentSender);

            } else {
                trustedAddresses.add(message.sender_address);
                showBlockquote(message.id);
                displayImages(message.id);
                setMenuActionButtons(message.sender_address);
            }
        });
    }

    function renameAttr(node, attrName, newAttrName) {
        node.each(function () {
            var val = node.attr(attrName);
            node.attr(newAttrName, val);
            node.removeAttr(attrName);
        });
    }

    function displayImages(messageId) {
        var messageBody = $('#itemContainer .itemWrapper .body[message_id=' + messageId + ']');
        if (messageBody) {
            var styleTag = messageBody.find('style');
            if (styleTag.length > 0) { // style fix
                styleTag.html(styleTag.html().replace(/tl_disabled_/g, ''));
            }

            messageBody.find('*').each(function (index, node) {
                $(node.attributes).each(function () {
                    if (typeof this.nodeValue === 'string') {
                        this.nodeValue = this.nodeValue.replace(/tl_disabled_/g, '');
                    }

                    if (this.nodeName.indexOf('tl_disabled_') > -1) {
                        renameAttr($(node), this.nodeName, this.nodeName.replace(/tl_disabled_/g, ''));
                    }
                });
            });

            $('#itemContainer .full-view[message_id=' + messageId + ']').attr('content_blocked', false);

            $('#id_block_content_popup_' + messageId).remove();

        }
    }

    function hideAllActionPanels() {
        $.each($('.actionPanel:visible'), function (index, value) {
            var popup = $(value);
            if (popup != undefined) {
                popup.hide();
            }
        });
    }

    function selectFromAccount(event, params) {
        if (params.account.is_group)
            return;

        var text = (new ASC.Mail.Address(TMMail.htmlDecode(params.account.name), params.account.email).ToString(true));
        $('#newmessageFromSelected').attr('mailbox_email', params.account.email);
        $('#newmessageFromSelected span').text(text);
        $('#newmessageFromSelected').toggleClass('disabled', !params.account.enabled);
        $('#newmessageFromWarning').toggle(!params.account.enabled);
        wysiwygEditor.setSignature(params.account.signature);
        accountsPanel.mark(params.account.email);
    }

    function deleteMessageAttachment(attachId) {
        serviceManager.deleteMessageAttachment(mailBox.currentMessageId, attachId);
    }

    function deleteCurrentMessage() {
        resetDirtyMessage();
        messageIsSending = false;
        AttachmentManager.Unbind(AttachmentManager.CustomEvents.UploadComplete);
        if (mailBox.currentMessageId > 0) {
            mailBox.deleteMessage(mailBox.currentMessageId, TMMail.sysfolders.trash.id);
            mailBox.markFolderAsChanged(MailFilter.getFolder());
        }
    }

    function deleteAction() {
        if ($(this).hasClass('disable')) {
            return false;
        }
        // Google Analytics
        window.ASC.Mail.ga_track(ga_Categories.message, ga_Actions.actionClick, "delete");
        TMMail.disableButton($('#editMessagePage .btnDelete'), true);
        TMMail.disableButton($('#editMessagePage .btnSend'), true);
        TMMail.disableButton($('#editMessagePage .btnSave'), true);
        TMMail.disableButton($('#editMessagePage .btnAddTag'), true);
        deleteCurrent();
        return false;
    }

    function saveAction() {
        if ($(this).hasClass('disable')) {
            return false;
        }
        // Google Analytics
        window.ASC.Mail.ga_track(ga_Categories.createMail, ga_Actions.buttonClick, "save");
        TMMail.disableButton($('#editMessagePage .btnSave'), true);
        saveMessage(true);
        return false;
    }

    function sendAction(params, forcibly) {
        if ($(this).hasClass('disable')) {
            return false;
        }

        if ($('#newmessageFromSelected').hasClass('disabled')) {
            window.LoadingBanner.hideLoading();
            window.toastr.warning(window.MailScriptResource.SendFromDeactivateAccount);
            return false;
        }

        var fileLinks = getMessageFileLinks();

        if (!forcibly && fileLinks.length) {
            var needShowShareDlg = $.grep(fileLinks, function (f) {
                return ASC.Files.Utility.CanWebEdit(f.title, true) && !ASC.Files.Utility.MustConvert(f.title);
            }).length > 0;

            if (needShowShareDlg) {
                window.popup.addBig(MailScriptResource.SharingSettingForFiles, $.tmpl('sharingSettingForFileLinksTmpl'));
                return false;
            }
        }

        //google analytics
        window.ASC.Mail.ga_track(ga_Categories.createMail, ga_Actions.buttonClick, "send");
        TMMail.disableButton($('#editMessagePage .btnSend'), true);
        TMMail.disableButton($('#editMessagePage .btnSave'), true);
        TMMail.disableButton($('#editMessagePage .btnDelete'), true);
        TMMail.disableButton($('#editMessagePage .btnAddTag'), true);
        sendMessage();
        return false;
    }

    // returns id of actual last message in chain
    // during chain viewing, messages set could be changed (ex. last message could be deleted)
    // values stored in mailBox.currentMessageId or acnhor are not valid any more
    // so actual last message will be detected from markup

    function getActualConversationLastMessageId(selector) {
        var messages = $('.itemWrapper:visible .message-wrap');

        if (selector && messages.has(selector)) {
            messages = messages.filter(selector);
        }

        if (isSortConversationByAsc()) {
            return +messages.last().attr('message_id');
        }

        return +messages.first().attr('message_id');
    }

    function deleteCurrent() {
        if (TMMail.pageIs('conversation')) {
            mailBox.deleteConversation(getActualConversationLastMessageId(), MailFilter.getFolder());
        } else {
            mailBox.deleteMessage(mailBox.currentMessageId, MailFilter.getFolder());
        }
    }

    function restoreMessageAction() {
        // Google Analytics
        window.ASC.Mail.ga_track(ga_Categories.message, ga_Actions.actionClick, "restore");

        if (TMMail.pageIs('conversation')) {
            mailBox.restoreConversations([getActualConversationLastMessageId()]);
        } else {
            mailBox.restoreMessages([mailBox.currentMessageId]);
        }
    }

    function hideImagesAction(event, params) {
        trustedAddresses.remove(params.address);
        ASC.Controls.AnchorController.move(ASC.Controls.AnchorController.getAnchor());
    }

    function readUnreadMessageAction() {
        isMessageRead = !isMessageRead;
        // Google Analytics
        if (isMessageRead) {
            window.ASC.Mail.ga_track(ga_Categories.message, ga_Actions.actionClick, "read");
        } else {
            window.ASC.Mail.ga_track(ga_Categories.message, ga_Actions.actionClick, "unread");
        }

        if (TMMail.pageIs('conversation')) {
            mailBox.setConversationReadUnread([getActualConversationLastMessageId()], isMessageRead);
        } else {
            mailBox.setMessagesReadUnread([mailBox.currentMessageId], isMessageRead);
        }

        mailBox.updateAnchor(true, true);
    }

    function spamUnspamAction(event, params) {
        if (params.spam) {
            // Google Analytics
            window.ASC.Mail.ga_track(ga_Categories.message, ga_Actions.actionClick, "spam");
            spamCurrent();
        } else {
            // Google Analytics
            window.ASC.Mail.ga_track(ga_Categories.message, ga_Actions.actionClick, "not_spam");
            unspamCurrent();
        }
    }

    function moveToPrint() {
        if (TMMail.pageIs('conversation')) {
            moveToConversationPrint(getActualConversationLastMessageId());
        } else {
            moveToMessagePrint(mailBox.currentMessageId);
        }
    }

    function moveToConversationPrint(conversationId) {
        var simIds = [];
        var squIds = [];
        var sortAsc = isSortConversationByAsc();

        var fullView = $('#itemContainer .itemWrapper .full-view[loaded=true]');
        for (var i = 0, len = fullView.length; i < len; i++) {
            var messageId = $(fullView[i]).attr('message_id');
            if ($(fullView[i]).find('#id_block_content_popup_' + messageId).length == 0) {
                simIds.push(messageId);
            }

            var $messageBody = $('#itemContainer .itemWrapper .body[message_id=' + messageId + ']');
            var $quote = $messageBody.find('div.gmail_quote:first, div.yahoo_quoted:first, blockquote:first, div:has(hr#stopSpelling):last');
            if ($quote.is(':visible')) {
                squIds.push(messageId);
            }
        }

        var html = '';
        if (simIds.length != fullView.length) {
            html = $.tmpl('imagesBlockedPopupTmpl', { text: MailScriptResource.ConversationImagesBlockedPopupBody });
        }
        else if ($('#itemContainer .itemWrapper .full-view[loaded!=true]').length != 0) {
            html = $.tmpl('imagesBlockedPopupTmpl', { text: MailScriptResource.ConversationCollapsedBlockedPopupBody });
        }

        if (html != "") {
            $(html).find('.buttons .okBtn').bind("click", function () {
                TMMail.moveToConversationPrint(conversationId, simIds, squIds, sortAsc);
                window.popup.hide();
            });
            window.popup.addBig(MailScriptResource.MessageImagesBlockedPopupHeader, html);
        } else {
            TMMail.moveToConversationPrint(conversationId, simIds, squIds, sortAsc);
        }
    }

    function checkhBlockedImagesBeforeCompose(messageId, successFunc) {
        var hasBlockedImages = $('#itemContainer .itemWrapper .full-view[loaded=true]').find('#id_block_content_popup_' + messageId).length > 0;
        var html = '';
        if (hasBlockedImages) {
            html = $.tmpl('imagesBlockedPopupTmpl', { text: MailScriptResource.MessageImagesBlockedContinuePopupBody });
        }

        if (html !== "") {
            $(html).find('.buttons .okBtn').bind("click", function () {
                if (typeof (successFunc) === "function") {
                    successFunc();
                }

                window.popup.hide();
            });
            window.popup.addBig(MailScriptResource.MessageImagesBlockedContinuePopupHeader, html);
        } else {
            if (typeof (successFunc) === "function") {
                successFunc();
            }
        }
    }

    function moveToMessagePrint(messageId) {
        var $blockImagesBox = $('#id_block_content_popup_' + messageId);

        var $messageBody = $('#itemContainer .itemWrapper .body[message_id=' + messageId + ']');
        var $quote = $messageBody.find('div.gmail_quote:first, div.yahoo_quoted:first, blockquote:first, div:has(hr#stopSpelling):last');
        var showQuotes = $quote.is(':visible');

        if ($blockImagesBox.length) {
            var html = $.tmpl('imagesBlockedPopupTmpl', { text: MailScriptResource.MessageImagesBlockedPopupBody });
            $(html).find('.buttons .okBtn').bind("click", function () {
                TMMail.moveToMessagePrint(messageId, false, showQuotes);
                window.popup.hide();
            });
            window.popup.addBig(MailScriptResource.MessageImagesBlockedPopupHeader, html);
        } else {
            TMMail.moveToMessagePrint(messageId, true, showQuotes);
        }
    }

    function spamCurrent() {
        if (TMMail.pageIs('conversation')) {
            mailBox.moveConversation(getActualConversationLastMessageId(), MailFilter.getFolder(), TMMail.sysfolders.spam.id);
        } else {
            mailBox.moveMessage(mailBox.currentMessageId, MailFilter.getFolder(), TMMail.sysfolders.spam.id);
        }
    }

    function unspamCurrent() {
        if (TMMail.pageIs('conversation')) {
            mailBox.restoreConversations([getActualConversationLastMessageId()]);
        } else {
            mailBox.restoreMessages([mailBox.currentMessageId]);
        }
    }

    function initMessagePanel(message, action) {
        updateMessageTags(message);

        if ('draft' == action || 'forward' == action || 'reply' == action || 'compose' == action || 'replyAll' == action) {
            var from = ASC.Mail.Utility.ParseAddress(message.from).email;
            var account = undefined;
            if (from !== "") {
                account = accountsManager.getAccountByAddress(from) || accountsManager.getDefaultAccount();
            }

            updateFromAccountField(account);

            messageIsDirty = false;

            if ('reply' == action || 'replyAll' == action) {
                message.attachments = [];
            }

            setTimeout(function () {
                AttachmentManager.InitUploader(message.attachments);
                updateEditAttachmentsActionMenu();
            }, 10); // Dirty trick for Opera 12

            $('#editMessagePageHeader .on-close-link').bind("click", messagePage.onLeaveMessage);
            $('#tags_panel div.tag').bind("click", messagePage.onLeaveMessage);
            $('#tags_panel div.tag').each(function () {
                var elementData = $._data(this),
                    events = elementData.events;

                var onClickHandlers = events['click'];

                // Only one handler. Nothing to change.
                if (onClickHandlers.length == 1) {
                    return;
                }

                onClickHandlers.splice(0, 0, onClickHandlers.pop());
            });
        }
    }

    function updateReplyTo(value) {
        var message = getEditingMessage();
        message.mimeReplyToId = value;
        setEditingMessage(message);
    }

    function setEditingMessage(message) {
        $('#editMessagePage').data('message', message);
    }

    function bindOnMessageChanged() {
        $('#newmessageSubject').bind('textchange', function () {
            // Subject has changed, then it's a new chain;
            updateReplyTo("");
            onMessageChanged();
        });
        $('#newmessageImportance').bind('click', onMessageChanged);
        $('div.itemTags').bind('DOMNodeInserted DOMNodeRemoved', onMessageChanged);
    }

    function onMessageChanged() {
        if (TMMail.pageIs('writemessage')) {
            $(this).removeClass('invalidField');
            clearTimeout(saveTimeout);
            setDirtyMessage();
            saveTimeout = setTimeout(function () {
                if (messageIsDirty) {
                    saveMessage(false);
                }
            }, TMMail.saveMessageInterval);
        }
    }

    function onLeaveMessage(e) {
        if (TMMail.pageIs('writemessage')) {
            if (messagePage.isMessageSending()) {
                if (confirm(window.MailScriptResource.MessageNotSent)) {
                    deleteCurrentMessage();
                } else {
                    if (e != undefined) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    return false;
                }
            } else if (isMessageDirty()) {
                saveMessage(true);
            }
        }
        return true;
    }

    function closeMessagePanel() {
        AttachmentManager.Unbind(AttachmentManager.CustomEvents.UploadComplete);
        clearTimeout(saveTimeout);
        wysiwygEditor.close();
        saveTimeout = null;

        resetDirtyMessage();
        AttachmentManager.StopUploader();

        $('#attachments_upload_btn').unbind('mouseenter');

        $('#newmessageTo').unbind('textchange');

        $('#newmessageCopy').unbind('textchange');

        $('#newmessageBCC').unbind('textchange');

        $('#newmessageSubject').unbind('textchange');

        $('#newmessageImportance').unbind('click');

        $('div.itemTags').unbind('DOMNodeInserted DOMNodeRemoved');

        $('#editMessagePageHeader').empty();
        $('#editMessagePageFooter').empty();
        $('#editMessagePage').hide();

        $('#tags_panel div.tag').unbind('click', messagePage.onLeaveMessage);
    }

    function setDirtyMessage() {
        messageIsDirty = true;
        $('#newMessageSaveMarker').text(' *');
    }

    // sets jquery or string object as wysiwig editor content

    function setWysiwygEditorValue(message, action) {
        if (action == 'reply' || action == 'replyAll') {
            wysiwygEditor.setReply(message);
        } else if (action == 'forward') {
            wysiwygEditor.setForward(message);
        } else {
            wysiwygEditor.setDraft(message);
        }
    }

    /* -= Callbacks =- */

    function onSaveMessage(params, message) {
        TMMail.disableButton($('#editMessagePage .btnSave'), false);
        TMMail.disableButton($('#editMessagePage .btnSend'), false);
        TMMail.disableButton($('#editMessagePage .btnAddTag'), false);

        mailBox.markFolderAsChanged(TMMail.sysfolders.drafts.id);

        var now = new Date();

        var min = now.getMinutes() + '';

        if (min.length == 1) {
            min = '0' + min;
        }

        var saveTime = now.getHours() + ':' + min;

        $('.savedtime').show();

        $('.savedtime .savedtime-value').text(saveTime);

        resetDirtyMessage();

        if (message.id > 0) {
            if (mailBox.currentMessageId < 1 && message.attachments.length > 0) {
                var attachments = [];
                $.each(message.attachments, function (index, value) {
                    if (value.contentId == undefined || value.contentId == '') {
                        AttachmentManager.CompleteAttachment(value);
                        attachments.push(value);
                    }
                });
                if (attachments.length > 0) {
                    AttachmentManager.ReloadAttachments(attachments);
                }
            }

            $('#itemContainer .head[message_id]:visible').attr('message_id', message.id);
            mailBox.currentMessageId = message.id;
            TMMail.disableButton($('#editMessagePage .btnDelete'), false);
            TMMail.disableButton($('#editMessagePage .btnAddTag'), false);
        }

        releaseSavingLock();

        setEditingMessage(message);

        if (needCrmLink()) {
            serviceManager.markChainAsCrmLinked(mailBox.currentMessageId, crmContactsInfo, {}, ASC.Resources.Master.Resource.LoadingProcessing);
        }
    }

    function onErrorSendMessage(params, error) {
        var errorLimitCnt = $('#id_block_errors_container');
        errorLimitCnt.show();
        errorLimitCnt.find('span').text(jq.isArray(error) ? error[0] : error);
        TMMail.disableButton($('#editMessagePage .btnSave'), false);
        TMMail.disableButton($('#editMessagePage .btnSend'), false);
        TMMail.disableButton($('#editMessagePage .btnAddTag'), false);
        TMMail.disableButton($('#editMessagePage .btnDelete'), false);
        releaseSavingLock();
        LoadingBanner.hideLoading();
    }

    function onSendMessage(options, messageId) {

        lastSendMessageId = messageId;

        resetDirtyMessage(); // because it is saved while trying to send

        mailBox.markFolderAsChanged(TMMail.sysfolders.drafts.id);

        $('#itemContainer').height('auto');

        mailBox.markFolderAsChanged(TMMail.sysfolders.inbox.id); // for delivery failure messages

        mailBox.markFolderAsChanged(TMMail.sysfolders.sent.id);

        LoadingBanner.hideLoading();

        ASC.Controls.AnchorController.move(TMMail.sysfolders.inbox.name);
    }

    function refreshMailAfterSent(state) {
        serviceManager.updateFolders();
        window.LoadingBanner.hideLoading();

        if (state === -1)
            mailAlerts.check(lastSendMessageId ? { showFailureOnlyMessageId: lastSendMessageId } : {});
    }

    function openEmptyComposeForm(params) {
        var messageTemplate = new ASC.Mail.Message();
        params = params || {};

        MailFilter.reset();
        closeMessagePanel();
        mailBox.hidePages();
        $('#itemContainer').height('auto');

        mailBox.hideContentDivs();
        mailBox.hideLoadingMask();

        var writeMessageHtml = $.tmpl('writeMessageTmpl');
        var editMessageContainer = $('#itemContainer').find('#editMessagePage');
        if (editMessageContainer.length > 0) {
            editMessageContainer.replaceWith(writeMessageHtml);
        } else {
            $('#itemContainer').append(writeMessageHtml);
        }

        var action = 'compose';

        var activeAccount = accountsPanel.getActive() || accountsManager.getDefaultAccount();
        if (activeAccount) {
            messageTemplate.from = activeAccount.email;
        }

        initMessagePanel(messageTemplate, action);

        mailBox.currentMessageId = 0;

        if (params.email) {
            messageTemplate.to = params.email;
        }

        showComposeMessageCommon(messageTemplate, action);

        bindOnMessageChanged();

        mailBox.stickActionMenuToTheTop();
    }

    function sanitizeMessage(message, loadImages) {
        if (!message.sanitized &&
            !message.textBodyOnly &&
            message.hasOwnProperty("htmlBody") &&
            message.htmlBody.length > 0 &&
            message.folder !== TMMail.sysfolders.drafts.id &&
            !ASC.Mail.Utility.IsEqualEmail(ASC.Mail.Constants.MAIL_DAEMON_EMAIL, message.from)) {

            var res = ASC.Mail.Sanitizer.Sanitize(message.htmlBody, {
                urlProxyHandler: ASC.Mail.Constants.PROXY_HTTP_URL,
                needProxyHttp: ASC.Mail.Constants.NEED_PROXY_HTTP_URL,
                loadImages: loadImages
            });

            message.htmlBody = res.html;
            message.sanitized = res.sanitized;
            message.contentIsBlocked = res.imagesBlocked;

            if (!res.sanitized && res.html.length > 0)
                message.isBodyCorrupted = true;
        }
    }

    function onGetMailMessage(params, message) {
        sanitizeMessage(message, params.loadImages);

        var originalMessage = $.extend({}, message); // Copy message
        message.conversation_message = params.conversation_message;
        if (!params.conversation_message) {
            closeMessagePanel();
            hideAllActionPanels();
            mailBox.hidePages();
            $('#itemContainer').height('auto');
            mailBox.hideContentDivs();
            if (!TMMail.pageIs('writemessage')) {
                folderPanel.markFolder(message.folder);
            }
        }
        if (params.action == 'reply' || 'forward' == params.action || 'replyAll' == params.action) {
            mailBox.currentMessageId = 0;
        }
        mailBox.hideLoadingMask();

        if (MailFilter.getFolder() == undefined) {
            MailFilter.setFolder(message.folder);
        }

        preprocessMessages(params.action, [message], message.folder);

        var html;
        if (isComposeAction(params.action)) {
            message.original = originalMessage;
            message.original.preprocessAddresses = preprocessAddresses;
            if ('forward' == params.action && message.subject.indexOf(window.MailScriptResource.ForwardSubjectPrefix) != 0) {
                message.subject = window.MailScriptResource.ForwardSubjectPrefix + ": " + message.subject;
                message.to = "";
            } else if (('reply' == params.action || 'replyAll' == params.action) && message.subject.indexOf(window.MailScriptResource.ReplySubjectPrefix) != 0) {
                message.subject = window.MailScriptResource.ReplySubjectPrefix + ": " + message.subject;
            }

            var writeMessageHtml = $.tmpl('writeMessageTmpl', message, { fileSizeToStr: AttachmentManager.GetSizeString });
            var editMessageContainer = $('#itemContainer').find('#editMessagePage');
            if (editMessageContainer.length > 0) {
                editMessageContainer.replaceWith(writeMessageHtml);
            } else {
                $('#itemContainer').append(writeMessageHtml);
            }
            releaseSavingLock();
        } else {
            if (!params.notRememberContent) {
                originalMessage.expanded = false;
                mailCache.updateMessage(message.id, originalMessage);
            }

            $('#itemContainer').find('.full-view .from').bind('click', function () {
                messagePage.setToEmailAddresses([message.from]);
                messagePage.composeTo();
            });

            if (!params.conversation_message) {
                html = $.tmpl("messageTmpl", null, {
                    messages: [message],
                    folder: message.folder,
                    last_message: message,
                    important: message.important,
                    fileSizeToStr: AttachmentManager.GetSizeString,
                    cutFileName: AttachmentManager.CutFileName,
                    getFileNameWithoutExt: AttachmentManager.GetFileName,
                    getFileExtension: AttachmentManager.GetFileExtension,
                    htmlEncode: TMMail.htmlEncode,
                    asc: false,
                    action: params.action,
                    wordWrap: TMMail.wordWrap,
                    hasLinked: hasLinked
                });

                $('#itemContainer').append(html);

                $('#itemContainer').find('.viewTitle').dotdotdot({ wrap: 'letter', height: 20, watch: 'window' });
            } else {
                var $messageBody = $('#itemContainer .itemWrapper .body[message_id=' + message.id + ']');

                if ($messageBody.length > 0) {
                    var $fullView = $messageBody.parent();

                    if ($fullView.length > 0) {
                        if ($fullView.children('.error-popup').length < 1 && message.contentIsBlocked) {
                            message.sender_address = ASC.Mail.Utility.ParseAddress(message.from).email;
                            if (!trustedAddresses.isTrusted(message.sender_address)) {
                                $messageBody.before($.tmpl("messageBlockContent", message, {}));
                            }
                        }
                    }
                }
            }

        }

        if (!commonSettingsPage.isConversationsEnabled() &&
            MailFilter.getFolder() === TMMail.sysfolders.inbox.id &&
            !params.notRememberContent) {
            var messagesAllRead = $.extend(true, [], [message]);
            $.each(messagesAllRead, function(i, m) { m.wasNew = false });
            var content = $.extend(true, {}, { messages: messagesAllRead, hasLinked: hasLinked });
            mailCache.set(message.id, content);
        }

        showMessagesCommon([message], params.action);
        if (isComposeAction(params.action)) {
            showComposeMessageCommon(message, params.action);
        } else {
            showMessageCommon(message, params.action);
            setMenuActionButtons(message.sender_address);
        }

        initIamgeZoom();

        updateAttachmentsActionMenu();

        if (!params.conversation_message) {
            $('#itemContainer').find('.full-view[message_id="' + message.id + '"]').attr('is_single', true);
            $('#itemContainer').find('.full-view .head').actionMenu('messageActionMenu', messageMenuItems, pretreatmentConversationMessage);
            checkMessagesSender([message]);
        }
        else if (params.checkSender) {
            checkMessagesSender([message]);
        }

        $('.header-crm-link').unbind('click').bind('click', crmLinkPopup.showCrmLinkConversationPopup);

        tuneNextPrev();

        bindOnMessageChanged();
    }

    function onGetMailConversation(params, messages) {
        var important = false;
        var folderId = TMMail.sysfolders.inbox.id;
        var lastMessage = null;
        var needRemember = true;

        $.each(messages, function (i, m) {
            var senderAddress = ASC.Mail.Utility.ParseAddress(m.from);
            var loadImages = senderAddress.isValid ? trustedAddresses.isTrusted(senderAddress.email) : params.loadImages;

            sanitizeMessage(m, loadImages);

            if (isMessageExpanded(m) && m.isBodyCorrupted) {
                needRemember = false;
            }

            important |= m.important;

            if (m.id == mailBox.currentMessageId) {
                folderId = m.folder;
                lastMessage = m;
            }
        });

        if (params.notRememberContent) {
            needRemember = false;
        }

        if (lastMessage == null) {
            return;
        }

        if (needRemember) {
            var messagesAllRead = $.extend(true, [], messages);
            $.each(messagesAllRead, function(i, m) { m.wasNew = false });
            var content = $.extend(true, {}, { messages: messagesAllRead, hasLinked: hasLinked });
            mailCache.set(params.id, content);
        }

        closeMessagePanel();
        mailBox.hidePages();
        $('#itemContainer').height('auto');
        mailBox.hideContentDivs();
        mailBox.hideLoadingMask();

        if (messagePage.conversation_moved) {
            TMMail.showCompleteActionHint(TMMail.action_types.move, true, 1, messagePage.dst_folder_id);
            messagePage.conversation_moved = false;
            messagePage.dst_folder_id = 0;
        }

        if (messagePage.conversation_deleted) {
            TMMail.showCompleteActionHint(TMMail.action_types.delete_messages, true, 1);
            messagePage.conversation_deleted = false;
        }

        folderPanel.markFolder(folderId);

        if (!isSortConversationByAsc()) {
            messages.reverse();
        }

        preprocessMessages(params.action, messages, folderId);

        var html = $.tmpl('messageTmpl', null, {
            messages: messages,
            folder: folderId,
            last_message: lastMessage,
            important: important,
            maxShowCount: maxConversationShow,
            fileSizeToStr: AttachmentManager.GetSizeString,
            cutFileName: AttachmentManager.CutFileName,
            getFileNameWithoutExt: AttachmentManager.GetFileName,
            getFileExtension: AttachmentManager.GetFileExtension,
            htmlEncode: TMMail.htmlEncode,
            wordWrap: TMMail.wordWrap,
            hasLinked: hasLinked
        });

        $("#itemContainer").append(html);
        $("#itemContainer").find(".viewTitle").dotdotdot({ wrap: "letter", height: 20, watch: 'window' });

        showMessagesCommon(messages, params.action);

        var verifiableMessages = [];
        $.each(messages, function(index, message) {
            showMessageCommon(message, params.action);

            if (isMessageExpanded(message)) {
                verifiableMessages.push(message);
            }
        });

        checkMessagesSender(verifiableMessages);

        if ('draft' == params.action || 'reply' == params.action || 'forward' == params.action) {
            setEditMessageButtons();
        } else {
            setMenuActionButtons(messages.length == 1 ? ASC.Mail.Utility.ParseAddress(messages[0].from).email : undefined);
            setConversationViewActions();
        }

        updateAttachmentsActionMenu();

        if (1 == messages.length) {
            $('#itemContainer').find('.full-view[message_id="' + messages[0].id + '"]').attr('is_single', true);
        }

        $('#itemContainer').find('.full-view .head').actionMenu('messageActionMenu', messageMenuItems, pretreatmentConversationMessage);


        $('.header-crm-link').unbind('click').bind('click', crmLinkPopup.showCrmLinkConversationPopup);
        tuneNextPrev();
    }

    function updateAttachmentsActionMenu() {
        $('#itemContainer').find('.attachments').actionMenu('attachmentActionMenu', attachmentMenuItems, pretreatmentAttachments);
        bindAllAttachmentsCommonActions();
    }

    function updateEditAttachmentsActionMenu() {
        $('#mail_attachments').actionMenu('attachmentEditActionMenu', attachmentEditMenuItems, pretreatmentAttachments);
    }

    function displayTrustedImages(message, forcibly) {
        if (forcibly != undefined) {
            if (forcibly) {
                displayImages(message.id);
            }
            return;
        }

        if (message.contentIsBlocked) {
            var senderAddress = ASC.Mail.Utility.ParseAddress(message.from).email;
            if (trustedAddresses.isTrusted(senderAddress)) {
                displayImages(message.id);
            } else if ($('#id_block_content_popup_' + message.id).length == 0) {
                // Conversation sort algorithm: user has clicked the 'Display images' and #id_block_content_popup has been removed;
                displayImages(message.id);
            } else {
                $('#id_block_content_popup_' + message.id).show();
            }
        }
    }

    function initIamgeZoom() {
        window.StudioManager.initImageZoom();
    }

    function checkMessagesSender(messages) {
        var addresses = [];
        var i, len;
        for (i = 0, len = messages.length; i < len; i++) {
            if (messages[i].folder == TMMail.sysfolders.inbox.id) {
                var address = ASC.Mail.Utility.ParseAddress(messages[i].from).email;
                if (addresses.indexOf(address) === -1)
                    addresses.push(address);
            }
        }

        for (i = 0, len = addresses.length; i < len; i++) {
            var email = addresses[i];
            if (ASC.Mail.Constants.CRM_AVAILABLE) {
                contactsManager.inCrmContacts(email).done(function(result) {
                    updateMessagesSender(result.email, 'is_crm', result.exists);
                });
            }
            contactsManager.inPersonalContacts(email).done(function(result) {
                updateMessagesSender(result.email, 'is_personal', result.exists);
            });

        }
    }

    function updateMessagesSender(address, attribute, value) {
        var messages = $('#itemContainer').find('.message-wrap');
        for (var i = 0, len = messages.length; i < len; i++) {
            if ($(messages[i]).attr('folder') == TMMail.sysfolders.inbox.id) {
                var from = ASC.Mail.Utility.ParseAddress($(messages[i]).find('.full-view .from').text()).email;
                if (from == address) {
                    $(messages[i]).find('.full-view').attr(attribute, value);
                }
            }
        }
    }

    function onCreateMailContact(params, contact) {
        $.each(contact.emails, function (i, v) {
            updateMessagesSender(v.value, 'is_personal', true);
        });
    }

    function isMessageExpanded(message) {
        return message.wasNew || "undefined" != typeof message.htmlBody || (!MailFilter.isBlank() && messageMatchFilter(message));
    }

    function preprocessMessages(action, messages, folder) {
        var index, len, hiddenCount = 0;
        var wasNewFlag = false;
        for (index = 0, len = messages.length; index < len; index++) {
            var message = messages[index];

            message.subject = message.subject || "";

            wasNewFlag |= message.wasNew;

            if (!message.hasOwnProperty("expanded"))
                message.expanded = isMessageExpanded(message);

            var lastOrFirst = (0 == index || messages.length - 1 == index);
            var nextExpanded = messages.length > index + 1 && isMessageExpanded(messages[index + 1]);
            var prevExpanded = 0 != index && messages[index - 1].expanded;

            if (message.expanded || lastOrFirst || prevExpanded || nextExpanded) {
                message.visible = true;
                if (hiddenCount == 1) {
                    messages[index - 1].visible = true;
                    hiddenCount = 0;
                }
                message.hidden_count = hiddenCount;
                hiddenCount = 0;
            } else {
                message.visible = false;
                message.hidden_count = 0;
                hiddenCount += 1;
            }

            var addr = ASC.Mail.Utility.ParseAddress(message.from);
            message.fromName = addr.isValid ? (addr.name || addr.email) : message.from;

            message.displayDate = window.ServiceFactory.getDisplayDate(window.ServiceFactory.serializeDate(message.receivedDate));
            message.displayTime = window.ServiceFactory.getDisplayTime(window.ServiceFactory.serializeDate(message.receivedDate));

            switch (action) {
                case 'reply':
                case 'replyAll':
                    message.isAnswered = true;
                    break;
                case 'forward':
                    message.isForwarded = true;
                    break;
            }

            if (action === "reply" || action === "forward" || action === "replyAll") {
                message.mimeReplyToId = message.mimeMessageId;
                message.mimeMessageId = "";
                if (message.folder !== TMMail.sysfolders.sent.id) {
                    var receiverAddress = ASC.Mail.Utility.ParseAddress(message.address),
                        receiverAccount = accountsManager.getAccountByAddress(receiverAddress.email),
                        toAddress = ASC.Mail.Utility.ParseAddress(message.to),
                        toAccount = accountsManager.getAccountByAddress(toAddress.email),
                        toEqualsReceiver = toAddress.EqualsByEmail(receiverAddress);

                    if (action === "replyAll") {
                        var emails = toEqualsReceiver
                            ? []
                            : (!toAccount || toAccount.mailbox_id !== receiverAccount.mailbox_id) ? [toAddress] : [];
                        if (message.cc)
                            emails = emails.concat(ASC.Mail.Utility.ParseAddresses(message.cc).addresses);

                        emails = $.map(emails, function (e) {
                            return (receiverAddress.isValid && receiverAddress.EqualsByEmail(e)) ?
                                undefined :
                                e.ToString();
                        });
                        message.cc = emails.join(", ");
                    } else {
                        message.cc = "";
                    }

                    var account = toEqualsReceiver
                                    ? receiverAccount
                                    : toAccount || receiverAccount;

                    if (!account) {
                        var def = accountsManager.getDefaultAccount();
                        if (def)
                            account = def.email;
                    }

                    var to;
                    if (message.replyTo) {
                        var replyTo = ASC.Mail.Utility.ParseAddress(message.replyTo);
                        var from = ASC.Mail.Utility.ParseAddress(message.from);

                        if (replyTo.EqualsByEmail(from) && !replyTo.name && from.name) {
                            to = message.from;
                        } else {
                            to = message.replyTo;
                        }
                    } else {
                        to = message.from;
                    }

                    message.to = to;
                    message.from = (account && !account.is_group) ? (new ASC.Mail.Address(account.name, account.email, true)).ToString() : message.address;
                }

                message.id = 0;
            } else {
                action = 'view';
                message.from = preprocessAddresses(message.from);
                message.to = preprocessAddresses(message.to);
                if (message.cc !== "") {
                    message.cc = preprocessAddresses(message.cc);
                }
                if (message.bcc !== "") {
                    message.bcc = preprocessAddresses(message.bcc);
                }
            }

            message.template_name = message.folder == TMMail.sysfolders.drafts.id ? "editMessageTmpl" : "messageShortTmpl";
            message.sender_address = ASC.Mail.Utility.ParseAddress(message.from).email;
            message.full_size = 0;

            if (message.hasAttachments) {
                var i, count;
                for (i = 0, count = message.attachments.length; i < count; i++) {
                    message.full_size += message.attachments[i].size;
                    AttachmentManager.CompleteAttachment(message.attachments[i]);

                }
                message.download_all_url = TMMail.getAttachmentsDownloadAllUrl(message.id);
            }
        }

        if (wasNewFlag) {
            switch (folder) {
                case TMMail.sysfolders.sent.id:
                    serviceManager.updateFolders();
                    break;
                case TMMail.sysfolders.inbox.id:
                case TMMail.sysfolders.spam.id:
                    folderPanel.decrementUnreadCount(folder);
                    break;
                default:
                    break;
            }
        }
    }

    // check message meets for filter conditions

    function messageMatchFilter(message) {
        if (true === MailFilter.getImportance() && !message.important) {
            return false;
        }

        if (true === MailFilter.getUnread() && !message.wasNew) {
            return false;
        }

        if (true === MailFilter.getAttachments() && !message.hasAttachments) {
            return false;
        }

        var period = MailFilter.getPeriod();
        if (0 != period.from && 0 != period.to && (message.date < period.from || message.date > period.to)) {
            return false;
        }

        var tags = MailFilter.getTags();
        if (tags.length > 0) {
            if (0 == message.tagIds.length) {
                return false;
            }
            for (var i = 0, len = tags.length; i < len; i++) {
                if (-1 == $.inArray(tags[i], message.tagIds)) {
                    return false;
                }
            }
        }

        var search = MailFilter.getSearch();
        if ('' != search) {
            var messageText = message.from + ' ' + message.to + ' ' + message.subject;
            if (-1 == messageText.toLowerCase().indexOf(search.toLowerCase())) {
                return false;
            }
        }

        if (MailFilter.getTo() && -1 == message.to.toLowerCase().indexOf(MailFilter.getTo().toLowerCase())) {
            return false;
        }

        if (MailFilter.getFrom() && -1 == message.from.toLowerCase().indexOf(MailFilter.getFrom().toLowerCase())) {
            return false;
        }

        return true;
    }

    function preprocessAddresses(addressStr) {
        var addresses = ASC.Mail.Utility.ParseAddresses(addressStr).addresses;
        var newAddresses = [];
        for (var i = 0, len = addresses.length; i < len; i++) {
            if (addresses[i].isValid && !addresses[i].name) {
                var contact = contactsManager.getTLContactsByEmail(addresses[i].email);
                if (contact && contact.displayName) {
                    addresses[i].name = contact.displayName;
                }

                if (!addresses[i].name) {
                    var account = accountsManager.getAccountByAddress(addresses[i].email);
                    if (account && account.name) {
                        addresses[i].name = account.name;
                    }
                }
            }

            newAddresses.push(addresses[i].ToString(addresses[i].isValid ? false : (addresses[i].name.indexOf(",") !== -1 ? false : true)));
        }
        return newAddresses.join(", ");
    }

    function expandConversation(messageId) {
        var shortView = $('#itemContainer .itemWrapper .short-view[message_id=' + messageId + ']');

        if (!shortView) {
            return;
        }

        var parentWrap = shortView.closest('.message-wrap'),
            fullView = parentWrap.find('.full-view');

        shortView.removeClass('loading');
        shortView.toggleClass('new', false);
        fullView.attr('loaded', true);
        fullView.show();
        shortView.hide();

        $('#collapse-conversation').html(($('.full-view:hidden').length > 0) ? window.MailScriptResource.ExpandAllLabel : window.MailScriptResource.CollapseAllLabel);
    }

    function collapseConversation(messageId) {
        var fullView = $('#itemContainer .itemWrapper .full-view[message_id=' + messageId + ']');

        if (!fullView) {
            return;
        }

        var parentWrap = fullView.closest('.message-wrap'),
            shortView = parentWrap.find('.short-view'),
            loader = shortView.find('.loader');

        loader.hide();
        shortView.show();
        fullView.hide();

        $('#collapse-conversation').html(($('.full-view:hidden').length > 0) ? window.MailScriptResource.ExpandAllLabel : window.MailScriptResource.CollapseAllLabel);
    }

    // expand collapsed in "N more" panel messages rows

    function showCollapsedMessages() {
        $('.collapsed-messages').hide();

        $.each($('.message-wrap:hidden'), function (index, value) {
            var messageWrap = $(value);
            if (messageWrap != undefined) {
                messageWrap.show();
            }
        });
    }

    function showMessagesCommon(messages, action) {
        if ('view' == action || 'conversation' == action) {
            $('#itemContainer .head-subject .importance').unbind('click').click(function () {
                var icon = $(this).find('[class^="icon-"], [class*=" icon-"]');
                var newimportance = icon.is('.icon-unimportant');
                icon.toggleClass('icon-unimportant').toggleClass('icon-important');

                var title;
                if (newimportance) {
                    title = MailScriptResource.ImportantLabel;
                } else {
                    title = MailScriptResource.NotImportantLabel;
                }
                icon.attr('title', title);

                if (TMMail.pageIs('conversation')) {
                    var messageId = getActualConversationLastMessageId();
                    mailBox.updateConversationImportance(messageId, newimportance);

                    var conversationMessages = mailBox.getConversationMessages();
                    var i, len = conversationMessages.length;
                    for (i = 0; i < len; i++) {
                        messageId = $(conversationMessages[i]).attr('message_id');
                        mailBox.setImportanceInCache(messageId);
                    }

                } else {
                    messageId = mailBox.currentMessageId;
                    mailBox.updateMessageImportance(messageId, newimportance);
                    mailBox.setImportanceInCache(messageId);
                }
            });

            $('#itemContainer').find('.full-view .from').bind('click', function () {
                messagePage.setToEmailAddresses([$(this).text()]);
                messagePage.composeTo();
            });

            if ('conversation' == action) {
                $('.collapsed-messages').click(function () {
                    showCollapsedMessages();
                });
            }

            $.each(messages, function (i, v) {
                if (v.expanded && 'undefined' != typeof v.htmlBody) {
                    expandConversation(v.id);
                }
            });

            if (messages.length > 1) {
                tuneFullView();
            }

            title = isSortConversationByAsc() ? messages[0].subject : messages[messages.length - 1].subject;
            title = title || window.MailScriptResource.NoSubject;
            TMMail.setPageHeaderTitle(title);
        } else {
            initMessagePanel(messages[0], action);
        }
    }

    function tuneFullView() {
        var parent = $('#itemContainer .itemWrapper'),
            fullView = parent.find('.full-view .head');

        parent.find('.short-view').unbind('click').click(function () {
            var shortView = $(this);
            var messageId = shortView.attr('message_id');

            if (typeof messageId != 'undefined') {
                var parentWrap = shortView.closest('.message-wrap'),
                    fullView = parentWrap.find('.full-view'),
                    loader = shortView.find('.loader');

                if (!fullView.attr('loaded')) {
                    showConversationMessage(messageId, false, true);
                    shortView.addClass('loading');
                    loader.show();
                } else {
                    expandConversation(messageId);
                }
            }
        });

        fullView.addClass('pointer');
        fullView.unbind('click').click(function (e) {
            if ('' != ASC.Mail.getSelectionText()) {
                return;
            }
            var el = $(e.target);
            if (el.is('.entity-menu') || el.is('.from') || el.is('.tag') || el.is('.tagDelete') || el.closest(".calendarView").length > 0) {
                return;
            }

            var messageId = $(this).parent().attr('message_id');

            if (typeof messageId != 'undefined') {
                collapseConversation(messageId);
            }
        });
    }

    function tuneNextPrev() {
        var anchor = ASC.Controls.AnchorController.getAnchor();
        var head = $('#MessageGroupButtons');
        head.show();
        var prevBtn = head.find(".btnPrev");
        var nextBtn = head.find(".btnNext");
        var cache = filterCache.getCache(MailFilter);

        if (mailBox.currentMessageId == cache.first) {
            prevBtn.toggleClass("unlockAction", false);
        } else {
            prevBtn.toggleClass("unlockAction", true);
        }

        if (mailBox.currentMessageId == cache.last) {
            nextBtn.toggleClass("unlockAction", false);
        } else {
            nextBtn.toggleClass("unlockAction", true);
        }

        prevBtn.off('click').on('click', function () {
            if (!$(this).hasClass("unlockAction"))
                return;

            ASC.Controls.AnchorController.move('#' + anchor + '/prev');
        });

        nextBtn.off('click').on('click', function () {
            if (!$(this).hasClass("unlockAction"))
                return;

            ASC.Controls.AnchorController.move('#' + anchor + '/next');
        });
    }

    function isComposeAction(action) {
        return action == 'reply' || action == 'replyAll' || action == 'forward' || action == 'draft';
    }

    function setComposeFocus(message) {
        //Set focus to 1st empty field
        wysiwygEditor.setFocus();
        wysiwygEditor.unbind(wysiwygEditor.events.OnFocus).bind(wysiwygEditor.events.OnFocus, function () {
            wysiwygEditor.unbind(wysiwygEditor.events.OnFocus);
            if (message.to === "" || jq.isArray(message.to) && message.to.length === 0) {
                $('#newmessageTo .emailselector-input').focus();
            } else if ($('#newmessageCopy:visible').length > 0 && (message.cc === "" || jq.isArray(message.cc) && message.cc.length === 0)) {
                $('#newmessageCopy .emailselector-input').focus();
            } else if ($('#newmessageBCC:visible').length > 0 && (message.bcc === "" || jq.isArray(message.bcc) && message.bcc.length === 0)) {
                $('#newmessageBCC .emailselector-input').focus();
            } else if ($('#newmessageSubject:visible').length > 0 && message.subject === "") {
                $('#newmessageSubject').focus();
            }
        });
    }

    function showComposeMessageCommon(message, action) {
        var title;
        switch (action) {
            case "reply":
            case "replyAll":
                title = window.MailScriptResource.PageHeaderReply;
                break;
            case "forward":
                title = window.MailScriptResource.PageHeaderForward;
                break;
            case "draft":
                title = window.MailScriptResource.PageHeaderDraft;
                break;
            case "compose":
                title = window.MailScriptResource.NewMessage;
                break;
            default:
                // ToDo: handle unknown action here
                return;
        }
        TMMail.setPageHeaderTitle(title);
        setWysiwygEditorValue(message, action);
        $("#editMessagePage").show();
        setEditMessageButtons();
        jq("#newmessageTo").AdvancedEmailSelector("init", {
            isInPopup: false,
            items: action !== "forward" ? message.to : "",
            onChangeCallback: function () {
                $('#newmessageTo').removeClass('invalidField');
                onMessageChanged();
            }
        });
        jq("#newmessageCopy").AdvancedEmailSelector("init", {
            isInPopup: false,
            items: message.cc,
            onChangeCallback: function () {
                $('#newmessageCopy').removeClass('invalidField');
                onMessageChanged();
            }
        });
        jq("#newmessageBCC").AdvancedEmailSelector("init", {
            isInPopup: false,
            items: message.bcc,
            onChangeCallback: function () {
                $('#newmessageBCC').removeClass('invalidField');
                onMessageChanged();
            }
        });
        if (message.cc.length > 0 || message.bcc.length > 0) {
            $(".value-group.cc").show();
            $(".value-group.bcc").show();
            $("#AddCopy:visible").remove();
        }

        $("#newmessageTo").trigger("input");
        $('#newmessageCopy').trigger('input');
        $('#newmessageBCC').trigger('input');

        setComposeFocus(message);
        setEditingMessage(message);
    }

    function showMessageCommon(message) {
        insertBody(message);
        updateMessageTags(message);
        initBlockContent(message);
        initIamgeZoom();
    }

    function pretreatmentConversationMessage(id, dropdownItemId) {
        var senderAddress = ASC.Mail.Utility.ParseAddress(getFromAddress(id)).email;
        var message = $('#itemContainer').find('.full-view[message_id="' + id + '"]');
        var menuHideImages = $("#" + dropdownItemId + " .alwaysHideImages");
        var menuViewMessage = $("#" + dropdownItemId + " .singleViewMail");
        var menuPersonalContact = $("#" + dropdownItemId + " .createPersonalContact");
        var menuCrmPerson = $("#" + dropdownItemId + " .createCrmPerson");
        var menuCrmCompany = $("#" + dropdownItemId + " .createCrmCompany");

        if (menuHideImages.length == 1) {
            if ($('#id_block_content_popup_' + id).length > 0) {
                menuHideImages.hide();
            } else {
                if (trustedAddresses.isTrusted(senderAddress)) {
                    menuHideImages.text(window.MailScriptResource.HideImagesLabel + ' "' + senderAddress + '"');
                    menuHideImages.show();
                } else {
                    menuHideImages.hide();
                }
            }
        }

        if (message.attr('is_single') == 'true') {
            menuViewMessage.hide();
        } else {
            menuViewMessage.show();
        }

        if (accountsManager.getAccountByAddress(senderAddress)) {
            menuCrmPerson.hide();
            menuCrmCompany.hide();
            menuPersonalContact.hide();
        } else {
            if (message.attr('is_crm') == 'true') {
                menuCrmPerson.hide();
                menuCrmCompany.hide();
            } else {
                menuCrmPerson.show();
                menuCrmCompany.show();
            }

            if (message.attr('is_personal') == 'true') {
                menuPersonalContact.hide();
            } else {
                menuPersonalContact.show();
            }
        }

    }

    function pretreatmentAttachments(id, dropdownItemId) {
        var dropdownItem = $("#" + dropdownItemId);
        if (dropdownItem.length == 0) {
            return;
        }

        var viewMenu = dropdownItem.find(".viewAttachment");
        var editMenu = dropdownItem.find(".editAttachment");
        var downloadMenu = dropdownItem.find(".downloadAttachment");
        var deleteMenu = dropdownItem.find(".deleteAttachment");
        var saveToDocsMenu = dropdownItem.find(".saveAttachmentToDocs");
        var saveToCalnedarMenu = dropdownItem.find(".saveAttachmentToCalendar");

        var menu = $('#itemContainer .attachments_list .entity-menu[data_id="' + id + '"]');
        var name = menu.attr('name');

        if (TMMail.pageIs('writemessage')) {
            deleteMenu.show();
        }

        if (TMMail.pageIs('writemessage')) {
            var attachment = AttachmentManager.GetAttachment(id);
            if (!attachment || attachment.fileId <= 0) {
                downloadMenu.hide();
                viewMenu.hide();
                editMenu.hide();
            } else {
                downloadMenu.show();
                editMenu.hide(); // No edit document in compose/draft/reply/replyAll/forward where delete_button is visible

                if (attachment.canView || attachment.isImage) {
                    viewMenu.show();
                } else {
                    viewMenu.hide();
                }
            }
        } else {
            downloadMenu.show();
            saveToDocsMenu.show();

            if (ASC.Mail.Constants.CALENDAR_AVAILABLE &&
                TMMail.canViewAsCalendar(name)) {
                saveToCalnedarMenu.show();
            } else {
                saveToCalnedarMenu.hide();
            }

            if (TMMail.canViewInDocuments(name) || ASC.Files.Utility.CanImageView(name) || TMMail.canViewAsCalendar(name)) {
                viewMenu.show();
            } else {
                viewMenu.hide();
            }

            if (!TMMail.canEditInDocuments(name)) {
                editMenu.hide();
            } else {
                editMenu.show();
            }
        }
    }

    function saveAttachmentToCalendar(id) {
        var fileName = $('#itemContainer .attachments_list .row[data_id="' + id + '"] .file-name').text();
        mailCalendar.exportAttachmentToCalendar(id, fileName);
    }

    function saveAttachmentToDocs(id) {
        var attachmentName = $('#itemContainer .attachments_list .row[data_id="' + id + '"] .file-name').text();

        ASC.Files.FileSelector.onSubmit = function (folderId) {
            var folderName = jq("#fileSelectorTree .selected[data-id='" + folderId + "']").prop("title");
            serviceManager.exportAttachmentToDocuments(id, folderId,
                { fileName: attachmentName, folderName: folderName },
                {
                    success: function (params) {
                        window.toastr.success(
                            window.MailScriptResource.SaveAttachmentToDocsSuccess
                                .replace('%file_name%', params.fileName)
                                .replace('%folder_name%', params.folderName));
                    },
                    error: onErrorExportAttachmentsToMyDocuments
                },
                ASC.Resources.Master.Resource.LoadingProcessing);
        };

        $('#filesFolderUnlinkButton').hide();

        ASC.Files.FileSelector.fileSelectorTree.resetFolder();
        ASC.Files.FileSelector.openDialog(null, true);
    }

    function editDocumentAttachment(id) {
        window.open(TMMail.getEditDocumentUrl(id), '_blank');
    }

    function downloadAttachment(id) {
        if (TMMail.pageIs('writemessage')) {
            var attachment = AttachmentManager.GetAttachment(id);
            if (attachment != null) {
                id = attachment.fileId;
            }
        }
        window.open(TMMail.getAttachmentDownloadUrl(id), 'Download');
    }

    function viewAttachment(id) {
        var name = $('#itemContainer .attachments_list .entity-menu[data_id="' + id + '"]').attr('name');
        if (ASC.Files.Utility.CanImageView(name)) {
            $('#itemContainer .attachments_list .row[data_id="' + id + '"] a').click();
        } else {
            if (TMMail.pageIs('writemessage')) {
                var attachment = AttachmentManager.GetAttachment(id);
                if (attachment != null) {
                    id = attachment.fileId;
                }
            }

            if (TMMail.canViewAsCalendar(name)) {
                var calendarUrl = TMMail.getAttachmentDownloadUrl(id);
                mailCalendar.showCalendarInfo(calendarUrl, name);
            } else
                window.open(TMMail.getViewDocumentUrl(id), '_blank');
        }
    }

    function deleteAttachment(id) {
        var deleteButton = $('#itemContainer .attachments_list .row[data_id="' + id + '"] .delete_attachment');
        if (deleteButton.length > 0) {
            deleteButton.click();
        }
    }

    function createNewCrmCompany(id) {
        createCrmContact('company', id);
    }

    function createNewCrmPerson(id) {
        createCrmContact('people', id);
    }

    function createCrmContact(type, id) {
        var from = getFromAddress(id);
        var addr = ASC.Mail.Utility.ParseAddress(from);
        var url = "../../products/crm/default.aspx?action=manage&type={0}&email={1}&fullname={2}"
            .format(type, encodeURIComponent(addr.email), encodeURIComponent(addr.name));

        var htmlTmpl = $.tmpl('crmLinkConfirmPopupTmpl');
        htmlTmpl.find('.buttons .createAndLink')
            .unbind('click')
            .bind('click', function () {
                window.contactsManager.forgetCrmContact(addr.email);
                url += "&linkMessageId={0}".format(id);
                popup.hide();
                window.open(url, "_blank");
            });

        htmlTmpl.find('.buttons .justCreate')
            .unbind('click')
            .bind('click', function () {
                window.contactsManager.forgetCrmContact(addr.email);
                popup.hide();
                window.open(url, "_blank");
            });

        popup.addBig(window.MailScriptResource.LinkConversationPopupHeader, htmlTmpl);
    }
    
    function createPersonalContact(id) {
        var fromAddress = ASC.Mail.Utility.ParseAddress(getFromAddress(id));
        var contact= {};
        contact.id = -1;
        contact.name = fromAddress.name || "";
        contact.description = "";
        contact.emails = [];
        contact.phones = [];
        contact.emails.push({ id: -1, isPrimary: true, value: fromAddress.email });
        editContactModal.show(contact, true);
    }

    function updateFromAccountField(selectedAccount) {
        if (selectedAccount === undefined) {
            var accounts = accountsManager.getAccountList();

            if (accounts.length != 0) {
                selectedAccount = accounts[0];
            }
            for (var i = 0; i < accounts.length; i++) {
                if (accounts[i].enabled) {
                    selectedAccount = accounts[i];
                    break;
                }
            }
            for (var i = 0; i < accounts.length; i++) {
                if (accounts[i].is_default) {
                    selectedAccount = accounts[i];
                    break;
                }
            }
        }
        if (selectedAccount === undefined || selectedAccount == null) {
            return;
        }

        selectFromAccount({}, {
            account: selectedAccount
        });
    }

    function getTags() {
        var res = [];
        $('#itemContainer .head .tags .value .itemTags .tagDelete').each(function (index, value) {
            res.push(parseInt($(value).attr('tagid')));
        });
        return res;
    }

    function hasTag(tagId) {
        return $('#itemContainer .head:visible .tags .value .itemTags .tagDelete[tagid="' + tagId + '"]').length;
    }

    function getFromAddress(messageId) {
        return $('#itemContainer .message-wrap[message_id="' + messageId + '"] .row .value .from').text();
    }

    function getToAddresses(messageId) {
        return $('#itemContainer .message-wrap[message_id="' + messageId + '"] .to-addresses').text();
    }

    function getMessageFolder(messageId) {
        return $('#itemContainer .message-wrap[message_id="' + messageId + '"]').attr("folder");
    }

    function getCurrentConversationIds() {
        var ids = [];
        if (!TMMail.pageIs('conversation')) {
            return undefined;
        } else {
            var messages = $('#itemContainer').find('.message-wrap');
            for (var i = 0; i < messages.length; i++) {
                ids.push($(messages[i]).attr('message_id'));
            }
        }
        return ids;
    }

    function setToEmailAddresses(emails) {
        toEmailAddresses = emails;
    }

    function bindAllAttachmentsCommonActions() {
        $('#itemContainer .attachments-buttons .exportAttachemntsToMyDocs')
            .unbind('click')
            .bind('click',
                function() {
                    var rootNode = $(this).closest('.attachments');
                    var messageId = rootNode.attr('message_id');
                    var attachmentsCount = rootNode.find('.row').length;
                    serviceManager.exportAllAttachmentsToMyDocuments(messageId, { count: attachmentsCount }, {
                        success: function(params, realCount) {
                            window.toastr.success(
                                window.MailScriptResource.SaveAllAttachmentsToMyDocsSuccess
                                .replace('%real_count%', realCount)
                                .replace('%count%', params.count));
                        },
                        error: onErrorExportAttachmentsToMyDocuments
                    }, ASC.Resources.Master.Resource.LoadingProcessing);
                });
    }

    function onErrorExportAttachmentsToMyDocuments() {
        window.toastr.error(window.MailScriptResource.SaveAttachmentsToDocumentsFailure);
    }

    function onMarkChainAsCrmLinked() {
        window.LoadingBanner.hideLoading();
        window.toastr.success(window.MailScriptResource.LinkConversationText);

        if (needCrmLink()) {
            crmContactsInfo = [];
        }

        if (messageIsSending) {
            sendMessage();
        }
    }

    function cancelSending() {
        window.LoadingBanner.hideLoading();
        window.AttachmentManager.Unbind(window.AttachmentManager.CustomEvents.UploadComplete, onAttachmentsUploadComplete);
        resetDirtyMessage();
        TMMail.disableButton($('#editMessagePage .btnSend'), false);
        TMMail.disableButton($('#editMessagePage .btnSave'), false);
        if (mailBox.currentMessageId > 0) {
            TMMail.disableButton($('#editMessagePage .btnDelete'), false);
            TMMail.disableButton($('#editMessagePage .btnAddTag'), false);
        }
    }

    function closeCompose() {
        var lastAnchor = ASC.Controls.AnchorController.getLastAnchor();
        if (!lastAnchor) {
            lastAnchor = "inbox";
        }
        window.location.href = "#" + lastAnchor;
    }

    return {
        init: init,
        hide: hide,
        view: view,
        conversation: conversation,
        edit: edit,
        compose: compose,
        composeTo: composeTo,
        reply: reply,
        replyAll: replyAll,
        forward: forward,
        onLeaveMessage: onLeaveMessage,
        deleteMessageAttachment: deleteMessageAttachment,
        deleteCurrentMessage: deleteCurrentMessage,
        sendMessage: sendMessage,
        saveMessage: saveMessage,
        isMessageDirty: isMessageDirty,
        isMessageSending: isMessageSending,
        resetDirtyMessage: resetDirtyMessage,
        setDirtyMessage: setDirtyMessage,
        setTag: setTag,
        unsetTag: unsetTag,
        getTags: getTags,
        hasTag: hasTag,
        onCompose: onCompose,
        onComposeTo: onComposeTo,
        onComposeFromCrm: onComposeFromCrm,
        getFromAddress: getFromAddress,
        getToAddresses: getToAddresses,
        getMessageFolder: getMessageFolder,
        isSortConversationByAsc: isSortConversationByAsc,
        getCurrentConversationIds: getCurrentConversationIds,
        getActualConversationLastMessageId: getActualConversationLastMessageId,
        initImageZoom: initIamgeZoom,
        updateFromSelected: updateFromSelected,
        setToEmailAddresses: setToEmailAddresses,
        conversation_moved: conversationMoved,
        conversation_deleted: conversationDeleted,
        setHasLinked: setHasLinked,
        updateAttachmentsActionMenu: updateAttachmentsActionMenu,
        updateEditAttachmentsActionMenu: updateEditAttachmentsActionMenu,
        editDocumentAttachment: editDocumentAttachment,
        selectFromAccount: selectFromAccount,
        refreshMailAfterSent: refreshMailAfterSent,
        preprocessMessages: preprocessMessages,
        sendAction: sendAction,
        updateFromAccountField: updateFromAccountField,
        cancelSending: cancelSending,
        saveMessagePomise: saveMessagePomise,
        closeCompose: closeCompose
    };

})(jQuery);