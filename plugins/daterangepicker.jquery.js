/*!
 * Pikaday jQuery plugin.
 *
 * Copyright © 2013 David Bushell | BSD & MIT license | https://github.com/dbushell/Pikaday
 */

(function (root, factory)
{
    'use strict';

    if (typeof exports === 'object') {
        // CommonJS module
        factory(require('jquery'), require('underscore'), require('moment'), require('../pikaday'));
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery', 'underscore', 'moment', '../pikaday'], factory);
    } else {
        // Browser globals
        factory(root.jQuery, root._, root.moment, root.Pikaday);
    }
}(this, function ($, _, moment, Pikaday) {
    'use strict';

    function getInitRange (options) {
        var start = $(options.inputFrom).val(),
            end = $(options.inputTo).val();
        if (start && end) {
            return {
                start: new Date(start),
                end: moment(new Date(end)).startOf('day').toDate()
            };
        }
    }

    function updateMarkup(options) {
        var outputFrom = $(options.field).append('<input type="hidden" name="'+ options.output.from +'" value="">'),
            outputTo = $(options.field).append('<input type="hidden" name="'+ options.output.to +'" value="">');

        var fct = function (src, dest) {
            if (src.is(':disabled')) {
                dest.prop('disabled', true);
                src.removeAttr('disabled');
            }
            $(src).removeAttr('name');
        }

        fct($(options.inputFrom), $(options.field).find('[name="'+ options.output.from +'"]'));
        fct($(options.inputTo), $(options.field).find('[name="'+ options.output.to +'"]'));
    }

    var selectors = {
        calendar: '.Picker-calendarContainer',
        from: '.Picker-from',
        to: '.Picker-to'
    };

    var DateRangePicker = function (options) {
        var self = this,
            element = $(options.field);

        var inputFrom = $(selectors.from, element).get(0),
            inputTo = $(selectors.to, element).get(0);

        var options = $.extend({}, options, {
            container: $(selectors.calendar, element).get(0),
            inputFrom: inputFrom,
            inputTo: inputTo,
            output: { // <input type=hidden> for form validation
                from: inputFrom.getAttribute('name'),
                to: inputTo.getAttribute('name')
            }
        });

        this.el = element.get(0);
        this.$el = element;

        options.initRange = getInitRange(options);

        // Update Markup
        updateMarkup(options);

        // use by _onMouseOverCalendar to trigger disabledDates on hover
        this.hasAlreadyLeave = true;

        $(options.container).on('mouseover', $.proxy(this._onMouseOverCalendar, this));
        $(options.container).on('mouseleave', $.proxy(this._onMouseLeaveCalendar, this));
        $(options.container).on('rangeUpdate', $.proxy(this._onRangeUpdate, this));
        if (!options.lockStartRange) {
            $(options.inputFrom).on('click', $.proxy(this._onInputClick, this));
        }

        this.init(options);
    }

    var defaults = {
        format: 'YYYY-MM-DD',
        inputFrom: document.getElementById('from'),
        inputTo: document.getElementById('to'),
        container: document.getElementById('calendar'),
        maxDate: null,
        maxRangeDuration: null,
        allowDisabledDateInRange: false,
        getEndRangeMaxfct: null,
        disabledBeforeToday: false,
        minDate: new Date(2016, 0, 1),
        showWeekNumber: false,
        lockStartRange: false,
        toISOString: false
    };

    var defaultsPikaday = {
        format: defaults.format,
        firstDay: 1,
        showWeekNumber: false,
        minDate: new Date(2016, 0, 1),
        maxDate: new Date(2016, 3, 12),
        showDaysInNextAndPreviousMonths: true,
        bound: false
    };

    // Pikaday Wrapper to manage Dates Range
    DateRangePicker.prototype = {
        init: function (options) {
            var self = this;
            this.config = $.extend({}, defaults, options);

            this.currentDate = new Date();

            this.pikaday = new Pikaday($.extend({}, defaultsPikaday, {
                field: this.config.inputFrom,
                container: this.config.container,
                format: this.config.format,
                maxDate: this.config.maxDate,
                minDate: this.config.minDate,
                disabledBeforeToday: this.config.disabledBeforeToday,
                showWeekNumber: this.config.showWeekNumber,
                lockStartRange: this.config.lockStartRange
            }));

            this.pikaday.config({
                disableDayFn: function(date) {
                    date = moment(date);
                    return _.some(self.config.disabledDays, function(current) {
                        return moment(current.start).format('YYYYMMDD') === date.format('YYYYMMDD') ||
                               moment(current.end).format('YYYYMMDD') === date.format('YYYYMMDD')   ||
                               date.isBetween(moment(current.start), moment(current.end));
                    });
                },

                isDisabledStartEndRangeFn: function (date, type) {
                    date =  moment(date).format('YYYYMMDD');
                    return _.some(self.config.disabledDays, function(current) {
                        return date === moment(current[type]).format('YYYYMMDD');
                    });
                },

                onSelect: function(date) {
                    if (self.end && self.config.lockStartRange) {
                        if (date > self.start || date.getTime() === self.start.getTime()) {
                            this.setEndRange(date);
                            self.setEndRange(date);
                        }
                        this.draw();
                        $(this.el).trigger('rangeUpdate', [{
                            start: self.start,
                            end: self.end
                        }]);
                        return;
                    } else if (self.end) {
                        self.reset();
                    }

                    // First date range selection
                    if (!self.start || date < self.start) {
                        self.currentMax = self.getEndRangeMax(date);

                        // If max = start day => the end date is by default = start date
                        if (self.currentMax && moment(date).format('YYYYMMDD') === moment(self.currentMax).format('YYYYMMDD')) {
                            self.setOneDayRange(date);
                        } else {
                            self.setStartRange(date, self.getEndRangeMax(date));
                        }
                    }
                    // Second date range selection:
                    // 		Set the end date IF start < date < currentMax
                    else if (!moment(date).isAfter(self.currentMax) && !moment(date).isBefore(self.start)) {
                            self.setEndRange(date);
                    } else {
                        return;
                    }
                    this.draw();
                }
            });

            // Set an initial range
            if (this.config.initRange) {
                this.pikaday.setDate(moment(this.config.initRange.start).toDate());
                this.pikaday.setEndRange(moment(this.config.initRange.end).toDate());
                this.pikaday.setDate(moment(this.config.initRange.end).toDate());
                this.pikaday.draw();
            }

            // Binding
            this.$el.on('rangeUpdate', selectors.calendar, $.proxy(this.config.onRangeChange, this));
            this.$el.on('startUpdate', selectors.calendar, $.proxy(this.config.onStartChange, this));
            this.$el.on('endUpdate', selectors.calendar, $.proxy(this.config.onEndChange, this));

            $(this.pikaday.el).on('mousedown', $.proxy(this._onMouseDown, this));

            return this;
        },

        _onMouseDown: function (ev) {
            if ($(ev.target).hasClass('pika-day') && this.start) {
                var target = ev.target,
                    _d = new Date(  target.getAttribute('data-pika-year'),
                                    target.getAttribute('data-pika-month'),
                                    target.getAttribute('data-pika-day'));

                if (this.currentMax && _d > this.currentMax ||
                    this.config.lockStartRange && _d < this.start)
                    return;

                var input = (!this.config.lockStartRange && (this.end || _d < this.start)) ? 'inputFrom': 'inputTo';
                this.pikaday.config({ field: this.config[input] });
            }
            this.pikaday._onMouseDown(ev);
        },

        // Apply 2 constrains: maxRangeDuration && allowDisabledDateInRange
        getEndRangeMax: function(date) {
            // If no max duration && no disabled dates after current date
            // -> no limit in the range
            var	max = null;

            if (this.config.maxRangeDuration) {
                max =  moment(date).clone().add(this.config.maxRangeDuration - 1, 'days').toDate();
            }
            // If we don't want any disabled dates in a range
            //      -> find the closest disabled start range (in this.consfig.disabledDays)
            if (!this.config.allowDisabledDateInRange) {
                var fct;
                if (!this.config.maxRangeDuration) {
                    fct = function (current) {
                        return current.start.getTime() > date.getTime();
                    };
                } else {
                    // DANGER!! timezones :(
                    // Improve that test...
                    fct = function (current) {
                        return moment(current.start).format('YYYYMMDD') === moment(max).format('YYYYMMDD') ||
                               moment(current.start).isBetween(moment(date), max);
                    };
                }
                var closestDisabledDays = _.filter(this.config.disabledDays, fct);
                if(closestDisabledDays.length) {
                    closestDisabledDays = _.sortBy(closestDisabledDays, function(current) { return current.start.getTime() });
                    max = moment(closestDisabledDays[0].start).subtract(1, 'days').toDate();
                }
            }

            max = (max && moment(max).isAfter(this.config.maxDate))?this.config.maxDate:max;
            // Added constrains
            max = (this.config.getEndRangeMaxfct)? this.config.getEndRangeMaxfct(max): max;
            return max;
        },

        setStartRange: function(date, maxDate) {
            this.start = moment(date).startOf('day').toDate();
            this.pikaday.setStartRange(date);
            this.pikaday.setMaxRange(maxDate);
            this.pikaday.config({field: this.config.inputTo});
            $(this.pikaday.el).trigger('startUpdate', [{
                start: this.start
            }]);
        },

        setEndRange: function (date) {
            this.end = moment(date).endOf('day').toDate();
            if (!this.config.lockStartRange) {
                this.currentMax = null;
                this.pikaday.setMaxRange();
            }
            var input = this.config.lockStartRange?'inputTo':'inputFrom';
            this.pikaday.config({ field: this.config[input] });

            $(this.pikaday.el).trigger('endUpdate', [{
                end: this.end
            }]);

            $(this.pikaday.el).trigger('rangeUpdate', [{
                start: this.start,
                end: this.end
            }]);
        },

        setOneDayRange: function(day) {
            if (!this.config.lockStartRange) {
                this.currentMax = null;
                this.pikaday.setMaxRange();
            } else {
                this.pikaday.setMaxRange(this.currentMax);
            }

            this.pikaday.setStartRange();
            $(this.config.inputTo).val(moment(day).format(this.config.format));

            this.start = moment(day).startOf('day').toDate();
            this.end = moment(day).endOf('day').toDate();
            $(this.pikaday.el).trigger('rangeUpdate', [{
                start: this.start,
                end: this.end
            }]);
        },

        reset: function () {
            this.pikaday.setStartRange();
            this.pikaday.setEndRange();
            this.pikaday.setMaxRange();
            this.start = this.end = null;
            $(this.config.inputTo).val('');
        },

        _onMouseOverCalendar: function (ev) {
            // Update on hover the end range date
            if (!this.end && this.start && $(ev.target).hasClass('pika-day')) {
                var target = ev.target,
                    _d = new Date(  target.getAttribute('data-pika-year'),
                                    target.getAttribute('data-pika-month'),
                                    target.getAttribute('data-pika-day'));

                if (this.currentDate.getTime() !== _d.getTime()) {
                    this.currentDate = _d;
                    var endRange;
                    if (this.currentDate.getTime() >= this.start.getTime()) {
                        endRange = _d;
                    }
                    this.pikaday.setEndRange(endRange);
                    this.pikaday.draw();
                }
            }
        },

        _onMouseLeaveCalendar: function(ev) {
            if (this.start && !this.end) {
                this.pikaday.setEndRange();
                this.pikaday.draw();
            }
        },

        formatOutputDate: function (date, type) {
            var dateMoment = moment(date),
                dateOutput = this.config.toISOString ? dateMoment.toISOString() : dateMoment.format();
            if (_.isFunction(this.config.formatOutputDate))
                dateOutput = this.config.formatOutputDate.call(this, date, type) || dateOutput;
            return dateOutput;
        },

        _onRangeUpdate: function (ev) {
            var startMoment = moment(this.start),
                endMoment = moment(this.end);
            $('[name=' + this.config.output.from + ']').val(this.formatOutputDate(this.start, 'start'));
            $('[name=' + this.config.output.to + ']').val(this.formatOutputDate(this.end, 'end'));
            // $('[name=' + this.config.output.from + ']').val(this.config.toISOString ? startMoment.toISOString() : startMoment.format());
            // $('[name=' + this.config.output.to + ']').val(this.config.toISOString ? endMoment.toISOString() : endMoment.format());
        },

        _onInputClick: function(ev) {
            this.pikaday.config({field: this.config.inputFrom});
            $(this.config.inputFrom).val('');
            this.pikaday.setDate();

            this.reset();
            this.pikaday.draw();
        }
    };

    $.fn.daterangepicker = function(options) {
        var args = arguments;
        if (!args || !args.length) {
            args = [{ }];
        }

        return this.each(function() {
            var $this = $(this),
                data = $this.data('daterangepicker');

            if (!data && typeof args[0] === 'object') {
                var options = $.extend({}, args[0]);
                options.field = $this.get(0);
                $this.data('daterangepicker', $.extend(new DateRangePicker(options)));
            } else if (typeof option == 'string') {
                data[option].call($this);
            }
        });
    };

}));
