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


ProgressManager = new function () {

    this.init = function () {
        showProgress(0);
        getProgress();
    };
    function showProgress(progress) {
        var $progressValue = $(".asc-progress-value"),
            $progressText = $(".asc-progress_percent");

        $progressValue.animate({ "width": progress + "%" });
        $progressText.text(progress + "% ");
    };

    function getProgress() {
        var type = getURLParam("type");

        switch (type) {
            case "0":
                AjaxPro.Backup.GetTransferProgress(function (response) {
                    if (response.error) {
                        showError(response.error.Message);
                        return;
                    } else if (response.value) {
                        showProgress(response.value.Progress);
                        if (response.value.IsCompleted) {
                            window.location.href = response.value.Link;
                        }
                    }
                    setTimeout(function () {
                        AjaxPro.Backup.GetTransferProgress(getProgress);
                    }, 1000);
                    
                });
                break;
            case "1":
                AjaxPro.Backup.GetRestoreProgress(function (response) {
                    if (response.error) {
                        showError(response.error.Message);
                        return;
                    }
                    if (response.value) {
                        showProgress(response.value.Progress);
                        if (response.value.IsCompleted) {
                            window.location.href = "./";
                        }
                    } else {
                        showProgress(100);
                        window.location.href = "./";
                    }
                    setTimeout(function () {
                        AjaxPro.Backup.GetRestoreProgress(getProgress);
                    }, 1000);
                });
                break;
                
        }
    };

    function showError(er) {
        $("#progress-line").hide();
        $("#progress-error").text(er).show();
    };

    function getURLParam (strParamName) {
        strParamName = strParamName.toLowerCase();

        var strReturn = "";
        var strHref = window.location.href.toLowerCase();
        var bFound = false;

        var cmpstring = strParamName + "=";
        var cmplen = cmpstring.length;

        if (strHref.indexOf("?") > -1) {
            var strQueryString = strHref.substr(strHref.indexOf("?") + 1);
            var aQueryString = strQueryString.split("&");
            for (var iParam = 0; iParam < aQueryString.length; iParam++) {
                if (aQueryString[iParam].substr(0, cmplen) == cmpstring) {
                    var aParam = aQueryString[iParam].split("=");
                    strReturn = aParam[1];
                    bFound = true;
                    break;
                }
            }
        }
        if (bFound == false) {
            return null;
        }

        if (strReturn.indexOf("#") > -1) {
            return strReturn.split("#")[0];
        }

        return strReturn;
    };
}

$(function () {
    ProgressManager.init();
});