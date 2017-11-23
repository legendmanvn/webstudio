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
 * form is not reasonably feasible for technical reasons, you must include the words 'Powered by ONLYOFFICE' 
 * in every copy of the program you distribute. 
 * Pursuant to Section 7 § 3(e) we decline to grant you any rights under trademark law for use of our trademarks.
 *
*/


window.SmtpSettingsView = function ($) {
    var $view,
        $settingsSwitch,
        $customSettingsRadio,
        $mailserverSettingsRadio,
        $customSettingsBox,
        $mailserverSettingsBox,
        currentSettings,
        server,
        domains = [],
        buttonsIds =
        {
            "save": "saveSettingsBtn",
            "restore": "saveDefaultCustomSettingsBtn",
            "test": "sendTestMailBtn",
            "switchCustom": "customSettingsRadio",
            "switchMserver": "mailserverSettingsRadio"
        },
        isDefault;

    function generatePassword() {
        var lowercase = "abcdefghijklmnopqrstuvwxyz",
            uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            numbers = "0123456789",
            specials = "_";

        var all = lowercase + uppercase + numbers + specials;

        function generate() {
            var password = "";

            password += pick(lowercase, 1);
            password += pick(uppercase, 1);
            password += pick(numbers, 1);
            password += pick(specials, 1);
            password += pick(all, 3, 8);

            password = shuffle(password);

            password = pick(uppercase, 1) + password;

            return password;
        }

        function pick(str, min, max) {
            var n;
            var chars = "";

            if (typeof max === "undefined") {
                n = min;
            } else {
                n = min + Math.floor(Math.random() * (max - min));
            }

            for (var i = 0; i < n; i++) {
                chars += str.charAt(Math.floor(Math.random() * str.length));
            }

            return chars;
        }

        function shuffle(str) {
            var chars = str.split("");
            var tempChar;
            var currentChar;
            var topChar = chars.length;

            if (topChar) {
                while (--topChar) {
                    currentChar = Math.floor(Math.random() * (topChar + 1));
                    tempChar = chars[currentChar];
                    chars[currentChar] = chars[topChar];
                    chars[topChar] = tempChar;
                }
            }

            return chars.join("");
        }

        return generate();
    }

    function currentHostUseMailserver() {
        return window.SmtpSettingsConstants.IsMailServerAvailable && server && server.dns.mxRecord.host === currentSettings.Host;
    }

    function saveCurrentSettings(settings) {
        currentSettings = settings;
        if (currentSettings && currentSettings.Port && typeof (currentSettings.Port) === "string")
            currentSettings.Port = parseInt(currentSettings.Port);
    }

    function init() {
        window.LoadingBanner.displayLoading();

        initElements();
        bindEvents();

        saveCurrentSettings(getInitCurrentSettings());

        if (!window.SmtpSettingsConstants.IsMailServerAvailable) {
            renderView();
            window.LoadingBanner.hideLoading();
            return;
        }

        window.async.parallel([
            function (cb) {
                window.Teamlab.getMailServer(null, {
                    success: function (params, res) {
                        if (res && res.id) {
                            server = res;
                            cb(null);
                        } else {
                            cb("mailserver does not exist");
                        }
                    },
                    error: function () {
                        cb(null);
                    }
                });
            },
            function (cb) {
                window.Teamlab.getMailDomains(null, {
                    success: function (params, res) {
                        domains = res;
                        cb(null);
                    },
                    error: function () {
                        // ignore
                        cb(null);
                    }
                });
            }
        ], function (err) {
            if (err) {
                toastr.error(err);
            } else {
                renderView();
            }

            window.LoadingBanner.hideLoading();
        });
    }

    function initElements() {
        $view = $("#smtpSettingsView");
        $settingsSwitch = $view.find("#settingsSwitch");
        $customSettingsRadio = $settingsSwitch.find("#customSettingsRadio");
        $mailserverSettingsRadio = $settingsSwitch.find("#mailserverSettingsRadio");
        $customSettingsBox = $view.find("#customSettingsBox");
        $mailserverSettingsBox = $view.find("#mailserverSettingsBox");
    }

    function bindEvents() {
        $customSettingsRadio.on("change", $.proxy(switchToCustomSettingsBox, this));
        $mailserverSettingsRadio.on("change", $.proxy(switchToMailserverSettingsBox, this));
        $customSettingsBox.on("change", "#customSettingsAuthenticationRequired", changeSettingsAuthenticationRequired);

        $view.find("#saveSettingsBtn").unbind("click").bind("click", function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (!$(this).hasClass("disable"))
                saveSettings();

            return false;
        });
        $view.find("#saveDefaultCustomSettingsBtn").unbind("click").bind("click", function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (!$(this).hasClass("disable"))
                restoreDefaults();

            return false;
        });
        $view.find("#sendTestMailBtn").unbind("click").bind("click", function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (!$(this).hasClass("disable"))
                sendTestMail();

            return false;
        });

        AjaxPro.onError = function (e) {
            hideLoader();
            LoadingBanner.showMesInfoBtn("#smtpSettingsView", e && e.Message ? e.Message : ASC.Resources.Master.Resource.OperationFailedMsg, "error");
            console.error("SmtpSettingsView: AjaxPro.onError", e);
        }

        AjaxPro.onTimeout = function () {
            hideLoader();
            LoadingBanner.showMesInfoBtn("#smtpSettingsView", ASC.Resources.Master.Resource.OperationFailedMsg, "error");
            console.error("SmtpSettingsView: AjaxPro.onTimeout", arguments);
        }
    }

    function bindChanges() {
        $("#smtpSettingsView input")
            .off('input')
            .on('input',
                function() {
                    setupButtons($customSettingsRadio.prop("checked"));
                });

        $("#smtpSettingsView select, #smtpSettingsView input[type=\"checkbox\"]")
            .off("change")
            .on("change",
                function() {
                    setupButtons($customSettingsRadio.prop("checked"));
                });
    }

    function renderView() {
        if (currentHostUseMailserver()) {
            renderCustomSettingsBox(getEmptyCustomSettings());
            renderMailserverSettingsBox(currentSettings);
            switchToMailserverSettingsBox();
        } else {
            renderCustomSettingsBox(currentSettings);
            renderMailserverSettingsBox(getEmptyCustomSettings());
            switchToCustomSettingsBox();
        }

        if (server) {
            $settingsSwitch.show();
        }
        $view.show();
    }

    function renderCustomSettingsBox(settings) {
        var html = $customSettingsBox.siblings("#customSettingsBoxTmpl").tmpl(settings);
        $customSettingsBox.html(html);
        changeSettingsAuthenticationRequired();
    }

    function renderMailserverSettingsBox(settings) {
        var customDomains = [];
        for (var i = 0; i < domains.length; i++) {
            if (!domains[i].isSharedDomain) {
                customDomains.push(domains[i]);
            }
        }

        var html = $mailserverSettingsBox.siblings("#mailserverSettingsBoxTmpl").tmpl(
            {
                domains: customDomains,
                login: settings.CredentialsUserName || "",
                password: settings.CredentialsUserPassword || "",
                senderDisplayName: settings.SenderDisplayName || ""
            });
        $mailserverSettingsBox.html(html);
    }

    function setupButtons(forCustom) {
        var showBtnIds = [],
            hideBtnIds = [];

        if (forCustom) {
            if (equalsSettings(getCustomSettings(false), currentSettings)) {
                hideBtnIds.push(buttonsIds.save);
            } else {
                showBtnIds.push(buttonsIds.save);
            }

            if (isDefault) {
                hideBtnIds.push(buttonsIds.restore);
            } else {
                showBtnIds.push(buttonsIds.restore);
            }

            showBtnIds.push(buttonsIds.test);
        } else {
            var msSettings = getMailServerSettings(false);

            if (msSettings.login.length === 0) {
                hideBtnIds.push(buttonsIds.test);
                hideBtnIds.push(buttonsIds.save);
            }
            else if (((msSettings.login + "@" + msSettings.domain) === currentSettings.SenderAddress) &&
                msSettings.senderDisplayName === currentSettings.SenderDisplayName) {
                hideBtnIds.push(buttonsIds.save);
                showBtnIds.push(buttonsIds.test);
            } else {
                showBtnIds.push(buttonsIds.save);
                if(currentHostUseMailserver())
                    showBtnIds.push(buttonsIds.test);
            }

            if (isDefault)
                hideBtnIds.push(buttonsIds.restore);
            else
                showBtnIds.push(buttonsIds.restore);
        }

        disableButtonsByIds(hideBtnIds, true);
        disableButtonsByIds(showBtnIds, false);
    }

    function switchToCustomSettingsBox() {
        $mailserverSettingsRadio.prop("checked", false);
        $customSettingsRadio.prop("checked", true);
        $mailserverSettingsBox.hide();
        $customSettingsBox.show();

        setupButtons(true);
        bindChanges();
    }

    function switchToMailserverSettingsBox() {
        $customSettingsRadio.prop("checked", false);
        $mailserverSettingsRadio.prop("checked", true);
        $customSettingsBox.hide();
        $mailserverSettingsBox.show();

        setupButtons(false);
        bindChanges();
    }

    function changeSettingsAuthenticationRequired() {
        var checked = $customSettingsBox.find("#customSettingsAuthenticationRequired").is(":checked"),
            $loginEl = $customSettingsBox.find(".host-login"),
            $passwordEl = $customSettingsBox.find(".host-password");

        $loginEl.find(".textEdit").attr("disabled", !checked);
        $passwordEl.find(".textEdit").attr("disabled", !checked);

        $loginEl.toggleClass('requiredField', checked);
        $passwordEl.toggleClass('requiredField', checked);

        if (!checked) {
            $loginEl.toggleClass('requiredFieldError', false);
            $passwordEl.toggleClass('requiredFieldError', false);
        }

    }

    function disableButton(btnId, disable) {
        var $btn = $view.find("#" + btnId);
        if (!$btn)
            return;

        $btn.toggleClass("disable", disable).attr('disabled', disable);
    }

    function blockControls(disable) {
        disableButtonsByIds([
            buttonsIds.save,
            buttonsIds.restore,
            buttonsIds.test,
            buttonsIds.switchCustom,
            buttonsIds.switchMserver
        ], disable);
        var $senderNameEl;
        var $senderAddressEl;
        if ($customSettingsRadio.prop("checked")) {
            $senderNameEl = $customSettingsBox.find(".display-name .textEdit");
            $senderAddressEl = $customSettingsBox.find(".email-address .textEdit");
            var $hostEl = $customSettingsBox.find(".host .textEdit"),
                $portEl = $customSettingsBox.find(".port .textEdit"),
                $authCheckbox = $customSettingsBox.find("#customSettingsAuthenticationRequired"),
                $loginEl = $customSettingsBox.find(".host-login .textEdit"),
                $passwordEl = $customSettingsBox.find(".host-password .textEdit"),
                $sslCheckbox = $customSettingsBox.find("#customSettingsEnableSsl");

            $hostEl.attr("disabled", disable);
            $portEl.attr("disabled", disable);
            $authCheckbox.attr("disabled", disable);

            $loginEl.attr("disabled", disable);
            $passwordEl.attr("disabled", disable);

            $senderNameEl.attr("disabled", disable);
            $senderAddressEl.attr("disabled", disable);

            $sslCheckbox.attr("disabled", disable);

            if (!disable)
                changeSettingsAuthenticationRequired();
        } else {
            $senderNameEl = $mailserverSettingsBox.find(".display-name .textEdit");
            $senderAddressEl = $mailserverSettingsBox.find(".email-address .textEdit");
            var $domainSelectEl = $mailserverSettingsBox.find("#notificationDomain");

            $senderNameEl.attr("disabled", disable);
            $senderAddressEl.attr("disabled", disable);

            $domainSelectEl.attr("disabled", disable);
        }
    }

    function disableButtonsByIds(ids, disable) {
        for (var i = 0, len = ids.length; i < len; i++) {
            disableButton(ids[i], disable);
        }
    }

    function equalsSettings(settings1, settings2) {
        return settings1.Host === settings2.Host &&
            settings1.Port === settings2.Port &&
            settings1.CredentialsUserName === settings2.CredentialsUserName &&
            settings1.CredentialsUserPassword === settings2.CredentialsUserPassword &&
            settings1.SenderDisplayName === settings2.SenderDisplayName &&
            settings1.SenderAddress === settings2.SenderAddress &&
            settings1.EnableSSL === settings2.EnableSSL &&
            settings1.EnableAuth === settings2.EnableAuth;
    }

    function getSettingsForTest() {
        return $customSettingsRadio.prop("checked") ? getCustomSettings(true, true) : getEmptyCustomSettings();
    }

    function getCustomSettings(checkRequired, skipPassword) {
        var settingsCorrected = true;

        var host = $customSettingsBox.find(".host .textEdit").val(),
            port = $customSettingsBox.find(".port .textEdit").val(),
            enableAuth = $customSettingsBox.find("#customSettingsAuthenticationRequired").is(":checked"),
            credentialsUserName = $customSettingsBox.find(".host-login .textEdit").val(),
            credentialsUserPassword = $customSettingsBox.find(".host-password .textEdit").val(),
            senderDisplayName = $customSettingsBox.find(".display-name .textEdit").val(),
            senderAddress = $customSettingsBox.find(".email-address .textEdit").val(),
            enableSsl = $customSettingsBox.find("#customSettingsEnableSsl").is(":checked");

        host = !host ? "" : host.trim();
        port = !port ? null : parseInt(port);
        credentialsUserName = !credentialsUserName ? "" : credentialsUserName.trim();
        senderDisplayName = !senderDisplayName ? "" : senderDisplayName.trim();
        senderAddress = !senderAddress ? "" : senderAddress.trim();

        if (checkRequired) {
            if (!host) {
                $customSettingsBox.find(".host").toggleClass("requiredFieldError", true);
                settingsCorrected = false;
            } else
                $customSettingsBox.find(".host").toggleClass("requiredFieldError", false);

            if (!port || port === NaN) {
                $customSettingsBox.find(".port").toggleClass("requiredFieldError", true);
                settingsCorrected = false;
            } else
                $customSettingsBox.find(".port").toggleClass("requiredFieldError", false);

            if (enableAuth && !credentialsUserName) {
                $customSettingsBox.find(".host-login").toggleClass("requiredFieldError", true);
                settingsCorrected = false;
            } else
                $customSettingsBox.find(".host-login").toggleClass("requiredFieldError", false);

            if (!skipPassword) {
                if (enableAuth && !credentialsUserPassword) {
                    $customSettingsBox.find(".host-password").toggleClass("requiredFieldError", true);
                    settingsCorrected = false;
                } else
                    $customSettingsBox.find(".host-password").toggleClass("requiredFieldError", false);
            }

            if (!ASC.Mail.Utility.IsValidEmail(senderAddress)) {
                $customSettingsBox.find(".email-address .requiredErrorText").text(ASC.Resources.Master.Resource.ErrorNotCorrectEmail);
                $customSettingsBox.find(".email-address").toggleClass("requiredFieldError", true);
                settingsCorrected = false;
            } else
                $customSettingsBox.find(".email-address").toggleClass("requiredFieldError", false);
        }

        return settingsCorrected ? {
            Host: host,
            Port: port,
            CredentialsUserName: credentialsUserName,
            CredentialsUserPassword: credentialsUserPassword,
            SenderDisplayName: senderDisplayName,
            SenderAddress: senderAddress,
            EnableSSL: enableSsl,
            EnableAuth: enableAuth
        } : null;
    }

    function getMailServerSettings(checkRequired) {
        var settingsCorrected = true;

        var login = $mailserverSettingsBox.find("#notificationLogin").val(),
            domainId = $mailserverSettingsBox.find("#notificationDomain").val(),
            domain = $mailserverSettingsBox.find("#notificationDomain option:selected").text(),
            senderDisplayName = $mailserverSettingsBox.find("#notificationSenderDisplayName").val(),
            password = "";

        login = !login ? "" : login.trim();
        domain = !domain ? "" : domain.trim();
        senderDisplayName = !senderDisplayName ? "" : senderDisplayName.trim();

        if (checkRequired) {
            if (!login || !ASC.Mail.Utility.IsValidEmail(login + "@" + domain)) {
                $mailserverSettingsBox.find(".email-address .requiredErrorText").text(ASC.Resources.Master.Resource.ErrorNotCorrectEmail);
                $mailserverSettingsBox.find(".email-address").addClass("requiredFieldError");
                settingsCorrected = false;
            }
            password = generatePassword();
        }

        return settingsCorrected ? {
            login: login,
            domain: domain,
            domainId: domainId,
            password: password,
            senderDisplayName: senderDisplayName
        } : null;
    }

    function getInitCurrentSettings() {
        var $box = $view.find("#currentSettingsBox");

        isDefault = $("#currentIsDefault").val().toLowerCase() === "true";

        return {
            Host: $box.find("#currentHost").val(),
            Port: $box.find("#currentPort").val(),
            CredentialsUserName: $box.find("#currentCredentialsUserName").val(),
            CredentialsUserPassword: $box.find("#currentCredentialsUserPassword").val(),
            SenderDisplayName: $box.find("#currentSenderDisplayName").val(),
            SenderAddress: $box.find("#currentSenderAddress").val(),
            EnableSSL: $("#currentEnableSsl").val().toLowerCase() === "true",
            EnableAuth: $("#currentEnableAuth").val().toLowerCase() === "true"
        };
    }

    function clearErrors() {
        $view.find(".requiredFieldError").removeClass("requiredFieldError");
    }

    function getEmptyCustomSettings() {
        return {
            Host: "",
            Port: "",
            CredentialsUserName: "",
            CredentialsUserPassword: "",
            SenderDisplayName: "",
            SenderAddress: "",
            EnableSSL: false,
            EnableAuth: false
        };
    }

    function showLoader() {
        LoadingBanner.showLoaderBtn("#smtpSettingsView");
        blockControls(true);
    }

    function hideLoader() {
        LoadingBanner.hideLoaderBtn("#smtpSettingsView");
        blockControls(false);
    }

    function saveSettings() {
        if ($customSettingsRadio.prop("checked")) {
            saveCustomSettings();
        } else {
            saveMailserverSettings();
        }
    }

    function saveCustomSettings() {
        clearErrors();

        var settings = getCustomSettings(true);
        if (!settings || equalsSettings(settings, currentSettings)) {
            return false;
        }

        showLoader();
        var useMailServer = currentHostUseMailserver();
        var oldNotificationAddress = currentSettings.CredentialsUserName;

        window.async.waterfall([
            function (cb) {
                window.SmtpSettings.Save(settings, function (result) {
                    if (result.error == null) {
                        saveCurrentSettings(result.value);
                        renderCustomSettingsBox(currentSettings);
                        renderMailserverSettingsBox(getEmptyCustomSettings());
                        switchToCustomSettingsBox();
                    }

                    cb(null, result);
                });
            },
            function (result, cb) {
                if (!useMailServer) {
                    cb(result.error ? result.error.Message : null);
                    return;
                }

                Teamlab.removeNotificationAddress(null, oldNotificationAddress, {
                    success: function () {
                        cb(null);
                    },
                    error: function () {
                        cb(null);
                    }
                });
            }
        ], function (err) {
            hideLoader();

            if (err) {
                LoadingBanner.showMesInfoBtn("#smtpSettingsView", err, "error");
            } else {
                LoadingBanner.showMesInfoBtn("#smtpSettingsView", ASC.Resources.Master.Resource.OperationSuccededMsg, "success");
                isDefault = false;
            }

            setupButtons(true);
        });

        return false;
    }

    function saveMailserverSettings() {
        clearErrors();

        var mailserverSettings = getMailServerSettings(true);
        if (!mailserverSettings || equalsSettings(mailserverSettings, currentSettings)) {
            return false;
        }

        showLoader();

        var useMailServer = currentHostUseMailserver();

        window.async.waterfall([
            function (cb) {
                if (!useMailServer) {
                    cb(null);
                    return;
                }

                Teamlab.removeNotificationAddress(null, currentSettings.CredentialsUserName, {
                    success: function () {
                        cb(null);
                    },
                    error: function () {
                        cb(null);
                    }
                });
            },
            function (cb) {
                Teamlab.createNotificationAddress(null, mailserverSettings.login, mailserverSettings.password, mailserverSettings.domainId, {
                    success: function (params, res) {
                        cb(null, res);
                    },
                    error: function (params, err) {
                        cb(err[0]);
                    }
                });
            },
            function (res, cb) {
                var settings = {
                    Host: res.smtp_server,
                    Port: res.smtp_port,
                    CredentialsUserName: res.smtp_account,
                    CredentialsUserPassword: mailserverSettings.password,
                    SenderDisplayName: mailserverSettings.senderDisplayName,
                    SenderAddress: res.email,
                    EnableSSL: res.smtp_encryption_type === "STARTTLS" || res.smtp_encryption_type === "SSL",
                    EnableAuth: true
                };

                window.SmtpSettings.Save(settings, function (result) {
                    if (result.error != null) {
                        cb(result.error.Message);
                    } else {
                        saveCurrentSettings(result.value);
                        renderCustomSettingsBox(getEmptyCustomSettings());
                        renderMailserverSettingsBox(currentSettings);
                        switchToMailserverSettingsBox();
                        cb(null);
                    }
                });
            }
        ], function (err) {
            hideLoader();

            if (err) {
                LoadingBanner.showMesInfoBtn("#smtpSettingsView", err, "error");
            } else {
                LoadingBanner.showMesInfoBtn("#smtpSettingsView", ASC.Resources.Master.Resource.OperationSuccededMsg, "success");
                isDefault = false;
            }

            setupButtons(false);
        });

        return false;
    }

    function restoreDefaults() {
        showLoader();
        var useMailServer = currentHostUseMailserver();

        window.async.waterfall([
            function (cb) {
                if (!useMailServer) {
                    cb(null);
                    return;
                }

                Teamlab.removeNotificationAddress(null, currentSettings.CredentialsUserName, {
                    success: function () {
                        cb(null);
                    },
                    error: function () {
                        cb(null);
                    }
                });
            },
            function (cb) {
                window.SmtpSettings.RestoreDefaults(function (result) {
                    if (result.error) {
                        cb(result.error.Message);
                    } else {
                        saveCurrentSettings(result.value);
                        renderCustomSettingsBox(currentSettings);
                        renderMailserverSettingsBox(getEmptyCustomSettings());
                        switchToCustomSettingsBox();
                        cb(null);
                    }
                });
            }
        ], function (err) {
            hideLoader();

            if (err) {
                LoadingBanner.showMesInfoBtn("#smtpSettingsView", err, "error");
            } else {
                LoadingBanner.showMesInfoBtn("#smtpSettingsView", ASC.Resources.Master.Resource.OperationSuccededMsg, "success");
                isDefault = true;
            }

            setupButtons(true);
        });

        return false;
    }

    function sendTestMail() {
        clearErrors();

        var settings = getSettingsForTest();
        if (!settings) {
            return false;
        }

        showLoader();

        var isCustomSettingsRadio = $customSettingsRadio.prop("checked");

        window.SmtpSettings.Test(isCustomSettingsRadio ? settings : null, function (result) {
            hideLoader();

            if (result.error != null) {
                LoadingBanner.showMesInfoBtn("#smtpSettingsView", result.error.Message, "error");
            } else {
                LoadingBanner.showMesInfoBtn("#smtpSettingsView", ASC.Resources.Master.Resource.OperationSuccededMsg, "success");
            }

            setupButtons($customSettingsRadio.prop("checked"));
        });
        return false;
    }

    return {
        init: init
    };
}(jq);

jq(function () {
    window.SmtpSettingsView.init();
});