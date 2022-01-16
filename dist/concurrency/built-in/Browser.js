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
const util_1 = require("../../util");
const ConcurrencyImplementation_1 = require("../ConcurrencyImplementation");
const debug = (0, util_1.debugGenerator)("BrowserConcurrency");
const BROWSER_TIMEOUT = 5000;
class Browser extends ConcurrencyImplementation_1.default {
    constructor() {
        super(...arguments);
        this.nextWorkerId = 0;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {});
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {});
    }
    workerInstance(perBrowserOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const workerId = this.nextWorkerId;
            this.nextWorkerId = this.nextWorkerId + 1;
            const options = perBrowserOptions || this.options;
            let chrome = yield this.puppeteer.launch(options);
            let page;
            let context;
            return {
                id: workerId,
                jobInstance: () =>
                    __awaiter(this, void 0, void 0, function* () {
                        yield (0, util_1.timeoutExecute)(
                            BROWSER_TIMEOUT,
                            (() =>
                                __awaiter(this, void 0, void 0, function* () {
                                    context =
                                        yield chrome.createIncognitoBrowserContext();
                                    page = yield context.newPage();
                                }))()
                        );
                        return {
                            resources: {
                                page,
                            },
                            close: () =>
                                __awaiter(this, void 0, void 0, function* () {
                                    yield (0,
                                    util_1.timeoutExecute)(BROWSER_TIMEOUT, context.close());
                                }),
                        };
                    }),
                close: () =>
                    __awaiter(this, void 0, void 0, function* () {
                        yield chrome.close();
                    }),
                repair: () =>
                    __awaiter(this, void 0, void 0, function* () {
                        debug("Starting repair");
                        try {
                            // will probably fail, but just in case the repair was not necessary
                            yield chrome.close();
                        } catch (e) {}
                        // just relaunch as there is only one page per browser
                        chrome = yield this.puppeteer.launch(this.options);
                    }),
            };
        });
    }
}
exports.default = Browser;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQnJvd3Nlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb25jdXJyZW5jeS9idWlsdC1pbi9Ccm93c2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBR0EscUNBQTREO0FBQzVELDRFQUVzQztBQUV0QyxNQUFNLEtBQUssR0FBRyxJQUFBLHFCQUFjLEVBQUMsb0JBQW9CLENBQUMsQ0FBQztBQUVuRCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUM7QUFFN0IsTUFBcUIsT0FBUSxTQUFRLG1DQUF5QjtJQUE5RDs7UUFJWSxpQkFBWSxHQUFHLENBQUMsQ0FBQztJQW1EN0IsQ0FBQztJQXREZ0IsSUFBSTs4REFBSSxDQUFDO0tBQUE7SUFDVCxLQUFLOzhEQUFJLENBQUM7S0FBQTtJQUlWLGNBQWMsQ0FDdkIsaUJBQXlEOztZQUV6RCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO1lBQ25DLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUM7WUFFMUMsTUFBTSxPQUFPLEdBQUcsaUJBQWlCLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQztZQUNsRCxJQUFJLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ2xELElBQUksSUFBb0IsQ0FBQztZQUN6QixJQUFJLE9BQWlDLENBQUM7WUFFdEMsT0FBTztnQkFDSCxFQUFFLEVBQUUsUUFBUTtnQkFDWixXQUFXLEVBQUUsR0FBUyxFQUFFO29CQUNwQixNQUFNLElBQUEscUJBQWMsRUFDaEIsZUFBZSxFQUNmLENBQUMsR0FBUyxFQUFFO3dCQUNSLE9BQU8sR0FBRyxNQUFNLE1BQU0sQ0FBQyw2QkFBNkIsRUFBRSxDQUFDO3dCQUN2RCxJQUFJLEdBQUcsTUFBTSxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQ25DLENBQUMsQ0FBQSxDQUFDLEVBQUUsQ0FDUCxDQUFDO29CQUVGLE9BQU87d0JBQ0gsU0FBUyxFQUFFOzRCQUNQLElBQUk7eUJBQ1A7d0JBRUQsS0FBSyxFQUFFLEdBQVMsRUFBRTs0QkFDZCxNQUFNLElBQUEscUJBQWMsRUFBQyxlQUFlLEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7d0JBQzNELENBQUMsQ0FBQTtxQkFDSixDQUFDO2dCQUNOLENBQUMsQ0FBQTtnQkFFRCxLQUFLLEVBQUUsR0FBUyxFQUFFO29CQUNkLE1BQU0sTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUN6QixDQUFDLENBQUE7Z0JBRUQsTUFBTSxFQUFFLEdBQVMsRUFBRTtvQkFDZixLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztvQkFDekIsSUFBSTt3QkFDQSxvRUFBb0U7d0JBQ3BFLE1BQU0sTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO3FCQUN4QjtvQkFBQyxPQUFPLENBQUMsRUFBRSxHQUFFO29CQUVkLHNEQUFzRDtvQkFDdEQsTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUN2RCxDQUFDLENBQUE7YUFDSixDQUFDO1FBQ04sQ0FBQztLQUFBO0NBQ0o7QUF2REQsMEJBdURDIn0=
