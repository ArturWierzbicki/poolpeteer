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
const Worker_1 = require("./Worker");
const util = require("./util");
const debug = util.debugGenerator("Workers");
class Workers {
    constructor(deps) {
        this.deps = deps;
        this.workers = [];
        this.workersStarting = 0;
        this.lastLaunchedWorkerTime = 0;
        this.isClosed = false;
    }
    launchWorker(job) {
        return __awaiter(this, void 0, void 0, function* () {
            // signal, that we are starting a worker
            this.workersStarting += 1;
            this.lastLaunchedWorkerTime = Date.now();
            try {
                const workerBrowserInstance =
                    yield this.deps.browser.workerInstance(
                        this.deps.browserOptions,
                        (workerId) => {
                            this.removeWorker(workerId);
                        },
                        job.data
                    );
                if (!this.getWorkerById(workerBrowserInstance.id)) {
                    const worker = new Worker_1.default({
                        cluster: this.deps.cluster,
                        args: [""],
                        browser: workerBrowserInstance,
                        id: workerBrowserInstance.id,
                    });
                    if (this.isClosed) {
                        // cluster was closed while we created a new worker (should rarely happen)
                        worker.close();
                    } else {
                        this.workers.push(worker);
                    }
                }
            } catch (err) {
                throw new Error(
                    `Unable to launch browser for worker, error message: ${err.message}`
                );
            } finally {
                this.workersStarting -= 1;
            }
        });
    }
    allowedToStartWorker() {
        const workerCount = this.workers.length + this.workersStarting;
        return (
            (this.deps.maxConcurrency === 0 ||
                workerCount < this.deps.maxConcurrency) &&
            // just allow worker creaton every few milliseconds
            (this.deps.workerCreationDelay === 0 ||
                this.lastLaunchedWorkerTime + this.deps.workerCreationDelay <
                    Date.now())
        );
    }
    isAnyJobActive() {
        return this.workers.some((w) => !w.isIdle());
    }
    getWorkerById(id) {
        return this.workers.find((w) => w.id === id);
    }
    removeWorker(workerId) {
        const worker = this.getWorkerById(workerId);
        if (worker) {
            this.workers.splice(this.workers.indexOf(worker), 1);
        }
    }
    canLaunchWorker(job) {
        return __awaiter(this, void 0, void 0, function* () {
            return (
                !this.deps.browser.getExistingWorkerInstanceFor(
                    job === null || job === void 0 ? void 0 : job.data
                ) && this.allowedToStartWorker()
            );
        });
    }
    getWorker(job) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingInstance =
                this.deps.browser.getExistingWorkerInstanceFor(job.data);
            if (existingInstance) {
                return this.getWorkerById(existingInstance.id);
            }
            return this.workers.find((w) => w.canHandle(job));
        });
    }
    canHandle(job) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const worker = yield this.getWorker(job);
            if (!worker) {
                return false;
            }
            return yield (_a = this.getWorkerById(worker.id)) === null ||
            _a === void 0
                ? void 0
                : _a.canHandle(job);
        });
    }
    hasFreeCapacity(job) {
        return (job && this.canHandle(job)) || this.canLaunchWorker(job);
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            debug(
                `Closing worker pool. Open workers: ${this.workers.length}, starting: ${this.workersStarting}`
            );
            this.isClosed = true;
            yield Promise.all(this.workers.map((w) => w.close()));
        });
    }
    busyWorkersCount() {
        return this.workers.filter((w) => !w.isIdle()).length;
    }
    count() {
        return this.workersStarting + this.workers.length;
    }
    get() {
        return this.workers;
    }
    getStartingCount() {
        return this.workersStarting;
    }
}
exports.default = Workers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV29ya2Vycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9Xb3JrZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQ0EscUNBQThCO0FBSTlCLCtCQUErQjtBQVcvQixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBRTdDLE1BQXFCLE9BQU87SUFPeEIsWUFBb0IsSUFBc0M7UUFBdEMsU0FBSSxHQUFKLElBQUksQ0FBa0M7UUFObEQsWUFBTyxHQUFrQyxFQUFFLENBQUM7UUFDNUMsb0JBQWUsR0FBRyxDQUFDLENBQUM7UUFDcEIsMkJBQXNCLEdBQVcsQ0FBQyxDQUFDO1FBRW5DLGFBQVEsR0FBRyxLQUFLLENBQUM7SUFFb0MsQ0FBQztJQUVqRCxZQUFZLENBQUMsR0FBNkI7O1lBQ25ELHdDQUF3QztZQUN4QyxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUMsQ0FBQztZQUMxQixJQUFJLENBQUMsc0JBQXNCLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBRXpDLElBQUk7Z0JBQ0EsTUFBTSxxQkFBcUIsR0FDdkIsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQ2xDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUN4QixDQUFDLFFBQWdCLEVBQUUsRUFBRTtvQkFDakIsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDaEMsQ0FBQyxFQUNELEdBQUcsQ0FBQyxJQUFJLENBQ1gsQ0FBQztnQkFFTixJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFLENBQUMsRUFBRTtvQkFDL0MsTUFBTSxNQUFNLEdBQUcsSUFBSSxnQkFBTSxDQUFzQjt3QkFDM0MsT0FBTyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTzt3QkFDMUIsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO3dCQUNW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
