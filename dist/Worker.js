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
const util_1 = require("./util");
const util_2 = require("util");
const debug = (0, util_1.debugGenerator)("Worker");
const DEFAULT_OPTIONS = {
    args: [],
};
const BROWSER_INSTANCE_TRIES = 10;
class Worker {
    constructor({ cluster, args, id, browser }) {
        this.activeJobs = [];
        this.cluster = cluster;
        this.args = args;
        this.id = id;
        this.browser = browser;
    }
    canHandle(job) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            return (
                ((_b = (_a = this.browser).canHandle) === null || _b === void 0
                    ? void 0
                    : _b.call(_a, job.data)) || this.activeJobs.length === 0
            );
        });
    }
    handle(task, job, timeout) {
        return __awaiter(this, void 0, void 0, function* () {
            this.activeJobs.push(job);
            let jobInstance = null;
            let page = null;
            let tries = 0;
            while (jobInstance === null) {
                try {
                    jobInstance = yield this.browser.jobInstance(job.data);
                    page = jobInstance.resources.page;
                } catch (err) {
                    debug(
                        `Error getting browser page (try: ${tries}), message: ${err.message}`
                    );
                    yield this.browser.repair();
                    tries += 1;
                    if (tries >= BROWSER_INSTANCE_TRIES) {
                        throw new Error("Unable to get browser page");
                    }
                }
            }
            // We can be sure that page is set now, otherwise an exception would've been thrown
            page = page; // this is just for TypeScript
            let errorState = null;
            page.on("error", (err) => {
                errorState = err;
                (0, util_1.log)(
                    `Error (page error) crawling ${(0, util_2.inspect)(
                        job.data
                    )} // message: ${err.message}`
                );
            });
            let result;
            try {
                result = yield (0, util_1.timeoutExecute)(
                    timeout,
                    task({
                        page,
                        // data might be undefined if queue is only called with a function
                        // we ignore that case, as the user should use Cluster<undefined> in that case
                        // to get correct typings
                        data: job.data,
                        worker: {
                            id: this.id,
                        },
                    })
                );
            } catch (err) {
                errorState = err;
                (0,
                util_1.log)(`Error crawling ${(0, util_2.inspect)(job.data)} // message: ${err.message}`);
            }
            debug(`Finished executing task on worker #${this.id}`);
            try {
                yield jobInstance.close();
            } catch (e) {
                debug(
                    `Error closing browser instance for ${(0, util_2.inspect)(
                        job.data
                    )}: ${e.message}`
                );
                yield this.browser.repair();
            }
            this.activeJobs.splice(this.activeJobs.indexOf(job), 1);
            if (errorState) {
                return {
                    type: "error",
                    error: errorState || new Error("asf"),
                };
            }
            return {
                data: result,
                type: "success",
            };
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.browser.close();
            } catch (err) {
                debug(
                    `Unable to close worker browser. Error message: ${err.message}`
                );
            }
            debug(`Closed #${this.id}`);
        });
    }
    isIdle() {
        return this.activeJobs.length === 0;
    }
}
exports.default = Worker;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL1dvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUdBLGlDQUE2RDtBQUM3RCwrQkFBK0I7QUFNL0IsTUFBTSxLQUFLLEdBQUcsSUFBQSxxQkFBYyxFQUFDLFFBQVEsQ0FBQyxDQUFDO0FBRXZDLE1BQU0sZUFBZSxHQUFHO0lBQ3BCLElBQUksRUFBRSxFQUFFO0NBQ1gsQ0FBQztBQVNGLE1BQU0sc0JBQXNCLEdBQUcsRUFBRSxDQUFDO0FBY2xDLE1BQXFCLE1BQU07SUFVdkIsWUFBbUIsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQTBCO1FBRnpFLGVBQVUsR0FBK0IsRUFBRSxDQUFDO1FBR3hDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBQ2IsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7SUFDM0IsQ0FBQztJQUVZLFNBQVMsQ0FBQyxHQUE2Qjs7O1lBQ2hELE9BQU8sQ0FDSCxDQUFBLE1BQUEsTUFBQSxJQUFJLENBQUMsT0FBTyxFQUFDLFNBQVMsbURBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FDckUsQ0FBQzs7S0FDTDtJQUVZLE1BQU0sQ0FDZixJQUF1QyxFQUN2QyxHQUE2QixFQUM3QixPQUFlOztZQUVmLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBRTFCLElBQUksV0FBVyxHQUF1QixJQUFJLENBQUM7WUFDM0MsSUFBSSxJQUFJLEdBQWdCLElBQUksQ0FBQztZQUU3QixJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7WUFFZCxPQUFPLFdBQVcsS0FB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
