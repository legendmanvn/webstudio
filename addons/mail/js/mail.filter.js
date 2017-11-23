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


window.MailFilter = (function($) {
    var isInit = false;

    var attachments,
        tags,
        from,
        importance,
        withCalendar,
        page,
        pageSize,
        periodFrom,
        periodTo,
        withinPeriod,
        folder,
        search,
        sort,
        sortOrder,
        to,
        unread,
        fromDate,
        fromMessage,
        prevFlag;

    var init = function() {
        if (isInit === false) {
            isInit = true;

            attachments = false;
            tags = new Array();
            from = undefined;
            importance = false;
            page = 1;
            pageSize = TMMail.option('MessagesPageSize');
            periodFrom = 0;
            withinPeriod = '';
            periodTo = 0;
            folder = '1';
            search = '';
            sort = 'date';
            sortOrder = 'descending';
            to = undefined;
            unread = undefined;
            fromDate = undefined;
            fromMessage = undefined;
            prevFlag = false;
            withCalendar = false;

            reset();
        }
    };

    var reset = function() {
        resetFolder();
        resetSearch();
        resetTags();
        resetFrom();
        resetTo();
    };


    /*to*/
    var setTo = function(mailbox) {
        to = mailbox;
    };

    var getTo = function() {
        return to;
    };

    var resetTo = function() {
        to = undefined;
    };

    /*from*/
    var setFrom = function(mailbox) {
        from = mailbox;
    };

    var getFrom = function() {
        return from;
    };

    var resetFrom = function() {
        from = undefined;
    };


    /*tags*/
    var addTag = function(tagid) {
        if (-1 == $.inArray(tagid, tags)) {
            tags.push(tagid);
        }
    };

    var removeTag = function(tagid) {
        tags = $.grep(tags, function(value) {
            return value != tagid;
        });
    };

    var removeAllTags = function() {
        resetTags();
    };

    // toggles tag selection state
    // returns new state: true - selected, false - not selected
    var toggleTag = function(tagid) {
        var res = -1 == $.inArray(tagid, tags);
        if (res) {
            addTag(tagid);
        } else {
            removeTag(tagid);
        }
        return res;
    };

    var getTags = function() {
        var res = tags;
        return res;
    };

    var parseTags = function(tagsParam) {
        var arr = tagsParam.split(',');
        $.each(arr, function(index, value) {
            addTag(value);
        });
    };

    var resetTags = function() {
        tags = new Array();
    };


    /*unread*/
    var setUnread = function(unreadParam) {
        unread = unreadParam;
    };

    var getUnread = function() {
        return unread;
    };


    /*attachments*/
    var getAttachments = function() {
        return attachments;
    };

    var setAttachments = function(attachmentsParam) {
        attachments = attachmentsParam;
    };


    /*period*/
    var getPeriod = function() {
        return {
            from: periodFrom,
            to: periodTo
        };
    };

    var setPeriod = function(period) {
        periodFrom = period.from;
        periodTo = period.to;
    };

    var getPeriodWithin = function() {
        return withinPeriod;
    };

    var setPeriodWithin = function(withinPeriodParam) {
        withinPeriod = withinPeriodParam;
    };

    /*importance*/
    var setImportance = function(importanceParam) {
        importance = importanceParam;
    };

    var getImportance = function() {
        return importance;
    };


    var setWithCalendar = function(withCalendarFlag) {
        withCalendar = withCalendarFlag;
    };

    var getWithCalendar = function () {
        return withCalendar;
    };

    /*primary folder*/
    var setFolder = function(folderParam) {
        folder = folderParam;
    };

    var resetFolder = function() {
        folder = '1';
    };

    var getFolder = function() {
        return folder;
    };

    /* from date*/
    var setFromDate = function(newFromDate) {
        fromDate = newFromDate;
    };

    var getFromDate = function() {
        return fromDate;
    };

    /* from message*/
    var setFromMessage = function(newFromMessage) {
        fromMessage = newFromMessage;
    };

    var getFromMessage = function() {
        return fromMessage;
    };

    /* prev flag*/
    var setPrevFlag = function(newVal) {
        prevFlag = newVal;
    };

    var getPrevFlag = function() {
        return prevFlag;
    };

    /*search*/
    var setSearch = function(searchfilter) {
        search = searchfilter;
    };

    var getSearch = function() {
        return search;
    };

    var resetSearch = function() {
        search = '';
    };

    /*sort*/
    var setSort = function(sortParam) {
        sort = sortParam;
    };

    var getSort = function() {
        return sort;
    };

    var resetSort = function() {
        sort = 'date';
    };

    var setSortOrder = function(order) {
        sortOrder = order;
    };

    var getSortOrder = function() {
        return sortOrder;
    };

    var resetSortOrder = function() {
        sortOrder = 'descending';
    };


    /*page & page size*/
    var setPage = function (newPage) {
        page = newPage;
    };

    var getPage = function () {
        return page;
    };

    var setPageSize = function(newSize) {
        pageSize = parseInt(newSize);
    };

    var getPageSize = function() {
        return pageSize;
    };

    /*anchor*/
    var fromAnchor = function(folderParam, params) {
        reset();

        var toParam,
            tagsParam,
            importanceParam,
            unreadParam,
            fromParam,
            searchParam,
            attachmentsParam,
            period,
            periodWithin,
            sortParam,
            sortorder,
            pageParam,
            pageSizeParam,
            fromDateParam,
            fromMessageParam,
            prevFlagParam,
            withCalendarParam;

        if (typeof params !== 'undefined') {
            toParam = TMMail.getParamsValue(params, /to=([^\/]+)/);
            tagsParam = TMMail.getParamsValue(params, /tag=([^\/]+)/);
            importanceParam = TMMail.getParamsValue(params, /(importance\/)/);
            unreadParam = TMMail.getParamsValue(params, /unread=([^\/]+)/);
            attachmentsParam = TMMail.getParamsValue(params, /(attachments\/)/);
            fromParam = TMMail.getParamsValue(params, /from=([^\/]+)/);
            pageParam = TMMail.getParamsValue(params, /page=(\d+)/);
            pageSizeParam = TMMail.getParamsValue(params, /page_size=(\d+)/);
            period = TMMail.getParamsValue(params, /period=([^\/]+)/);
            periodWithin = TMMail.getParamsValue(params, /within=([^\/]+)/);
            searchParam = TMMail.getParamsValue(params, /search=([^\/]+)/);
            sortParam = TMMail.getParamsValue(params, /sort=([^\/]+)/);
            sortorder = TMMail.getParamsValue(params, /sortorder=([^\/]+)/);
            fromDateParam = TMMail.getParamsValue(params, /from_date=([^\/]+)/);
            fromMessageParam = TMMail.getParamsValue(params, /from_message=([^\/]+)/);
            prevFlagParam = TMMail.getParamsValue(params, /prev=([^\/]+)/);
            withCalendarParam = TMMail.getParamsValue(params, /(calendar\/)/);
        }

        var itemId = TMMail.getSysFolderIdByName(folderParam, TMMail.sysfolders.inbox.id);
        setFolder(itemId);

        if (toParam) {
            setTo(decodeURIComponent(toParam));
        } else {
            resetTo();
        }

        if (fromParam) {
            setFrom(decodeURIComponent(fromParam));
        } else {
            resetFrom();
        }

        if (tagsParam) {
            parseTags(tagsParam);
        }

        if (importanceParam) {
            setImportance(true);
        } else {
            setImportance(false);
        }

        if (attachmentsParam) {
            setAttachments(true);
        } else {
            setAttachments(false);
        }

        if (unreadParam) {
            if ('true' == unreadParam) {
                setUnread(true);
            } else {
                setUnread(false);
            }
        } else {
            setUnread(undefined);
        }

        if (searchParam) {
            setSearch(decodeURIComponent(searchParam));
        } else {
            resetSearch();
        }

        if (sortParam) {
            setSort(sortParam);
        } else {
            resetSort();
        }

        if (sortorder) {
            setSortOrder(sortorder);
        } else {
            resetSortOrder();
        }

        if (period) {
            fromParam = parseInt(period.split(',')[0]);
            toParam = parseInt(period.split(',')[1]);
            setPeriod({ from: fromParam, to: toParam });
            setPeriodWithin('');
        } else if (periodWithin) {
            setPeriodWithin(periodWithin);
            setPeriod({ from: 0, to: 0 });
        } else {
            setPeriod({ from: 0, to: 0 });
            setPeriodWithin('');
        }

        if (fromDateParam) {
            setFromDate(new Date(decodeURI(fromDateParam)));
        } else {
            setFromDate(undefined);
        }

        if (fromMessageParam) {
            setFromMessage(+fromMessageParam);
        } else {
            setFromMessage(undefined);
        }

        if ('true' == prevFlagParam) {
            setPrevFlag(true);
        } else {
            setPrevFlag(false);
        }

        setPage(pageParam ? pageParam : 1);

        if (pageSizeParam) {
            setPageSize(pageSizeParam);
        } else {
            setPageSize(TMMail.option('MessagesPageSize'));
        }

        if (withCalendarParam) {
            setWithCalendar(true);
        } else {
            setWithCalendar(false);
        }

    };

    var toAnchor = function(includePagingInfo, data, skipPrevNext) {
        var res = '/';

        var f = {};
        f.tags = tags;
        f.unread = getUnread();
        f.importance = getImportance();
        f.attachments = getAttachments();
        f.to = getTo();
        f.from = getFrom();
        f.sort_order = getSortOrder();
        f.period = getPeriod();
        f.period_within = getPeriodWithin();
        f.search = getSearch();
        f.page = page;
        f.page_size = pageSize;
        f.from_date = fromDate;
        f.from_message = fromMessage;
        f.prev_flag = prevFlag;
        f.with_calendar = getWithCalendar();

        $.extend(f, data);

        if (0 < f.tags.length) {
            res += 'tag=';
            $.each(f.tags, function(index, value) {
                res += value;
                if (index != f.tags.length - 1) {
                    res += ',';
                }
            });
            res += '/';
        }

        if (undefined !== f.unread) {
            if (f.unread) {
                res += 'unread=true/';
            } else {
                res += 'unread=false/';
            }
        }

        if (f.importance) {
            res += 'importance/';
        }

        if (f.attachments) {
            res += 'attachments/';
        }

        if (f.with_calendar) {
            res += 'calendar/';
        }

        if (f.to) {
            res += 'to=' + encodeURIComponent(f.to) + '/';
        }

        if (f.from) {
            res += 'from=' + encodeURIComponent(f.from) + '/';
        }

        // skip sort order if it has default value
        if (f.sort_order && f.sort_order != 'descending') {
            res += 'sortorder=' + f.sort_order + '/';
        }

        if (f.period.to > 0) {
            res += 'period=' + f.period.from + ',' + f.period.to + '/';
        } else if ('' != f.period_within) {
            res += 'within=' + encodeURIComponent(f.period_within) + '/';
        }

        if ('' != f.search) {
            res += 'search=' + encodeURIComponent(f.search) + '/';
        }

        if (includePagingInfo === true) {
            if(!commonSettingsPage.isConversationsEnabled())
                res += 'page=' + f.page + '/';

            res += 'page_size=' + f.page_size + '/';
        }

        if (true === skipPrevNext) {
            return res;
        }

        if (f.from_date) {
            res += 'from_date=' + f.from_date + '/';
        }

        if (f.from_message) {
            res += 'from_message=' + f.from_message + '/';
        }

        if (true === f.prev_flag) {
            res += 'prev=true/';
        }

        return res;
    };

    var anchorHasMarkStatus = function(status, anchor) {
        if (!anchor) {
            anchor = ASC.Controls.AnchorController.getAnchor();
        }
        if (status == 'read' || status == 'unread') {
            return undefined !== TMMail.getParamsValue(anchor, /\/unread=([^\/]+)/);
        }
        if (status == 'important' || status == 'normal') {
            return undefined !== TMMail.getParamsValue(anchor, /\/(importance)/);
        }
        return false;
    };

    var isBlank = function() {
        if (0 < tags.length ||
            to != undefined && 0 < to.length ||
            from != undefined && 0 < from.length ||
            attachments != false ||
            importance != false ||
            periodFrom != 0 ||
            withinPeriod != '' ||
            periodTo != 0 ||
            search != '' ||
            unread != undefined ||
            withCalendar != false) {
            return false;
        }

        return true;
    };

    function toData() {
        var res = {};
        res.folder = folder;
        if (!commonSettingsPage.isConversationsEnabled())
            res.page = page;
        res.page_size = pageSize;
        if (getUnread() != undefined) {
            res.unread = getUnread();
        }
        if (getAttachments()) {
            res.attachments = true;
        }
        if (getImportance()) {
            res.important = true;
        }
        if (0 != periodFrom && 0 != periodTo) {
            res.period_from = periodFrom;
            res.period_to = periodTo;
        }
        if (getPeriodWithin() != '') {
            var within = getPeriodWithin();
            var now = new Date(),
                today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
                yesterday = new Date(new Date(today).setDate(now.getDate() - 1)),
                lastweek = new Date(new Date(today).setDate(today.getDate() - 7));

            if ('today' == within) {
                res.period_from = today.getTime();
                res.period_to = today.getTime();
            } else if ('yesterday' == within) {
                res.period_from = yesterday.getTime();
                res.period_to = yesterday.getTime();
            } else if ('lastweek') {
                res.period_from = lastweek.getTime();
                res.period_to = today.getTime();
            } else {
                setPeriodWithin('');
            }
        }

        if (getFrom()) {
            res.find_address = from;
        }
        if (getTo()) {
            var account = accountsManager.getAccountByAddress(to);
            if (account) {
                res.mailbox_id = account.mailbox_id;
            }
        }

        if (getTags().length > 0) {
            res.tags = getTags();
        }
        if (getSearch() != '') {
            res.search = getSearch();
        }
        if (getSort()) {
            res.sort = getSort();
            res.sortorder = getSortOrder();
        }
        if (undefined != fromDate) {
            res.from_date = fromDate;
        }
        if (undefined != fromMessage) {
            res.from_message = fromMessage;
        }
        if (true === prevFlag) {
            res.prev_flag = true;
        }

        if (getWithCalendar()) {
            res.with_calendar = true;
        }

        return res;
    }

    return {
        init: init,

        getUnread: getUnread,
        setUnread: setUnread,

        getAttachments: getAttachments,
        setAttachments: setAttachments,

        getPeriod: getPeriod,
        setPeriod: setPeriod,

        getPeriodWithin: getPeriodWithin,
        setPeriodWithin: setPeriodWithin,

        addTag: addTag,
        removeTag: removeTag,
        removeAllTags: removeAllTags,
        toggleTag: toggleTag,
        getTags: getTags,

        getImportance: getImportance,
        setImportance: setImportance,

        getWithCalendar: getWithCalendar,
        setWithCalendar: setWithCalendar,

        getFolder: getFolder,

        setSearch: setSearch,
        getSearch: getSearch,

        setTo: setTo,
        getTo: getTo,

        setFrom: setFrom,
        getFrom: getFrom,

        setSort: setSort,
        getSort: getSort,
        setSortOrder: setSortOrder,
        getSortOrder: getSortOrder,

        getPage: getPage,
        setPage: setPage,

        setPageSize: setPageSize,
        getPageSize: getPageSize,

        setFolder: setFolder,

        setFromDate: setFromDate,
        getFromDate: getFromDate,

        setFromMessage: setFromMessage,
        getFromMessage: getFromMessage,

        setPrevFlag: setPrevFlag,
        getPrevFlag: getPrevFlag,

        fromAnchor: fromAnchor,
        toAnchor: toAnchor,
        toData: toData,

        anchorHasMarkStatus: anchorHasMarkStatus,

        isBlank: isBlank,
        reset: reset
    };
})(jQuery);