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


window.accountsPage = (function($) {
    var isInit = false,
        $page,
        buttons = [];

    var init = function() {
        if (isInit === false) {
            isInit = true;

            $page = $('#id_accounts_page');

            $page.find('#createNewMailbox').click(function () {
                accountsModal.addMailbox();
            });

            $page.find('#createNewAccount').click(function() {
                accountsModal.addBox();
            });

            buttons = [
                { selector: "#accountActionMenu .activateAccount", handler: activate },
                { selector: "#accountActionMenu .deactivateAccount", handler: deactivate },
                { selector: "#accountActionMenu .selectAttachmentsFolder", handler: selectAttachmentsFolder },
                { selector: "#accountActionMenu .setMailAutoreply", handler: setMailAutoreply },
                { selector: "#accountActionMenu .editAccount", handler: editAccount },
                { selector: "#accountActionMenu .deleteAccount", handler: removeAccount }];

            var additionalButtonHtml = $.tmpl('fileSelectorMailAdditionalButton');
            $('#fileSelectorAdditionalButton').replaceWith(additionalButtonHtml);
        }
    };

    var show = function() {
        if (checkEmpty()) {
            $page.hide();
        } else {
            $page.show();
        }
    };

    var hide = function() {
        $page.hide();
    };

    function clear() {
        var accountsRows = $page.find('.accounts_list');
        $('#accountActionMenu').hide();
        if (accountsRows) {
            accountsRows.remove();
        }
    }

    var refreshAccount = function (accountName, isActivate) {
        var account = accountsManager.getAccountByAddress(accountName);
        if (!account)
            return;

        var accountListLength = accountsManager.getAccountList().length,
            showSetDefaultIcon = accountListLength > 1,
            tmplName = 'mailboxItemTmpl';

        if (account.is_alias)
            tmplName = 'aliasItemTmpl';
        else if (account.is_group)
            return;

        var html = $.tmpl(tmplName, {
                email: account.email,
                enabled: isActivate,
                autoreply: account.autoreply,
                isDefault: account.is_default,
                oAuthConnection: account.oauth,
                isTeamlabMailbox: account.is_teamlab,
                aliases: [],
                mailboxId: account.mailbox_id
            }, { showSetDefaultIcon: showSetDefaultIcon, now: new Date() }),
            $html = $(html);

        $html.actionMenu('accountActionMenu', buttons, pretreatment);

        var accountDiv = $page.find('tr[data_id="' + accountName + '"]');
        if (!accountDiv)
            return;

        accountDiv.replaceWith($html);

        $html.find('.default_account_icon_block').on("click", setDefaultButtonClickEvent);

        if (showSetDefaultIcon) {
            $('.accounts_list .item-row').each(function() {
                var $this = $(this),
                    html = $.tmpl('setDefaultIconItemTmpl', { isDefault: false });
                if (!$this.children(":first").hasClass('default_account_button_column')) {
                    $this.prepend(html);
                    $(html).find('.set_as_default_account_icon').on("click", setDefaultButtonClickEvent);
                }
            });
        }
    };

    var addAccount = function (accountName, autoreply, enabled, oauth, isTeamlab) {
        accountName = accountName.toLowerCase();
        if (!isContain(accountName)) {
            var accountListLength = accountsManager.getAccountList().length,
                showSetDefaultIcon = accountListLength > 1,
                addSetDefaultIcon = accountListLength == 1,
                html = $.tmpl('mailboxItemTmpl', {
                        email: accountName,
                        enabled: enabled,
                        isDefault: false,
                        oAuthConnection: oauth,
                        isTeamlabMailbox: isTeamlab,
                        autoreply: autoreply,
                        aliases: []
                }, { showSetDefaultIcon: showSetDefaultIcon, now: new Date() }),
                $html = $(html);

            $html.actionMenu('accountActionMenu', buttons, pretreatment);
            $('#common_mailboxes').append($html);
            $html.find('.default_account_icon_block').on("click", setDefaultButtonClickEvent);

            if (addSetDefaultIcon) {
                $('.accounts_list .item-row').each(function () {
                    var $this = $(this);
                    if (!$this.children(":first").hasClass('default_account_button_column')) {
                        var html = $.tmpl('setDefaultIconItemTmpl', { isDefault: false });
                        $this.prepend(html);
                        $(html).find('.set_as_default_account_icon').on("click", setDefaultButtonClickEvent);
                    }
                });
            }
        }
        if (TMMail.pageIs('accounts') && !checkEmpty()) {
            $page.show();
        }
    };

    var deleteAccount = function(id) {
        $page.find('tr[data_id="' + id + '"]').remove();
        if (checkEmpty() && TMMail.pageIs('accounts')) {
            $page.hide();
        }
        var removeSetDefaultIcon = accountsManager.getAccountList().length == 2;
        if (removeSetDefaultIcon) {
            $('.accounts_list .item-row').each(function () {
                var $this = $(this);
                $this.find('.default_account_icon_block').off("click");
                $this.find('.default_account_button_column').remove();
            });
        }
    };

    var activateAccount = function(accountName, isActivate) {
        refreshAccount(accountName, isActivate);
    };

    var pretreatment = function(id) {
        if ($page.find('tr[data_id="' + id + '"]').hasClass('disabled')) {
            $("#accountActionMenu .activateAccount").show();
            $("#accountActionMenu .deactivateAccount").hide();
        } else {
            $("#accountActionMenu .activateAccount").hide();
            $("#accountActionMenu .deactivateAccount").show();
        }

        var account = accountsManager.getAccountByAddress(id);
        if (account.is_teamlab) {
            $("#accountActionMenu .editAccount").hide();

            if (!account.is_shared_domain && !Teamlab.profile.isAdmin) {
                $("#accountActionMenu .deleteAccount").addClass('disable');
                $("#accountActionMenu .deleteAccount").attr('title', MailScriptResource.ServerMailboxNotificationText);
            } else {
                $("#accountActionMenu .deleteAccount").removeClass('disable');
                $("#accountActionMenu .deleteAccount").removeAttr('title');
            }
        } else {
            $("#accountActionMenu .editAccount").show();
            $("#accountActionMenu .deleteAccount").removeClass('disable');
            $("#accountActionMenu .deactivateAccount").removeAttr('title');
            $("#accountActionMenu .editAccount").removeAttr('title');
            $("#accountActionMenu .deleteAccount").removeAttr('title');
        }
    };

    var activate = function(id) {
        accountsModal.activateAccount(id, true);
    };

    var deactivate = function(id) {
        accountsModal.activateAccount(id, false);
    };

    var selectAttachmentsFolder = function(email) {
        var account = window.accountsManager.getAccountByAddress(email);
        ASC.Files.FileSelector.onSubmit = function(folderId) {
            serviceManager.setEMailInFolder(
                account.mailbox_id, folderId,
                { id: account.mailbox_id, emailInFolder: folderId, resetFolder: false },
                { error: onErrorSetEMailInFolder },
                ASC.Resources.Master.Resource.LoadingProcessing);
        };

        $('#filesFolderUnlinkButton').unbind('click').bind('click', { account: account }, unselectAttachmentsFolder);

        ASC.Files.FileSelector.fileSelectorTree.resetFolder();
        if (account.emailInFolder == null) {
            ASC.Files.FileSelector.openDialog(null, true);
            $('#filesFolderUnlinkButton').show().toggleClass('disable', true);
        } else {
            ASC.Files.FileSelector.openDialog(account.emailInFolder, true);
            $('#filesFolderUnlinkButton').show().toggleClass('disable', false);
        }
    };

    var unselectAttachmentsFolder = function(event) {
        if ($(this).hasClass('disable')) {
            return;
        }

        var account = event.data.account;
        serviceManager.setEMailInFolder(
            account.mailbox_id, null,
            { id: account.mailbox_id, emailInFolder: null, resetFolder: true },
            { error: onErrorResetEMailInFolder },
            ASC.Resources.Master.Resource.LoadingProcessing);
    };

    var setMailAutoreply = function (event) {
        var account = accountsManager.getAccountByAddress(event),
            html = $.tmpl("mailAutoreplyTmpl", {
                turnOn: account.autoreply.turnOn,
                onlyContacts: account.autoreply.onlyContacts,
                turnOnToDate: account.autoreply.turnOnToDate,
                subject: account.autoreply.subject
            }),
            config = {
                toolbar: 'MailSignature',
                removePlugins: 'resize, magicline',
                filebrowserUploadUrl: 'fckuploader.ashx?newEditor=true&esid=mail',
                height: 200,
                startupFocus: true,
                on: {
                    instanceReady: function (instance) {
                        instance.editor.setData(account.autoreply.html);
                    }
                }
            };

        html.find('#ckMailAutoreplyEditor').ckeditor(config);

        popup.addBig(window.MailScriptResource.MailAutoreplyLabel, html, undefined, false, { bindEvents: false });

        var $autoreplyStartDate = $('#autoreplyStartDate'),
            $autoreplyDueDate = $('#autoreplyDueDate'),
            $mailAutoreplyFromDate = $('.mail_autoreply_from_date'),
            $mailAutoreplyToDate = $('.mail_autoreply_to_date'),
            $turnOnToDateFlag = $('#turnOnToDateFlag');

        html.find('.buttons .ok').unbind('click').bind('click', function () {
            if ($('#ckMailAutoreplyEditor').val() == "") {
                ShowRequiredError($('#MailAutoreplyWYSIWYGEditor'));
            } else {
                RemoveRequiredErrorClass($('#MailAutoreplyWYSIWYGEditor'));
            }
            if (!$mailAutoreplyFromDate.hasClass('requiredFieldError') &&
                !$mailAutoreplyToDate.hasClass('requiredFieldError') &&
                !$('.mail_autoreply_body').hasClass('requiredFieldError')) {
                updateAutoreply(account);
                return false;
            }
        });

        $turnOnToDateFlag.off('change').on('change', function () {
            var $this = $(this);
            if ($this[0].checked) {
                $autoreplyDueDate.datepicker('option', 'disabled', false);
                changeAutoreplyDueDate($autoreplyDueDate.val());
            } else {
                $autoreplyDueDate.datepicker('option', 'disabled', true);
                $mailAutoreplyToDate.removeClass('requiredFieldError');
                checkDate($.trim($autoreplyStartDate.val()), $mailAutoreplyFromDate);
            }
        });

        $autoreplyStartDate.mask(ASC.Resources.Master.DatePatternJQ);
        $autoreplyDueDate.mask(ASC.Resources.Master.DatePatternJQ);
        $autoreplyStartDate.off('change').on('change', function () {
            var fromDateString = $.trim($(this).val()),
                toDateString = $.trim($('#autoreplyDueDate').val()),
                fromDate = $autoreplyStartDate.datepicker('getDate'),
                toDate = $autoreplyDueDate.datepicker('getDate');

            checkDate($.trim($(this).val()), $mailAutoreplyFromDate);

            if ($.isDateFormat(fromDateString) && $.isDateFormat(toDateString)) {
                if (fromDate > toDate && $turnOnToDateFlag[0].checked) {
                    $mailAutoreplyFromDate.addClass('requiredFieldError');
                } else {
                    $mailAutoreplyToDate.removeClass('requiredFieldError');
                    $mailAutoreplyFromDate.removeClass('requiredFieldError');
                }
            }
        });
        $autoreplyStartDate.keyup(function () {
            checkDate($.trim($(this).val()), $mailAutoreplyFromDate);
        });

        $autoreplyDueDate.off('change').on('change', function () { changeAutoreplyDueDate($(this).val()); });
        $autoreplyDueDate.keyup(function () {
            var fromDateString = $.trim($('#autoreplyStartDate').val()),
                toDateString = $.trim($(this).val());
            if (toDateString != '') {
                checkDate(toDateString, $mailAutoreplyToDate);
            } else {
                $mailAutoreplyToDate.removeClass('requiredFieldError');
                if (fromDateString != '') {
                    checkDate(fromDateString, $mailAutoreplyFromDate);
                }
            }
        });
        $autoreplyStartDate.datepicker({ minDate: 0 });
        $autoreplyDueDate.datepicker({ minDate: 0 });
        
        if ($.trim(account.autoreply.toDate) != '' && $.trim(account.autoreply.fromDate) != '') {
            var toDate = new Date(account.autoreply.toDate),
                toDateUtc = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()),
                fromDate = new Date(account.autoreply.fromDate),
                fromDateUtc = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
            if (fromDateUtc.getYear() == 1 && fromDateUtc.getMonth() == 0 && fromDateUtc.getDate() == 1 &&
                toDateUtc.getYear() == 1 && toDateUtc.getMonth() == 0 && toDateUtc.getDate() == 1) {
                toDateUtc = new Date();
                toDateUtc.setDate(toDateUtc.getDate() + 7);
            }
            $autoreplyDueDate.datepicker('setDate', toDateUtc);
            if ((fromDateUtc.getYear() != 1 || fromDateUtc.getMonth() != 0 || fromDateUtc.getDate() != 1) &&
                toDateUtc.getYear() == 1 && toDateUtc.getMonth() == 0 && toDateUtc.getDate() == 1) {
                $autoreplyDueDate.datepicker('setDate', '');
            }
        }
        if (!$turnOnToDateFlag[0].checked) {
            $autoreplyDueDate.datepicker("option", "disabled", true);
        }
        if ($.trim(account.autoreply.fromDate) != '') {
            var fromDate = new Date(account.autoreply.fromDate),
                fromDateUtc = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
            if (fromDateUtc.getYear() == 1 && fromDateUtc.getMonth() == 0 && fromDateUtc.getDate() == 1) {
                fromDateUtc = new Date();
            }
            $autoreplyStartDate.datepicker('setDate', fromDateUtc);
        }
    };

    function changeAutoreplyDueDate(toDateStr) {
        var $autoreplyStartDate = $('#autoreplyStartDate'),
            $autoreplyDueDate = $('#autoreplyDueDate'),
            $mailAutoreplyFromDate = $('.mail_autoreply_from_date'),
            $mailAutoreplyToDate = $('.mail_autoreply_to_date'),
            fromDateString = $.trim($autoreplyStartDate.val()),
            toDateString = $.trim(toDateStr),
            fromDate = $autoreplyStartDate.datepicker('getDate'),
            toDate = $autoreplyDueDate.datepicker('getDate');
        if (toDateString != '') {
            checkDate(toDateString, $mailAutoreplyToDate);
            if ($.isDateFormat(fromDateString) && $.isDateFormat(toDateString)) {
                if (fromDate > toDate) {
                    $mailAutoreplyToDate.addClass('requiredFieldError');
                } else {
                    $mailAutoreplyToDate.removeClass('requiredFieldError');
                    $mailAutoreplyFromDate.removeClass('requiredFieldError');
                }
            }
        } else {
            $mailAutoreplyToDate.removeClass('requiredFieldError');
            if (fromDateString != "") {
                checkDate(fromDateString, $mailAutoreplyFromDate);
            }
        }
    }

    function checkDate(dateString, mailAutoreplyDate) {
        var $mailAutoreplyDate = $(mailAutoreplyDate);
        if ($.isDateFormat(dateString)) {
            $mailAutoreplyDate.removeClass('requiredFieldError');
            return true;
        } else {
            $mailAutoreplyDate.addClass('requiredFieldError');
            return false;
        }
    }

    function turnAutoreply(email, turnOn) {
        var account = accountsManager.getAccountByAddress(email);
        account.turnOn = turnOn;
        serviceManager.updateMailboxAutoreply(account.mailbox_id, account.turnOn, account.autoreply.onlyContacts,
            account.autoreply.turnOnToDate, account.autoreply.fromDate, account.autoreply.toDate,
            account.autoreply.subject, account.autoreply.html, { id: account.mailbox_id },
            { error: window.accountsModal.hideLoader }, ASC.Resources.Master.Resource.LoadingProcessing);
    }

    function updateAutoreply(account) {
        var turnOn = $('#turnAutoreplyFlag')[0].checked,
            onlyContacts = $('#onlyContactsFlag')[0].checked,
            turnOnToDate = $('#turnOnToDateFlag')[0].checked,
            fromDate = $('#autoreplyStartDate').datepicker('getDate'),
            toDate = $('#autoreplyDueDate').datepicker('getDate'),
            subject = $('#autoreplySubject').val(),
            html = $('#ckMailAutoreplyEditor').val();

        fromDate = Teamlab.serializeTimestamp(fromDate);
        toDate = Teamlab.serializeTimestamp(toDate);
        serviceManager.updateMailboxAutoreply(account.mailbox_id, turnOn, onlyContacts,
            turnOnToDate, fromDate, toDate, subject, html, { id: account.mailbox_id },
            { error: window.accountsModal.hideLoader }, ASC.Resources.Master.Resource.LoadingProcessing);
    }

    function onErrorResetEMailInFolder() {
        window.toastr.error(window.MailScriptResource.ResetAccountEMailInFolderFailure);
    }

    function onErrorSetEMailInFolder() {
        window.toastr.error(window.MailScriptResource.SetAccountEMailInFolderFailure);
    }

    var editAccount = function(id) {
        accountsModal.editBox(id);
    };

    var removeAccount = function(id) {
        accountsModal.removeBox(id);
    };

    var isContain = function(accountName) {
        var account = $page.find('tr[data_id="' + accountName + '"]');
        return (account.length > 0);
    };

    var checkEmpty = function() {
        if ($page.find('.accounts_list tr').length) {
            $page.find('.accounts_list').show();
            blankPages.hide();
            return false;
        } else {
            blankPages.showEmptyAccounts();
            return true;
        }
    };

    function setDefaultButtonClickEvent() {
        var $this = $(this),
            accountName = $this.parent().parent().attr('data_id'),
            account = accountsManager.getAccountByAddress(accountName);

        if (!account)
            return;

        if (!account.enabled) {
            function setDefailt() {
                $('#id_accounts_page .accounts_list .row[data_id="' + accountName + '"] .set_as_default_account_icon').click();
            }

            accountsModal.activateAccount(accountName, true, setDefailt);
        } else
            setDefaultButtonClick($this);
    }

    function setDefaultButtonClick($defaultAccountIcon) {
        var $this = $($defaultAccountIcon),
            $defaultAccountIconBlock = $('.default_account_icon_block'),
            accountName = $this.parent().parent().attr('data_id');

        if ($this.hasClass('set_as_default_account_icon')) {
            $defaultAccountIconBlock.prop('title', MailScriptResource.SetAsDefaultAccountText);
            $defaultAccountIconBlock.removeClass('default_account_icon');
            $defaultAccountIconBlock.addClass('set_as_default_account_icon');
            $this.prop('title', MailScriptResource.DefaultAccountText);
            $this.addClass('default_account_icon');
            $this.removeClass('set_as_default_account_icon');
            accountsModal.setDefaultAccount(accountName, true);
            accountsManager.setDefaultAccount(accountName, true);
            toastr.success(MailScriptResource.DefaultAccountText + " <b>{0}</b>".format(accountName));
        }
    }

    function setDefaultAccountIfItDoesNotExist() {
        if ($('.default_account_icon').length == 0) {
            var $defaultAccountIcon = $('.set_as_default_account_icon'),
                email = undefined,
                account = undefined;
            if ($defaultAccountIcon.length > 0) {
                for (var i = 0; i < $defaultAccountIcon.length; i++) {
                    email = $($defaultAccountIcon[i]).parent().parent('.item-row').attr('data_id');
                    account = accountsManager.getAccountByAddress(email);
                    if (account.enabled) {
                        setDefaultButtonClick($defaultAccountIcon[i]);
                        return;
                    }
                }
                setDefaultButtonClick($defaultAccountIcon[0]);
            }
        }
    }

    function loadAccounts(accounts) {
        var commonMailboxes = [],
            serverMailboxes = [],
            aliases = [],
            groups = [],
            index, length;

        clear();

        for (index = 0, length = accounts.length; index < length; index++) {
            if (accounts[index].isGroup) {
                groups.push(accounts[index]);
            } else if (accounts[index].isAlias) {
                aliases.push(accounts[index]);
            } else if (accounts[index].isTeamlabMailbox) {
                serverMailboxes.push(accounts[index]);
            } else {
                commonMailboxes.push(accounts[index]);
            }
        }

        serverMailboxes.forEach(function(mailbox) {
            mailbox.aliases = [];
            for (index = 0, length = aliases.length; index < length; index++) {
                if (aliases[index].mailboxId == mailbox.mailboxId) {
                    mailbox.aliases.push(aliases[index]);
                    aliases[index].realEmail = mailbox.email;
                }
            }
        });

        var html = $.tmpl('accountsTmpl',
            {
                common_mailboxes: commonMailboxes,
                server_mailboxes: serverMailboxes,
                aliases: aliases,
                groups: groups,
                showSetDefaultIcon: commonMailboxes.length + serverMailboxes.length + aliases.length > 1
            });

        var $html = $(html);
        $('#id_accounts_page .containerBodyBlock .content-header').after($html);
        $('#id_accounts_page').actionMenu('accountActionMenu', buttons, pretreatment);
        $('.default_account_icon_block').on("click", setDefaultButtonClickEvent);
        serverMailboxes.forEach(function(mailbox) {
            if (mailbox.aliases.length > 1) {
                var items = [];
                for (index = 1, length = mailbox.aliases.length; index < length; index++) {
                    items.push({ 'text': mailbox.aliases[index].email, 'disabled': true });
                }
                $('#id_accounts_page').find('.row[data_id="' +
                    mailbox.email + '"] .more-aliases').actionPanel({ 'buttons': items });
            }
        });
    }

    return {
        init: init,

        show: show,
        hide: hide,

        addAccount: addAccount,
        deleteAccount: deleteAccount,
        activateAccount: activateAccount,
        turnAutoreply: turnAutoreply,
        isContain: isContain,
        clear: clear,
        loadAccounts: loadAccounts,
        setDefaultAccountIfItDoesNotExist: setDefaultAccountIfItDoesNotExist
    };
})(jQuery);