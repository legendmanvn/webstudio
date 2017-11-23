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


/*******************************************************************************
    Auth for Thirdparty
*******************************************************************************/

var OAuth2Redirect = function (search) {
    search = search.substring(search.indexOf("?") == 0 ? 1 : 0);

    var params = {};
    search.replace(/(?:^|&)([^&=]*)=?([^&]*)/g,
        function ($0, $1, $2) {
            if ($1) {
                params[$1] = $2;
            }
        });

    if (params.error) {
        OAuthError(params.error);
        return;
    }

    if (params.code) {
        OAuthCallback(params.code);
    }
};

var OAuthCallback = function (token, source) {
};

var OAuthError = function (error, source) {
    ASC.Files.UI.displayInfoPanel(error, true);
};

var OAuthPopup = function (url, width, height) {
    var newwindow;
    try {
        var params = "height=" + (height || 600) + ",width=" + (width || 1020) + ",resizable=0,status=0,toolbar=0,menubar=0,location=1";
        newwindow = window.open(url, "Authorization", params);
    } catch (err) {
        newwindow = window.open(url, "Authorization");
    }
    return newwindow;
};