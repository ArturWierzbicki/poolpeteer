"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("../../util");
const ConcurrencyImplementation_1 = require("../ConcurrencyImplementation");
const debug = util_1.debugGenerator('BrowserConcurrency');
const BROWSER_TIMEOUT = 5000;
class Browser extends ConcurrencyImplementation_1.default {
    constructor() {
        super(...arguments);
        this.nextWorkerId = 0;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () { });
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
                jobInstance: () => __awaiter(this, void 0, void 0, function* () {
                    yield util_1.timeoutExecute(BROWSER_TIMEOUT, (() => __awaiter(this, void 0, void 0, function* () {
                        context = yield chrome.createIncognitoBrowserContext();
                        page = yield context.newPage();
                    }))());
                    return {
                        resources: {
                            page,
                        },
                        close: () => __awaiter(this, void 0, void 0, function* () {
                            yield util_1.timeoutExecute(BROWSER_TIMEOUT, context.close());
                        }),
                    };
                }),
                close: () => __awaiter(this, void 0, void 0, function* () {
                    yield chrome.close();
                }),
                repair: () => __awaiter(this, void 0, void 0, function* () {
                    debug('Starting repair');
                    try {
                        // will probably fail, but just in case the repair was not necessary
                        yield chrome.close();
                    }
                    catch (e) { }
                    // just relaunch as there is only one page per browser
                    chrome = yield this.puppeteer.launch(this.options);
                }),
            };
        });
    }
}
exports.default = Browser;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQnJvd3Nlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb25jdXJyZW5jeS9idWlsdC1pbi9Ccm93c2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBR0EscUNBQTREO0FBQzVELDRFQUF5RjtBQUN6RixNQUFNLEtBQUssR0FBRyxxQkFBYyxDQUFDLG9CQUFvQixDQUFDLENBQUM7QUFFbkQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDO0FBRTdCLE1BQXFCLE9BQVEsU0FBUSxtQ0FBeUI7SUFBOUQ7O1FBSVksaUJBQVksR0FBRyxDQUFDLENBQUM7SUFpRDdCLENBQUM7SUFwRGdCLElBQUk7OERBQUksQ0FBQztLQUFBO0lBQ1QsS0FBSzs4REFBSSxDQUFDO0tBQUE7SUFJVixjQUFjLENBQUMsaUJBQXNEOztZQUc5RSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO1lBQ25DLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUM7WUFFMUMsTUFBTSxPQUFPLEdBQUcsaUJBQWlCLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQztZQUNsRCxJQUFJLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ2xELElBQUksSUFBb0IsQ0FBQztZQUN6QixJQUFJLE9BQWlDLENBQUM7WUFFdEMsT0FBTztnQkFDSCxFQUFFLEVBQUUsUUFBUTtnQkFDWixXQUFXLEVBQUUsR0FBUyxFQUFFO29CQUNwQixNQUFNLHFCQUFjLENBQUMsZUFBZSxFQUFFLENBQUMsR0FBUyxFQUFFO3dCQUM5QyxPQUFPLEdBQUcsTUFBTSxNQUFNLENBQUMsNkJBQTZCLEVBQUUsQ0FBQzt3QkFDdkQsSUFBSSxHQUFHLE1BQU0sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUNuQyxDQUFDLENBQUEsQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFFTixPQUFPO3dCQUNILFNBQVMsRUFBRTs0QkFDUCxJQUFJO3lCQUNQO3dCQUVELEtBQUssRUFBRSxHQUFTLEVBQUU7NEJBQ2QsTUFBTSxxQkFBYyxDQUFDLGVBQWUsRUFBRSxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQzt3QkFDM0QsQ0FBQyxDQUFBO3FCQUNKLENBQUM7Z0JBQ04sQ0FBQyxDQUFBO2dCQUVELEtBQUssRUFBRSxHQUFTLEVBQUU7b0JBQ2QsTUFBTSxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ3pCLENBQUMsQ0FBQTtnQkFFRCxNQUFNLEVBQUUsR0FBUyxFQUFFO29CQUNmLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO29CQUN6QixJQUFJO3dCQUNBLG9FQUFvRTt3QkFDcEUsTUFBTSxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7cUJBQ3hCO29CQUFDLE9BQU8sQ0FBQyxFQUFFLEdBQUU7b0JBRWQsc0RBQXNEO29CQUN0RCxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ3ZELENBQUMsQ0FBQTthQUNKLENBQUM7UUFDTixDQUFDO0tBQUE7Q0FFSjtBQXJERCwwQkFxREMifQ==