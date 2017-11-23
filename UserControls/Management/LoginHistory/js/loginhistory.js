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


var LoginHistory = function() {
    var $ = jq;

    var generateHash = '#generate';

    var $loginEventTmpl = $('#login-event-tmpl');
    var $onlineUserTmpl = $('#online-user-tmpl');

    var $generateText = $('#generate-text');

    var $eventsBox = $('#events-box');
    var $lastEventsText = $('#last-events-text');
    var $eventsList = $('#events-list');

    var $eventsListDscr = $('#events-list-dscr');
    var $eventsListCount = $eventsListDscr.find('span');

    var $onlineUsersBox = $('#online-users-box');
    var $onlineUsersList = $('#online-users-list');

    var $downloadReportBtn = $('#download-report-btn');

    var $emptyScreen = $('#empty-screen');

    var lastEvents = [];

    var renderUserTimeout = 5000;

    var socket;

    function init() {
        if (window.location.hash == generateHash) {
            createReport();
            return;
        }

        if (!ASC.SocketIO || ASC.SocketIO.disabled()) {
            getData(getDataCallback);
            return;
        }

        showLoader();

        socket = ASC.SocketIO.Factory.counters
            .on('connect', function() {
                getData(getDataCallback);
            })
            .on('connect_error', function() {
                getLoginEvents(getDataCallback);
            })
            .on('renderOnlineUsers', renderOnlineUsers)
            .on('renderOnlineUser', renderOnlineUser)
            .on('renderOfflineUser', renderOfflineUser);
    }

    function getDataCallback(err, data) {
        if (err) {
            hideLoader();
            showErrorMessage();
        } else {
            saveData(data);
            renderLastEvents();
            hideLoader();
        }
    }

    function getData(callback) {
        async.parallel([
                function(cb) {
                    Teamlab.getLoginEvents({
                        success: function(params, data) {
                            cb(null, data);
                        },
                        error: function(err) {
                            cb(err);
                        }
                    });
                },
                function (cb) {
                    if(socket) socket.emit('renderOnlineUsers');
                    cb(null);
                }],
            function(err, data) {
                callback(err, data);
            });
    }

    function getLoginEvents(callback) {
        Teamlab.getLoginEvents({
            success: function(params, data) {
                callback(null, [data]);
            },
            error: function(err) {
                callback(err);
            }
        });
    }

    function saveData(data) {
        lastEvents = getExtendedEvents(data[0]);
    }

    function getExtendedEvents(evts) {
        for (var i = 0; i < evts.length; i++) {
            var event = evts[i];

            var dateStr = ServiceFactory.getDisplayDate(ServiceFactory.serializeDate(event.date));
            var timeStr = ServiceFactory.getDisplayTime(ServiceFactory.serializeDate(event.date));

            event.displayDate = dateStr + ' ' + timeStr;
        }

        return evts;
    }

    function renderLastEvents() {
        if (lastEvents.length) {
            var $events = $loginEventTmpl.tmpl(lastEvents);
            $events.appendTo($eventsList.find('tbody'));

            $lastEventsText.show();
            $eventsBox.show();

            $eventsListCount.text(lastEvents.length);
            $eventsListDscr.show();

            $downloadReportBtn.show().click(createReport);
        } else {
            $emptyScreen.show();
        }
    }

    function renderOnlineUsers(usersDictionary) {
        var users = getUsers(usersDictionary);

        if (users.length) {
            var $users = $onlineUserTmpl.tmpl(users);
            $onlineUsersList.html($users);

            $onlineUsersBox.show();
        } else {
            $onlineUsersBox.hide();
        }
    }

    function renderOnlineUser(userId) {
        var user = window.UserManager.getUser(userId);
        var $user = $onlineUserTmpl.tmpl(user);

        $onlineUsersList.append($user);
        $user.colorFade('#83e281', renderUserTimeout);
    }

    function renderOfflineUser(userId) {
        var user = window.UserManager.getUser(userId);
        var $user = $onlineUsersList.find('.online-user[data-userid="' + userId + '"]');

        user.presenceDuration = "";
        $user.colorFade('#fe4042', renderUserTimeout, function() {
            $user.remove();
        });
    }

    function createReport() {
        $generateText.show();
        showLoader();

        Teamlab.createLoginHistoryReport({}, { success: createReportCallback, error: createReportErrorCallback });
        return false;
    }

    function createReportCallback (params, data) {
        location.href = data;
    }

    function createReportErrorCallback() {
        $generateText.hide();
        hideLoader();

        toastr.error(ASC.Resources.Master.Resource.CreateReportError);
    }

    function getUsers(usersDictionary) {
        var users = [];

        var info = window.UserManager.getAllUsers();

        for (var i = 0; i < info.length; i++) {
            if (usersDictionary[info[i].id]) {
                info[i].firstConnection = usersDictionary[info[i].id].FirstConnection;
                info[i].lastConnection = usersDictionary[info[i].id].LastConnection;
                info[i].presenceDuration = getPresenceDuration(usersDictionary[info[i].id].FirstConnection);

                users.push(info[i]);
            }
        }

        return users;
    }

    function getPresenceDuration(firstConnectionTime) {
        var now = new Date();
        var firstConnection = new Date(firstConnectionTime);

        var diff = toUtcDate(new Date(now - firstConnection));

        var hours = diff.getHours();
        var minutes = diff.getMinutes();

        if (hours == 0 && minutes == 0) return '';

        if (hours < 10) hours = '0' + hours;
        if (minutes < 10) minutes = '0' + minutes;

        return hours + ':' + minutes;
    }

    function toUtcDate(date) {
        return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
    }

    function showLoader() {
        LoadingBanner.displayLoading();
    }

    function hideLoader() {
        LoadingBanner.hideLoading();
    }

    function showErrorMessage() {
        toastr.error(ASC.Resources.Master.Resource.CommonJSErrorMsg);
    }

    return {
        init: init
    };
}();

jQuery(function() {
    LoginHistory.init();
});