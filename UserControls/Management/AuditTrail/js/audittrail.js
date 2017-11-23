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


var AuditTrailView = function() {
    var $ = jq;

    var generateHash = '#generate';
    var auditEventTmpl = 'auditEventTmpl';

    var $generateText = $('#generate-text');
    var $lastEventsText = $('#last-events-text');
    var $eventsTable = $('#events-table');

    var $eventsTableDscr = $('#events-table-dscr');
    var $eventsTableCount = $eventsTableDscr.find('span');

    var $downloadReportBtn = $('#download-report-btn');

    var $emptyScreen = $('#empty-screen');

    var events;

    function init() {
        if (window.location.hash == generateHash) {
            createReport();
            return;
        }

        getEvents();
    }

    function getEvents() {
        showLoader();
        return Teamlab.getAuditEvents({}, null, { success: getEventsCallback });
    }

    function getEventsCallback(params, data) {
        events = extendEvents(data);

        if (events.length) {
            var $events = $('#' + auditEventTmpl).tmpl(events);
            $events.appendTo($eventsTable.find('tbody'));

            $lastEventsText.show();
            $eventsTable.show();

            $eventsTableCount.text(events.length);
            $eventsTableDscr.show();

            $downloadReportBtn.show().click(createReport);
        } else {
            $emptyScreen.show();
        }
        
        hideLoader();
    }

    function extendEvents(evts) {
        for (var i = 0; i < evts.length; i++) {
            var event = evts[i];

            var dateStr = ServiceFactory.getDisplayDate(ServiceFactory.serializeDate(event.date));
            var timeStr = ServiceFactory.getDisplayTime(ServiceFactory.serializeDate(event.date));

            event.displayDate = dateStr + ' ' + timeStr;
        }

        return evts;
    }

    function createReport() {
        $generateText.show();
        showLoader();

        Teamlab.createAuditTrailReport({}, { success: createReportCallback, error: createReportErrorCallback });
        return false;
    }

    function createReportCallback (params, data) {
        location.href = data;
    }

    function createReportErrorCallback () {
        $generateText.hide();
        hideLoader();

        toastr.error(ASC.Resources.Master.Resource.CreateReportError);
    }

    function showLoader() {
        LoadingBanner.displayLoading();
    }

    function hideLoader() {
        LoadingBanner.hideLoading();
    }

    init();
}();