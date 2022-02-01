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
        return __awaiter(this, void 0, void 0, function* () {
            if (this.browser.canHandle) {
                return this.browser.canHandle(job.data);
            }
            return this.activeJobs.length === 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL1dvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUdBLGlDQUE2RDtBQUM3RCwrQkFBK0I7QUFNL0IsTUFBTSxLQUFLLEdBQUcsSUFBQSxxQkFBYyxFQUFDLFFBQVEsQ0FBQyxDQUFDO0FBRXZDLE1BQU0sZUFBZSxHQUFHO0lBQ3BCLElBQUksRUFBRSxFQUFFO0NBQ1gsQ0FBQztBQVNGLE1BQU0sc0JBQXNCLEdBQUcsRUFBRSxDQUFDO0FBY2xDLE1BQXFCLE1BQU07SUFVdkIsWUFBbUIsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQTBCO1FBRnpFLGVBQVUsR0FBK0IsRUFBRSxDQUFDO1FBR3hDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBQ2IsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7SUFDM0IsQ0FBQztJQUVZLFNBQVMsQ0FBQyxHQUE2Qjs7WUFDaEQsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRTtnQkFDeEIsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDM0M7WUFFRCxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQztRQUN4QyxDQUFDO0tBQUE7SUFFWSxNQUFNLENBQ2YsSUFBdUMsRUFDdkMsR0FBNkIsRUFDN0IsT0FBZTs7WUFFZixJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUUxQixJQUFJLFdBQVcsR0FBdUIsSUFBSSxDQUFDO1lBQzNDLElBQUksSUFBSSxHQUFnQixJQUFJLENBQUM7WUFFN0IsSUFB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
