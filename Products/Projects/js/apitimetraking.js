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


ASC.Projects.TimeTraking = (function($) {
    var timer,
        seconds = 0,
        timerHours = 0,
        timerMin = 0,
        timerSec = 0,
        startTime = null,
        pausedTime = null,
        clickPauseFlag = false,
        isPlay = true,
        $inputMinutes,
        $inputHours,
        $inputDate,
        $errorPanel,
        $addLog,
        resources = ASC.Projects.Resources.ProjectsJSResource;

    var teamlab = Teamlab;
    var $hours, $minutes, $seconds, $startButton, $resetButton, $textareaTimeDesc, $openTasks, $closedTasks;
    var clickEvent = "click", disableClass = "disable", errorClass = "error", successClass = "success", disabledAttr = "disabled", stopClass = "stop";

    var init = function () {
        $inputMinutes = $("#inputTimeMinutes");
        $inputHours = $("#inputTimeHours");
        $inputDate = $("#inputDate");
        $errorPanel = $("#timeTrakingErrorPanel");

        var $timerTime = $("#timerTime");
        $startButton = $timerTime.find(".start");
        $resetButton = $timerTime.find(".reset");
        $addLog = $("#addLog");

        var $firstViewStyle = $("#firstViewStyle");
        $hours = $firstViewStyle.find(".h");
        $minutes = $firstViewStyle.find(".m");
        $seconds = $firstViewStyle.find(".s");
        $textareaTimeDesc = $("#textareaTimeDesc");

        $openTasks = $('#openTasks');
        $closedTasks = $('#closedTasks');

        window.onfocus = function () {
            var diffTime = {};
            if (startTime && seconds > 0 && !isPlay) {

                var focusTime = new Date();
                var focusTimeHours = focusTime.getHours();
                var focusTimeMinutes = focusTime.getMinutes();
                var focusTimeSeconds = focusTime.getSeconds();

                var startTimeHours = startTime.getHours();
                var startTimeMinutes = startTime.getMinutes();
                var startTimeSeconds = startTime.getSeconds();

                if (focusTimeHours > startTimeHours) {
                    diffTime.h = focusTimeHours - startTimeHours;
                } else {
                    diffTime.h = 0;
                }

                if (focusTimeMinutes >= startTimeMinutes) {
                    diffTime.m = focusTimeMinutes - startTimeMinutes;
                } else if (diffTime.h > 0) {
                    diffTime.m = (focusTimeMinutes + 60) - startTimeMinutes;
                    diffTime.h--;
                    if (diffTime.m === 60) {
                        diffTime.m = 0;
                        diffTime.h++;
                    }
                } else {
                    diffTime.m = 0;
                }

                if (focusTimeSeconds >= startTimeSeconds) {
                    diffTime.s = focusTimeSeconds - startTimeSeconds;
                } else if (diffTime.m > 0) {
                    diffTime.s = (focusTimeSeconds + 60) - startTimeSeconds;
                    diffTime.m--;
                    if (diffTime.s === 60) {
                        diffTime.s = 0;
                        diffTime.m++;
                    }
                } else {
                    diffTime.s = 0;
                }

                var time = clickPauseFlag ? timeSum(pausedTime, diffTime) : diffTime;
                timerHours = time.h;
                timerMin = time.m;
                timerSec = time.s;
                updateTimer(time);
            }
        };

        if (!$addLog.length)
            return;

        window.onbeforeunload = function(evt) {
            if ($startButton.hasClass(stopClass)) {
                playPauseTimer();
                return '';
            }

            if (ifNotAdded()) {
                return '';
            }
            return;
        };

        unlockElements();
        $inputHours.focus();
            
        if ($("#teamList option").length == 0 || $("#selectUserTasks option").length == 0) {
            lockStartAndAddButtons();
        }

        if (!$inputDate.hasClass('hasDatepicker')) {
            $inputDate.datepicker({ selectDefaultDate: false, onSelect: function () { $inputDate.blur(); } });
        }

        $inputDate.mask(ASC.Resources.Master.DatePatternJQ);
        $inputDate.datepicker('setDate', teamlab.getDisplayDate(new Date()));

        $('#timerTime #selectUserProjects').bind('change', function(event) {
            var prjid = parseInt($("#selectUserProjects option:selected").val());

            teamlab.getPrjTeam({}, prjid, {
                before: function() {
                    $("#teamList").attr(disabledAttr, disabledAttr);
                    $("#selectUserTasks").attr(disabledAttr, disabledAttr);
                },
                success: onGetTeam,
                after: function() {
                    $("#teamList").removeAttr(disabledAttr);
                    $("#selectUserTasks").removeAttr(disabledAttr); ;
                }
            });

            teamlab.getPrjTasks({}, {
                success: onGetTasks,
                filter: { sortBy: 'title', sortOrder: 'ascending', projectId: prjid }
            });
        });

        $startButton.bind(clickEvent, function () {
            if ($startButton.hasClass(disableClass)) return;
            playPauseTimer();
        });

        $resetButton.bind(clickEvent, function () {
            if ($resetButton.hasClass(disableClass)) return;
            resetTimer();
        });

        $addLog.bind(clickEvent, function () {
            if ($addLog.hasClass(disableClass)) return;
            lockStartAndAddButtons();
            var h, m, s;
            var prjid = parseInt($("#selectUserProjects option:selected").attr("value"));
            var personid = $("#teamList option:selected").attr("value");
            var taskid = parseInt($("#selectUserTasks option:selected").attr("value"));
            var description = $.trim($textareaTimeDesc.val());
            var invalidTime = false;
            var hours;

            $inputHours.removeClass(errorClass);
            $inputMinutes.removeClass(errorClass);
            $errorPanel.empty();

            

            if (seconds > 0) {
                h = parseInt($hours.text(), 10);
                m = parseInt($minutes.text(), 10);
                s = parseInt($seconds.text(), 10);
                if (!(h > 0)) h = 0;
                if (!(m > 0)) m = 0;
                if (!(s > 0)) s = 0;
                hours = h + m / 60 + s / 3600;

                resetTimer();
            } else {
                if ($inputHours.val() === "" && $inputMinutes.val() === "") {
                    $errorPanel.addClass(errorClass).removeClass(successClass);
                    $errorPanel.text(resources.TimerNoData);
                    unlockStartAndAddButtons();
                    return;
                }
                h = parseInt($inputHours.val(), 10);
                m = parseInt($inputMinutes.val(), 10);

                if (h < 0 || !isInt(h)) {
                    $inputHours.addClass(errorClass);
                    invalidTime = true;
                }

                if (m > 59 || m < 0 || !isInt(m)) {
                    $inputMinutes.addClass(errorClass);
                    invalidTime = true;
                }

                if (invalidTime) {
                    $errorPanel.addClass(errorClass).removeClass(successClass);
                    $errorPanel.text(resources.InvalidTime).show();
                    unlockStartAndAddButtons();
                    return;
                }

                if (!(h > 0)) h = 0;
                if (!(m > 0)) m = 0;

                hours = h + m / 60;
            }

            var data = { hours: hours, note: description, personId: personid, projectId: prjid };
            data.date = $inputDate.datepicker('getDate');
            data.date.setHours(0);
            data.date.setMinutes(0);
            data.date = teamlab.serializeTimestamp(data.date);

            teamlab.addPrjTime({}, taskid, data, { success: onAddTaskTime });
        });

        $inputMinutes.on("blur", function (e) {
            var min = $inputMinutes.val();
            if (min.length == 1) {
                $inputMinutes.val("0" + min);
            }
        });
    };

    function isInt(input) {
        return parseInt(input, 10) == input;
    };

    function playTimer() {
        lockElements(true);

        $inputHours.val('').removeClass(errorClass);
        $inputMinutes.val('').removeClass(errorClass);
        $errorPanel.empty();

        timer = setInterval(timerTick, 1000);
    };

    function timerTick() {
        timerSec++;
        if (timerSec == 60) {
            timerSec = 0;
            timerMin++;
            if (timerMin == 60) {
                timerMin = 0;
                timerHours++;
            }
        }

        updateTimer({ h: timerHours, m: timerMin, s: timerSec });
    };

    function pauseTimer() {
        pausedTime = getCurrentTime();
        window.clearTimeout(timer);
    };

    function updateTimer(time) {
        seconds = time.h * 60 * 60 + time.m * 60 + time.s;      // refactor?
        $hours.text(getTextImpl(time.h));
        $minutes.text(getTextImpl(time.m));
        $seconds.text(getTextImpl(time.s));
    };

    function getTextImpl(val) {
        return val < 10 ? "0" + val : val;
    }

    function getCurrentTime() {
        return {
            h: parseInt($hours.text(), 10),
            m: parseInt($minutes.text(), 10),
            s: parseInt($seconds.text(), 10)
        };
    };

    function timeSum(firstTime, secondTime) {
        var resultTime = {
            h: firstTime.h + secondTime.h,
            m: firstTime.m + secondTime.m,
            s: firstTime.s + secondTime.s
        };

        if (resultTime.s >= 60) {
            resultTime.m++;
            resultTime.s -= 60;
        }

        if (resultTime.m >= 60) {
            resultTime.h++;
            resultTime.m -= 60;
        }

        return resultTime;
    };

    function resetTimer() {
        unlockElements();
        pauseTimer();

        var zeroText = '00';
        $hours.text(zeroText);
        $minutes.text(zeroText);
        $seconds.text(zeroText);

        isPlay = true;
        seconds = 0;
        timerSec = 0;
        timerMin = 0;
        timerHours = 0;
        startTime = null;
        clickPauseFlag = false;

        $startButton.removeClass(stopClass).attr("title", $startButton.attr("data-title-start"));
    };

    function lockElements(onlyManualInput) {
        var trueStr = "true";
        $inputHours.attr(disabledAttr, trueStr);
        $inputMinutes.attr(disabledAttr, trueStr);
        if (!onlyManualInput) {
            $inputDate.attr(disabledAttr, trueStr);
            $textareaTimeDesc.attr(disabledAttr, trueStr);
        }
    };

    function unlockElements() {
        $inputHours.removeAttr(disabledAttr);
        $inputMinutes.removeAttr(disabledAttr);
        $inputDate.removeAttr(disabledAttr);
        $textareaTimeDesc.removeAttr(disabledAttr);
    };

    function lockStartAndAddButtons() {
        $startButton.add($resetButton).add($addLog).addClass(disableClass);
        lockElements();
    };

    function unlockStartAndAddButtons() {
        $startButton.add($resetButton).add($addLog).removeClass(disableClass);
        unlockElements();
    };

    function playPauseTimer() {
        if (isPlay) {
            $startButton.addClass(stopClass).attr("title", $startButton.attr("data-title-pause"));
            isPlay = false;
            startTime = new Date();
            playTimer();
        }
        else {
            $startButton.removeClass(stopClass).attr("title", $startButton.attr("data-title-start"));
            isPlay = true;
            clickPauseFlag = true;
            startTime = null;
            pauseTimer();
        }
    };

    function onAddTaskTime(data) {
        $errorPanel.removeClass(errorClass).addClass(successClass);
        $errorPanel.text(resources.SuccessfullyAdded);
        $textareaTimeDesc.val('');
        $inputHours.val('');
        $inputMinutes.val('');
        $hours.add($minutes).add($seconds).val('00');
        unlockStartAndAddButtons();
    };

    function onGetTeam(params, team) {
        var teamList = $('#teamList');
        teamList.find('option').remove();
        
        team = ASC.Projects.Common.excludeVisitors(team);
        
        team.forEach(function (item) {
            if (item.displayName != "profile removed") {
                teamList.append('<option value="' + item.id + '" id="optionUser_' + item.id + '">' + item.displayName + '</option>');
            }
        });
        
        if (teamList.find('option').length == 0) {
            lockStartAndAddButtons();
        } else {
            unlockStartAndAddButtons();
        }
    };

    function onGetTasks(params, tasks) {
        $('#selectUserTasks option').remove();

        tasks.forEach(function (item) {
            var opt = '<option value="' + item.id + '" id="optionUser_' + item.id + '">' + $.htmlEncodeLight(item.title) + '</option>';
            if (item.status == 1) {
                $openTasks.append(opt);
            }
            if (item.status == 2) {
                $closedTasks.append(opt);
            }
        });
        
        if ($("#selectUserTasks option").length === 0) {
            lockStartAndAddButtons();
        } else {
            unlockStartAndAddButtons();
        }
    };

    function ifNotAdded() {
        return seconds > 0 || $inputHours.val() != '' || $inputMinutes.val() != '';
    };

    return {
        init: init
    };
})(jQuery);

ASC.Projects.TimeTrakingEdit = (function ($) {
    var timeCreator,
        isInit,
        oldTime = {},
        loadListTeamFlag = false,
        commonPopupContainer = $("#commonPopupContainer"),
        $popupContainer,
        inputMinutes,
        inputHours,
        errorPanel,
        resources = ASC.Projects.Resources.ProjectsJSResource;

    var teamlab = Teamlab;

    function initPopup() {
        if (isInit) return;
        var clonedPopup = commonPopupContainer.clone();
        clonedPopup.attr("id", "timeTrakingPopup");
        $("#CommonListContainer").append(clonedPopup);
        $popupContainer = clonedPopup;
        $popupContainer.html(jq.tmpl("common_containerTmpl",
        {
            options: {
                PopupContainerCssClass: "popupContainerClass",
                OnCancelButtonClick: "PopupKeyUpActionProvider.CloseDialog();",
                IsPopup: true
            },
            header: {
                data: { title: ASC.Projects.Resources.CommonResource.TimeTracking },
                title: "projects_common_popup_header"
            },
            body: {
                data: {},
                title: "projects_editTimerPopup"
            }
        }));
    };

    var init = function () {
        initPopup();
        
        if (!isInit) {
            isInit = true;
        }
        
        inputMinutes = $("#inputTimeMinutes");
        inputHours = $("#inputTimeHours");
        errorPanel = $("#timeTrakingErrorPanel");
        
        inputMinutes.on("blur", function (e) {
            var min = inputMinutes.val();
            if (min.length == 1) {
                inputMinutes.val("0" + min);
            }
        });

        $('#timeTrakingPopup .middle-button-container a.button.blue.middle').bind('click', function (event) {
            
            var h = inputHours.val();
            var m = inputMinutes.val();

            if (checkError(h, m, $('#timeTrakingPopup #timeTrakingDate').val())) {
                return;
            }
           
            m = parseInt(m, 10);
            h = parseInt(h, 10);

            if (!(h > 0)) h = 0;
            if (!(m > 0)) m = 0;
            
            var timeid = $("#timeTrakingPopup").attr('timeid');

            teamlab.updatePrjTime({ oldTime: oldTime, timeid: timeid },
                timeid,
                {
                    hours: h + m / 60,
                    date: teamlab.serializeTimestamp($('#timeTrakingPopup #timeTrakingDate').datepicker('getDate')),
                    note: $('#timeTrakingPopup #timeDescription').val(),
                    personId: $('#teamList option:selected').attr('value')
                },
                { error: onUpdatePrjTimeError });

            $.unblockUI();

        });
    };

    function checkError(h, m, d) {
        var error = false;
        
        if (parseInt(m, 10) > 59 || parseInt(m, 10) < 0 || !isInt(m)) {
            errorPanel.text(resources.InvalidTime);
            inputMinutes.focus();
            error = true;
        }
        if (parseInt(h, 10) < 0 || !isInt(h)) {
            errorPanel.text(resources.InvalidTime);
            inputHours.focus();
            error = true;
        }
        
        if ($.trim(d) == "" || d == null || !$.isDateFormat(d)) {
            errorPanel.text(resources.IncorrectDate);
            $('#timeTrakingPopup #timeTrakingDate').focus();
            error = true;
        }

        if (error) {
            errorPanel.show();
            setInterval(function() { $("#timeTrakingErrorPanel").hide(); }, 5000);
        }

        return error;
    };
    
    function isInt(input) {
        return parseInt(input, 10) == input;
    };
    
    var showPopup = function (prjid, taskid, taskName, timeId, time, date, description, responsible) {
        $timerDate = $("#timeTrakingDate");
        timeCreator = responsible;
        $popupContainer.attr('timeid', timeId);
        $("#timeDescription").val(description);
        $("#TimeLogTaskTitle").text(taskName);
        $("#TimeLogTaskTitle").attr('taskid', taskid);

        oldTime = time;
        inputHours.val(time.hours);
        if (time.minutes > 9) inputMinutes.val(time.minutes);
        else inputMinutes.val("0" + time.minutes);

        date = teamlab.getDisplayDate(new Date(date));
        $timerDate.mask(ASC.Resources.Master.DatePatternJQ);
        $timerDate.datepicker({ popupContainer: "#timeTrakingPopup", selectDefaultDate: true });
        $timerDate.datepicker('setDate', date);
        $('select#teamList option').remove();

        teamlab.getPrjTaskTime({}, taskid, { success: onGetTimeSpend });
        if (loadListTeamFlag) {
            $('select#teamList option').remove();
            if (ASC.Projects.Master.Team.length) {
                appendListOptions(ASC.Projects.Common.excludeVisitors(ASC.Projects.Master.Team));
            }
        } else {
            teamlab.getPrjProjectTeamPersons({}, prjid, { success: onGetTeamByProject });
        }

        StudioBlockUIManager.blockUI($popupContainer, 550, 400, 0, "absolute");
        inputHours.focus();
    };

    function onGetTimeSpend(params, data) {
        var hours = data.reduce(function (a, b) { return a + b.hours; }, 0);
        
        var time = $.timeFormat(hours);
        $(".addLogPanel-infoPanelBody #TotalHoursCount").text(time);
    };

    function appendListOptions(team) {
        var teamListSelect = $('select#teamList');
        team.forEach(function (item) {
            if (timeCreator == item.id) {
                teamListSelect.append($('<option value="' + item.id + '" selected="selected"></option>').html(item.displayName));
            } else {
                teamListSelect.append($('<option value="' + item.id + '"></option>').html(item.displayName));
            }
        });
    };
    function onUpdatePrjTimeError(params, data) {
        $("div.entity-menu[timeid=" + params.timeid + "]").hide();
    };

    function onGetTeamByProject(params, data) {
        var team = data;
        if (team.length) {
            appendListOptions(ASC.Projects.Common.excludeVisitors(team));
        }
    };
    return {
        init: init,
        showPopup: showPopup
    };
})(jQuery);