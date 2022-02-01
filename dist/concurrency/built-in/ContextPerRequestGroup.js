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
exports.ContextPerRequestGroup = void 0;
const ConcurrencyImplementation_1 = require("../ConcurrencyImplementation");
const util_1 = require("../../util");
const groupId_1 = require("./groupId");
class ContextPerRequestGroup extends ConcurrencyImplementation_1.default {
    constructor(options, puppeteer, deps) {
        super(options, puppeteer);
        this.deps = deps;
        this.workersByGroupId = new Map();
        this.workersInitByGroupId = new Map();
        this.nextWorkerId = 0;
        this.repairing = false;
        this.repairRequested = false;
        this.waitingForRepairResolvers = [];
        this.createWorker = (options, onShutdown, jobData, groupId) =>
            __awaiter(this, void 0, void 0, function* () {
                if (this.repairRequested) {
                    yield this.repair();
                }
                const workerId = this.nextWorkerId;
                this.nextWorkerId = this.nextWorkerId + 1;
                this.deps.log.debug(
                    `Creating new worker`,
                    "groupId",
                    groupId,
                    "workerId",
                    workerId
                );
                const context = yield this.createContext();
                return new Worker({
                    log: this.deps.log,
                    id: workerId,
                    groupId,
                    context,
                    onRepairRequested: () => {
                        this.repairRequested = true;
                        this.repair();
                    },
                    shutdownTimeout: this.deps.workerShutdownTimeout,
                    onShutdown: () => {
                        this.workersByGroupId.delete(groupId);
                        onShutdown(workerId);
                    },
                });
            });
    }
    repair() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (
                this.repairing ||
                Object.values(this.workersByGroupId).some(
                    (w) => w.activeJobs > 0
                )
            ) {
                // already repairing or there are still pages open? wait for start/finish
                yield new Promise((resolve) =>
                    this.waitingForRepairResolvers.push(resolve)
                );
                return;
            }
            this.repairing = true;
            yield this.closeAllWorkers();
            try {
                // will probably fail, but just in case the repair was not necessary
                yield (0,
                util_1.timeoutExecute)(30000, (_a = this.getBrowser()) === null || _a === void 0 ? void 0 : _a.close());
            } catch (e) {
                this.deps.log.debug("Unable to close browser.");
            }
            try {
                this.browser = yield this.puppeteer.launch(this.options);
            } catch (err) {
                throw new Error("Unable to restart chrome.");
            }
            const workers = Object.values(this.workersByGroupId);
            for (const worker of workers) {
                const context = yield this.createContext();
                worker.onRepairFinished(context);
            }
            this.waitingForRepairResolvers.forEach((resolve) =>
                resolve(undefined)
            );
            this.waitingForRepairResolvers = [];
            this.repairing = false;
            this.repairRequested = false;
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this.browser = yield this.puppeteer.launch(this.options);
            this.browserHealthCheckInterval = setInterval(() => {
                if (
                    this.browser &&
                    !this.repairing &&
                    !this.browser.isConnected()
                ) {
                    this.repair();
                }
            }, 20000);
        });
    }
    closeAllWorkers() {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.allSettled(Object.values(this.workersInitByGroupId));
            try {
                yield Promise.all(
                    Object.values(this.workersByGroupId).map((w) => w.close())
                );
            } catch (err) {
                this.deps.log.debug(
                    "Failed to close some workers",
                    "err",
                    err.stack
                );
            }
            this.workersByGroupId.clear();
            this.workersInitByGroupId.clear();
        });
    }
    close() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.repairing) {
                yield this.repair();
            }
            this.deps.log.debug(
                "Closing ContextPerRequestGroupConcurrency manager"
            );
            if (this.browserHealthCheckInterval) {
                clearInterval(this.browserHealthCheckInterval);
            }
            yield this.closeAllWorkers();
            yield (_a = this.browser) === null || _a === void 0
                ? void 0
                : _a.close();
        });
    }
    getBrowser() {
        if (!this.browser) {
            throw new Error("ContextPerRequestGroup has not been initialized");
        }
        return this.browser;
    }
    createContext() {
        return __awaiter(this, void 0, void 0, function* () {
            const browser = this.getBrowser();
            return browser.createIncognitoBrowserContext();
        });
    }
    workerInstance(perBrowserOptions, onShutdown, jobData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.repairRequested) {
                yield this.repair();
            }
            const groupId = (0, groupId_1.getGroupId)(jobData);
            this.deps.log.debug(`Retrieving new worker!`, "groupId", groupId);
            const initializingWorker = this.workersInitByGroupId.get(groupId);
            if (initializingWorker) {
                this.deps.log.debug(
                    `Waiting for initializing worker`,
                    "groupId",
                    groupId
                );
                return initializingWorker;
            }
            const existingWorker = this.workersByGroupId.get(groupId);
            if (existingWorker) {
                existingWorker.refreshShutdownTimeout();
                return existingWorker;
            }
            const workingInitPromise = this.createWorker(
                perBrowserOptions || this.options,
                onShutdown,
                jobData,
                groupId
            );
            this.workersInitByGroupId.set(groupId, workingInitPromise);
            workingInitPromise
                .then((worker) => {
                    this.deps.log.debug(
                        `Worker initialized`,
                        "groupId",
                        groupId,
                        "workerId",
                        worker.id
                    );
                    this.workersByGroupId.set(groupId, worker);
                })
                .finally(() => {
                    this.deps.log.debug(
                        "Deleting worker init promise",
                        "groupId",
                        groupId
                    );
                    this.workersInitByGroupId.delete(groupId);
                });
            return workingInitPromise;
        });
    }
    getExistingWorkerInstanceFor(jobData) {
        if (this.repairRequested) {
            return undefined;
        }
        const groupId = (0, groupId_1.getGroupId)(jobData);
        this.deps.log.debug("Retrieving existing worker", "groupId", groupId);
        const worker = this.workersByGroupId.get(groupId);
        if (worker) {
            this.deps.log.debug(
                "Found existing worker",
                "groupId",
                groupId,
                "workerId",
                worker.id
            );
            worker.refreshShutdownTimeout();
        }
        this.deps.log.debug(
            "Worker not found",
            "groupId",
            groupId,
            "workerId",
            worker === null || worker === void 0 ? void 0 : worker.id
        );
        return worker;
    }
}
exports.ContextPerRequestGroup = ContextPerRequestGroup;
class Worker {
    constructor(deps) {
        this.deps = deps;
        this.repairRequested = false;
        this.repairing = false;
        this.waitingForRepairResolvers = [];
        this.activeJobs = 0;
        this.isClosed = false;
        this.onRepairFinished = (context) => {
            this.repairing = false;
            this.repairRequested = false;
            this.closeCurrentContext();
            this.waitingForRepairResolvers.forEach((resolve) => resolve());
            this.waitingForRepairResolvers = [];
            this.currentContext = context;
            this.refreshShutdownTimeout();
        };
        this.closeCurrentContext = () =>
            __awaiter(this, void 0, void 0, function* () {
                if (!this.currentContext) {
                    return;
                }
                try {
                    yield this.currentContext.close();
                } catch (err) {
                    this.deps.log.debug(
                        "Unable to close context",
                        "groupId",
                        this.deps.groupId,
                        "workerId",
                        this.deps.id,
                        "err",
                        err.stack
                    );
                }
            });
        this.refreshShutdownTimeout = () => {
            if (this.activeJobs !== 0 || this.isClosed) {
                return;
            }
            if (this.shutdownTimeout) {
                clearTimeout(this.shutdownTimeout);
            }
            this.shutdownTimeout = setTimeout(() => {
                if (this.activeJobs === 0) {
                    this.close();
                    this.deps.log.debug(
                        `Shutting down worker after timeout`,
                        "groupId",
                        this.deps.groupId,
                        "workerId",
                        this.deps.id,
                        "activeJobs",
                        this.activeJobs
                    );
                }
            }, this.deps.shutdownTimeout);
        };
        this.currentContext = deps.context;
        this.refreshShutdownTimeout();
    }
    repair() {
        return __awaiter(this, void 0, void 0, function* () {
            this.repairRequested = true;
            if (this.activeJobs !== 0) {
                // already repairing or there are still pages open? wait for start/finish
                yield new Promise((resolve) =>
                    this.waitingForRepairResolvers.push(resolve)
                );
                return;
            }
            this.repairing = true;
            if (this.shutdownTimeout) {
                clearTimeout(this.shutdownTimeout);
            }
            this.deps.onRepairRequested();
        });
    }
    get id() {
        return this.deps.id;
    }
    jobInstance(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.repairRequested) {
                this.deps.log.debug(
                    "Waiting for repair to finish before returning new job instance",
                    "groupId",
                    this.deps.groupId,
                    "workerId",
                    this.deps.id
                );
                yield this.repair();
            }
            this.deps.log.debug(
                "returning new job instance",
                "groupId",
                this.deps.groupId,
                "workerId",
                this.deps.id,
                "activeJobs",
                this.activeJobs
            );
            const page = yield this.currentContext.newPage();
            if (this.shutdownTimeout) {
                clearTimeout(this.shutdownTimeout);
                this.shutdownTimeout = undefined;
            }
            this.activeJobs += 1;
            this.deps.log.debug(
                "Worker returning new job instance",
                "groupId",
                this.deps.groupId,
                "workerId",
                this.deps.id,
                "openInstances",
                this.activeJobs
            );
            return {
                resources: {
                    page,
                },
                close: () =>
                    __awaiter(this, void 0, void 0, function* () {
                        this.activeJobs -= 1;
                        this.refreshShutdownTimeout();
                        try {
                            yield page.close();
                        } finally {
                            if (this.repairRequested) {
                                yield this.repair();
                            }
                        }
                    }),
            };
        });
    }
    canHandle(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isClosed || this.repairRequested) {
                return false;
            }
            // we can limit the number of open pages with this function
            return (0, groupId_1.getGroupId)(data) === this.deps.groupId;
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isClosed) {
                return;
            }
            this.isClosed = true;
            if (this.shutdownTimeout) {
                clearTimeout(this.shutdownTimeout);
            }
            yield this.deps.onShutdown();
            if (this.repairRequested) {
                yield this.repair();
            }
            this.deps.log.debug(
                `Closing worker`,
                "groupId",
                this.deps.groupId,
                "workerId",
                this.deps.id
            );
            try {
                yield (0,
                util_1.timeoutExecute)(5000, this.currentContext.close());
            } catch (err) {
                this.deps.log.debug(
                    `Failed while closing context`,
                    "groupId",
                    this.deps.groupId,
                    "workerId",
                    this.deps.id,
                    "err",
                    err
                );
            }
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29udGV4dFBlclJlcXVlc3RHcm91cC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb25jdXJyZW5jeS9idWlsdC1pbi9Db250ZXh0UGVyUmVxdWVzdEdyb3VwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLDRFQUdzQztBQUd0QyxxQ0FBNEM7QUFDNUMsdUNBQWtEO0FBV2xELE1BQWEsc0JBRVgsU0FBUSxtQ0FBa0M7SUFXeEMsWUFDSSxPQUFnQyxFQUNoQyxTQUF3QixFQUNoQixJQUFnQztRQUV4QyxLQUFLLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRmxCLFNBQUksR0FBSixJQUFJLENBQTRCO1FBWnBDLHFCQUFnQixHQUFvQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQzlELHlCQUFvQixHQUN4QixJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ04saUJBQVksR0FBRyxDQUFDLENBQUM7UUFFakIsY0FBUyxHQUFHLEtBQUssQ0FBQztRQUNsQixvQkFBZSxHQUFHLEtBQUssQ0FBQztRQUN4Qiw4QkFBeUIsR0FBaUMsRUFBRSxDQUFDO1FBNkc3RCxpQkFBWSxHQUFHLENBQ25CLE9BQXNCLEVBQ3RCLFVBQXNDLEVBQ3RDLE9BQWdCLEVBQ2hCLE9BQWtCLEVBQ3BCLEVBQUU7WUFDQSxJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUU7Z0JBQ3RCLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO2FBQ3ZCO1lBQ0QsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztZQUVuQyxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO1lBQzFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FDZixxQkFBcUIsRUFDckIsU0FBUyxFQUNULE9BQU8sRUFDUCxVQUFVLEVBQ1YsUUFBUSxDQUNYLENBQUM7WUFFRixNQUFNLE9BQU8s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
