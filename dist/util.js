"use strict";
var __awaiter =
    (this && this.__awaiter) ||
    function (thisArg, _arguments, P, generator) {
        function adopt(value) {
            return value instanceof P
                ? value
                : new P(function (resolve) {
                      resolve(value);
                  });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value));
                } catch (e) {
                    reject(e);
                }
            }
            function rejected(value) {
                try {
                    step(generator["throw"](value));
                } catch (e) {
                    reject(e);
                }
            }
            function step(result) {
                result.done
                    ? resolve(result.value)
                    : adopt(result.value).then(fulfilled, rejected);
            }
            step(
                (generator = generator.apply(thisArg, _arguments || [])).next()
            );
        });
    };
Object.defineProperty(exports, "__esModule", { value: true });
exports.log =
    exports.debugGenerator =
    exports.timeoutExecute =
    exports.formatDuration =
    exports.formatDateTime =
        void 0;
const Debug = require("debug");
function timeUnit(step, name) {
    return { step, name };
}
const TIME_UNITS = [
    timeUnit(1, "ms"),
    timeUnit(1000, "seconds"),
    timeUnit(60, "minutes"),
    timeUnit(60, "hours"),
    timeUnit(24, "days"),
    timeUnit(31, "months"),
    timeUnit(365 / 31, "years"),
];
const TIME_UNIT_THRESHOLD = 0.95;
function padDate(value, num) {
    const str = value.toString();
    if (str.length >= num) {
        return str;
    }
    const zeroesToAdd = num - str.length;
    return "0".repeat(zeroesToAdd) + str;
}
function formatDateTime(datetime) {
    const date = typeof datetime === "number" ? new Date(datetime) : datetime;
    const dateStr =
        `${date.getFullYear()}` +
        `-${padDate(date.getMonth() + 1, 2)}` +
        `-${padDate(date.getDate(), 2)}`;
    const timeStr =
        `${padDate(date.getHours(), 2)}` +
        `:${padDate(date.getMinutes(), 2)}` +
        `:${padDate(date.getSeconds(), 2)}` +
        `.${padDate(date.getMilliseconds(), 3)}`;
    return `${dateStr} ${timeStr}`;
}
exports.formatDateTime = formatDateTime;
function formatDuration(millis) {
    if (millis < 0) {
        return "unknown";
    }
    let remaining = millis;
    let nextUnitIndex = 1;
    while (
        nextUnitIndex < TIME_UNITS.length &&
        remaining / TIME_UNITS[nextUnitIndex].step >= TIME_UNIT_THRESHOLD
    ) {
        remaining = remaining / TIME_UNITS[nextUnitIndex].step;
        nextUnitIndex += 1;
    }
    return `${remaining.toFixed(1)} ${TIME_UNITS[nextUnitIndex - 1].name}`;
}
exports.formatDuration = formatDuration;
function timeoutExecute(millis, promise) {
    return __awaiter(this, void 0, void 0, function* () {
        let timeout = null;
        const result = yield Promise.race([
            (() =>
                __awaiter(this, void 0, void 0, function* () {
                    yield new Promise((resolve) => {
                        timeout = setTimeout(resolve, millis);
                    });
                    throw new Error(`Timeout hit: ${millis}`);
                }))(),
            (() =>
                __awaiter(this, void 0, void 0, function* () {
                    try {
                        return yield promise;
                    } catch (error) {
                        // Cancel timeout in error case
                        clearTimeout(timeout);
                        throw error;
                    }
                }))(),
        ]);
        clearTimeout(timeout); // is there a better way?
        return result;
    });
}
exports.timeoutExecute = timeoutExecute;
function debugGenerator(namespace) {
    return Debug(`puppeteer-cluster: ${namespace}`);
}
exports.debugGenerator = debugGenerator;
const logToConsole = Debug("puppeteer-cluster:log");
logToConsole.log = console.error.bind(console);
function log(msg) {
    logToConsole(msg);
}
exports.log = log;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLCtCQUErQjtBQU8vQixTQUFTLFFBQVEsQ0FBQyxJQUFZLEVBQUUsSUFBWTtJQUN4QyxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDO0FBQzFCLENBQUM7QUFFRCxNQUFNLFVBQVUsR0FBZTtJQUMzQixRQUFRLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQztJQUNqQixRQUFRLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQztJQUN6QixRQUFRLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQztJQUN2QixRQUFRLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQztJQUNyQixRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUNwQixRQUFRLENBQUMsRUFBRSxFQUFFLFFBQVEsQ0FBQztJQUN0QixRQUFRLENBQUMsR0FBRyxHQUFHLEVBQUUsRUFBRSxPQUFPLENBQUM7Q0FDOUIsQ0FBQztBQUVGLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDO0FBRWpDLFNBQVMsT0FBTyxDQUFDLEtBQXNCLEVBQUUsR0FBVztJQUNoRCxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDN0IsSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLEdBQUcsRUFBRTtRQUNuQixPQUFPLEdBQUcsQ0FBQztLQUNkO0lBQ0QsTUFBTSxXQUFXLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUM7SUFDckMsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUN6QyxDQUFDO0FBRUQsU0FBZ0IsY0FBYyxDQUFDLFFBQXVCO0lBQ2xELE1BQU0sSUFBSSxHQUFHLE9BQU8sUUFBUSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMs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
