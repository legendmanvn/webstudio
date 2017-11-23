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


jq(function () {
    if (window.AccountLinkControl_SettingsView === true) {
        jq(".account-links").html(jq.tmpl("template-accountLinkCtrl", { infos: window.AccountLinkControl_Providers }));
    }

    jq(".account-links").delegate('.popup', 'click', function () {
        var obj = jq(this);
        if (obj.hasClass('linked')) {
            //unlink
            Teamlab.thirdPartyUnLinkAccount({ provider: obj.attr('id') }, { provider: obj.attr('id') }, {
                success: function (params, response) {
                    for (var i = 0, n = window.AccountLinkControl_Providers.length; i < n; i++) {
                        if (window.AccountLinkControl_Providers[i].Provider == params.provider) {
                            window.AccountLinkControl_Providers[i].Linked = false;
                            break;
                        }
                    }
                    jq(".account-links").html(jq.tmpl("template-accountLinkCtrl", { infos: window.AccountLinkControl_Providers }));
                },
                error: function (params, errors) {
                    toastr.error(errors[0]);
                }
            });
        }
        else {
            var link = obj.attr('href');
            window.open(link, 'login', 'width=800,height=500,status=no,toolbar=no,menubar=no,resizable=yes,scrollbars=no');
        }
        return false;
    });
});

function loginCallback(profile) {
    Teamlab.thirdPartyLinkAccount({provider: profile.Provider}, { serializedProfile: profile.Serialized }, {
        success: function (params, response) {
            for (var i = 0, n = window.AccountLinkControl_Providers.length; i < n; i++) {
                if (window.AccountLinkControl_Providers[i].Provider == params.provider) {
                    window.AccountLinkControl_Providers[i].Linked = true;
                    break;
                }
            }
            jq(".account-links").html(jq.tmpl("template-accountLinkCtrl", { infos: window.AccountLinkControl_Providers }));
        },
        error: function (params, errors) {
            toastr.error(errors[0]);
        }
    });
}

function authCallback(profile) {
    if (profile.AuthorizationError && profile.AuthorizationError.length) {
        if (profile.AuthorizationError != "Canceled at provider")
        {
            jq("#authMessage").html("<div class='errorBox'>" + Encoder.htmlEncode(profile.AuthorizationError) + "</div>")
        }
    } else {
        window.submitForm("signInLogin", profile.Hash);
    }
}

function loginJoinCallback(profile) {
    window.submitForm("thirdPartyLogin", profile.Serialized);
}
