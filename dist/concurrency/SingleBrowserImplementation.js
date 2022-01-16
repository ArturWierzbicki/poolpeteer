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
const ConcurrencyImplementation_1 = require("./ConcurrencyImplementation");
const util_1 = require("../util");
const debug = (0, util_1.debugGenerator)("SingleBrowserImpl");
const BROWSER_TIMEOUT = 5000;
class SingleBrowserImplementation extends ConcurrencyImplementation_1.default {
    constructor(options, puppeteer) {
        super(options, puppeteer);
        this.browser = null;
        this.nextWorkerId = 0;
        this.repairing = false;
        this.repairRequested = false;
        this.openInstances = 0;
        this.waitingForRepairResolvers = [];
    }
    getBrowser() {
        if (!this.browser) {
            throw new Error(
                "SingleBrowserImplementation has not been initialized!"
            );
        }
        return this.browser;
    }
    repair() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.openInstances !== 0 || this.repairing) {
                // already repairing or there are still pages open? wait for start/finish
                yield new Promise((resolve) =>
                    this.waitingForRepairResolvers.push(resolve)
                );
                return;
            }
            this.repairing = true;
            debug("Starting repair");
            try {
                // will probably fail, but just in case the repair was not necessary
                yield this.getBrowser().close();
            } catch (e) {
                debug("Unable to close browser.");
            }
            try {
                this.browser = yield this.puppeteer.launch(this.options);
            } catch (err) {
                throw new Error("Unable to restart chrome.");
            }
            this.repairRequested = false;
            this.repairing = false;
            this.waitingForRepairResolvers.forEach((resolve) =>
                resolve(undefined)
            );
            this.waitingForRepairResolvers = [];
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this.browser = yield this.puppeteer.launch(this.options);
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.getBrowser().close();
        });
    }
    workerInstance() {
        return __awaiter(this, void 0, void 0, function* () {
            let resources;
            const workerId = this.nextWorkerId;
            this.nextWorkerId = this.nextWorkerId + 1;
            return {
                id: workerId,
                jobInstance: () =>
                    __awaiter(this, void 0, void 0, function* () {
                        if (this.repairRequested) {
                            yield this.repair();
                        }
                        yield (0, util_1.timeoutExecute)(
                            BROWSER_TIMEOUT,
                            (() =>
                                __awaiter(this, void 0, void 0, function* () {
                                    resources = yield this.createResources();
                                }))()
                        );
                        this.openInstances += 1;
                        return {
                            resources,
                            close: () =>
                                __awaiter(this, void 0, void 0, function* () {
                                    this.openInstances -= 1; // decrement first in case of error
                                    yield (0,
                                    util_1.timeoutExecute)(BROWSER_TIMEOUT, this.freeResources(resources));
                                    if (this.repairRequested) {
                                        yield this.repair();
                                    }
                                }),
                        };
                    }),
                close: () => __awaiter(this, void 0, void 0, function* () {}),
                repair: () =>
                    __awaiter(this, void 0, void 0, function* () {
                        debug("Repair requested");
                        this.repairRequested = true;
                        yield this.repair();
                    }),
            };
        });
    }
}
exports.default = SingleBrowserImplementation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2luZ2xlQnJvd3NlckltcGxlbWVudGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbmN1cnJlbmN5L1NpbmdsZUJyb3dzZXJJbXBsZW1lbnRhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUVBLDJFQUVxQztBQUVyQyxrQ0FBeUQ7QUFFekQsTUFBTSxLQUFLLEdBQUcsSUFBQSxxQkFBYyxFQUFDLG1CQUFtQixDQUFDLENBQUM7QUFFbEQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDO0FBRTdCLE1BQThCLDJCQUE0QixTQUFRLG1DQUF5QjtJQVN2RixZQUNJLE9BQW1DLEVBQ25DLFNBQXdCO1FBRXhCLEtBQUssQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFacEIsWUFBTyxHQUE2QixJQUFJLENBQUM7UUFFM0MsaUJBQVksR0FBRyxDQUFDLENBQUM7UUFDakIsY0FBUyxHQUFZLEtBQUssQ0FBQztRQUMzQixvQkFBZSxHQUFZLEtBQUssQ0FBQztRQUNqQyxrQkFBYSxHQUFXLENBQUMsQ0FBQztRQUMxQiw4QkFBeUIsR0FBaUMsRUFBRSxDQUFDO0lBT3JFLENBQUM7SUFFUyxVQUFVO1FBQ2hCLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ2YsTUFBTSxJQUFJLEtBQUssQ0FDWCx1REFBdUQsQ0FDMUQsQ0FBQztTQUNMO1FBRUQsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDO0lBQ3hCLENBQUM7SUFFYSxNQUFNOztZQUNoQixJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7Z0JBQzVDLHlFQUF5RTtnQkFDekUsTUFBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQzFCLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQy9DLENBQUM7Z0JBQ0YsT0FBTzthQUNWO1lBRUQsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7WUFDdEIsS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFFekIsSUFBSTtnQkFDQSxvRUFBb0U7Z0JBQ3BFLE1BQU0sSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDO2FBQ25DO1lBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQ1IsS0FBSyxDQUFDLDBCQUEwQixDQUFDLENBQUM7YUFDckM7WUFFRCxJQUFJO2dCQUNBLElBQUksQ0FBQyxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7YUFDNUQ7WUFBQyxPQUFPLEdBQUcsRUFBRTtnQkFDVixNQUFNLElBQUksS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUM7YUFDaEQ7WUFDRCxJQUFJLENBQUMsZUFBZSxHQUFHLEtBQUssQ0FBQztZQUM3QixJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztZQUN2QixJQUFJLENBQUMseUJBQXlCLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUN4RSxJQUFJLENBQUMseUJBQXlCLEdBQUcsRUFBRSxDQUFDO1FBQ3hDLENBQUM7S0FBQTtJQUVZLElBQUk7O1lBQ2IsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM3RCxDQUFDO0tBQUE7SUFFWSxLQUFLOztZQUNkLE1BQU0sSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ3BDLENBQUM7S0FBQTtJQU1ZLGNBQWM7O1lBQ3ZCLElBQUksU0FBdUIsQ0FBQztZQUU1QixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO1lBRW5DLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUM7WUFFMUMsT0FBTztnQkFDSCxFQUFFLEVBQUUsUUFBUTtnQkFDWixXQUFXLEVBQUUsR0FBUyxFQUFFO29CQUNwQixJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUU7d0JBQ3RCLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO3FCQUN2QjtvQkFFRCxNQUFNLElBQUEscUJBQWMsRUFDaEIsZUFBZSxFQUNmLENBQUMsR0FBUyxFQUFFO3dCQUNSLFNBQVMsR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztvQkFDN0MsQ0FBQyxDQUFBLENBQUMsRUFBRSxDQUNQLENBQUM7b0JBQ0YsSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLENBQUM7b0JBRXhCLE9BQU87d0JBQ0gsU0FBUzt3QkFFVCxLQUFLLEVBQUUsR0FBUyxFQUFFOzRCQUNkLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxDQUFDLENBQUMsbUNBQW1DOzRCQUM1RCxNQUFNLElBQUEscUJBQWMsRUFDaEIsZUFBZSxFQUNmLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQ2hDLENBQUM7NEJBRUYsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFO2dDQUN0QixNQUFNLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQzs2QkFDdkI7d0JBQ0wsQ0FBQyxDQUFBO3FCQUNKLENBQUM7Z0JBQ04sQ0FBQyxDQUFBO2dCQUVELEtBQUssRUFBRSxHQUFTLEVBQUUsZ0RBQUUsQ0FBQyxDQUFBO2dCQUVyQixNQUFNLEVBQUUsR0FBUyxFQUFFO29CQUNmLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO29CQUMxQixJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQztvQkFDNUIsTUFBTSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ3hCLENBQUMsQ0FBQTthQUNKLENBQUM7UUFDTixDQUFDO0tBQUE7Q0FDSjtBQXBIRCw4Q0FvSEMifQ==
