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
exports.BrowserPerRequestGroup = void 0;
const ConcurrencyImplementation_1 = require("../ConcurrencyImplementation");
class BrowserPerRequestGroup extends ConcurrencyImplementation_1.default {
    constructor(options, puppeteer, deps) {
        super(options, puppeteer);
        this.deps = deps;
        this.workersByGroupId = {};
        this.workersInitByGroupId = {};
        this.deletionTimeoutByWorkerId = {};
        this.nextWorkerId = 0;
        this.getGroupId = (jobData) => {
            const maybeDataWithGroupId = jobData;
            if (
                typeof (maybeDataWithGroupId === null ||
                maybeDataWithGroupId === void 0
                    ? void 0
                    : maybeDataWithGroupId.groupId) === "string"
            ) {
                return maybeDataWithGroupId.groupId;
            }
            return `${Math.random() * 1000}`;
        };
        this.createWorker = (options, onShutdown, jobData, groupId) =>
            __awaiter(this, void 0, void 0, function* () {
                const workerId = this.nextWorkerId;
                this.nextWorkerId = this.nextWorkerId + 1;
                this.deps.log.debug(
                    `Creating new worker`,
                    "groupId",
                    groupId,
                    "workerId",
                    workerId
                );
                const browser = yield this.puppeteer.launch(options);
                return new Worker({
                    log: this.deps.log,
                    id: workerId,
                    groupId,
                    browser,
                    puppeteer: this.puppeteer,
                    launchOptions: options,
                    onShutdown: () => onShutdown(workerId),
                });
            });
        this.setupDeletionTimer = (workerId, groupId) => {
            const existingTimeout = this.deletionTimeoutByWorkerId[workerId];
            if (existingTimeout) {
                this.deps.log.debug(
                    `Refreshing worker deletion timeout`,
                    "groupId",
                    groupId,
                    "workerId",
                    workerId
                );
                existingTimeout.refresh();
                return;
            }
            this.deletionTimeoutByWorkerId[workerId] = setTimeout(() => {
                const worker = this.workersByGroupId[groupId];
                this.deps.log.debug(
                    `Shutting down worker after timeout`,
                    "groupId",
                    groupId,
                    "workerId",
                    workerId
                );
                delete this.workersByGroupId[groupId];
                delete this.deletionTimeoutByWorkerId[workerId];
                worker.close();
            }, this.deps.workerShutdownTimer);
        };
    }
    repair() {
        return __awaiter(this, void 0, void 0, function* () {});
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {});
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            this.deps.log.debug(
                "Closing BrowserPerRequestGroupConcurrency manager"
            );
            yield Promise.all(
                Object.values(this.workersByGroupId).map((w) => w.close())
            );
        });
    }
    workerInstance(perBrowserOptions, onShutdown, jobData) {
        return __awaiter(this, void 0, void 0, function* () {
            const groupId = this.getGroupId(jobData);
            this.deps.log.debug(`Retrieving new worker!`, "groupId", groupId);
            const initializingWorker = this.workersInitByGroupId[groupId];
            if (initializingWorker) {
                this.deps.log.debug(
                    `Waiting for initializing worker`,
                    "groupId",
                    groupId
                );
                return initializingWorker;
            }
            const existingWorker = this.workersByGroupId[groupId];
            if (existingWorker) {
                this.setupDeletionTimer(existingWorker.id, groupId);
                return existingWorker;
            }
            const workingInitPromise = this.createWorker(
                perBrowserOptions || this.options,
                onShutdown,
                jobData,
                groupId
            );
            this.workersInitByGroupId[groupId] = workingInitPromise;
            workingInitPromise
                .then((worker) => {
                    this.deps.log.debug(
                        `Worker initialized`,
                        "groupId",
                        groupId,
                        "workerId",
                        worker.id
                    );
                    this.workersByGroupId[groupId] = worker;
                    this.setupDeletionTimer(worker.id, groupId);
                })
                .finally(() => {
                    this.deps.log.debug(
                        "Deleting worker init promise",
                        "groupId",
                        groupId
                    );
                    delete this.workersInitByGroupId[groupId];
                });
            return workingInitPromise;
        });
    }
    getExistingWorkerInstanceFor(jobData) {
        const groupId = this.getGroupId(jobData);
        this.deps.log.debug("Retrieving existing worker", "groupId", groupId);
        const worker = this.workersByGroupId[groupId];
        if (worker) {
            this.deps.log.debug(
                "Found existing worker",
                "groupId",
                groupId,
                "workerId",
                worker.id
            );
            this.setupDeletionTimer(worker.id, groupId);
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
exports.BrowserPerRequestGroup = BrowserPerRequestGroup;
class Worker {
    constructor(deps) {
        this.deps = deps;
        this.repairing = false;
        this.isClosed = false;
        this.openInstances = 0;
        this.waitingForRepairResolvers = [];
        this.currentBrowser = deps.browser;
        this.browserHealthCheckInterval = setInterval(() => {
            if (!this.currentBrowser.isConnected()) {
                this.close();
            }
        }, 20000);
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
            this.deps.log.debug(
                "Worker starting repair",
                "groupId",
                this.deps.groupId,
                "workerId",
                this.deps.id
            );
            try {
                // will probably fail, but just in case the repair was not necessary
                yield this.currentBrowser.close();
            } catch (err) {
                this.deps.log.debug(
                    "Unable to close browser",
                    "groupId",
                    this.deps.groupId,
                    "workerId",
                    this.deps.id,
                    "err",
                    err.stack
                );
            }
            if (this.isClosed) {
                this.deps.onShutdown();
                return;
            }
            try {
                this.currentBrowser = yield this.deps.puppeteer.launch(
                    this.deps.launchOptions
                );
                this.deps.log.debug(
                    "Worker finished repair",
                    "groupId",
                    this.deps.groupId,
                    "workerId",
                    this.deps.id
                );
            } catch (err) {
                throw new Error("Unable to restart chrome." + err.stack);
            }
            this.repairing = false;
            this.openInstances = 0;
            this.waitingForRepairResolvers.forEach((resolve) => resolve());
            this.waitingForRepairResolvers = [];
        });
    }
    get id() {
        return this.deps.id;
    }
    jobInstance(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.repairing) {
                this.deps.log.debug(
                    "Waiting for repair to finish before returning new job instance",
                    "groupId",
                    this.deps.groupId,
                    "workerId",
                    this.deps.id
                );
                yield this.repair();
            }
            const page = yield this.currentBrowser.newPage();
            this.openInstances += 1;
            this.deps.log.debug(
                "Worker returning new job instance",
                "groupId",
                this.deps.groupId,
                "workerId",
                this.deps.id,
                "openInstances",
                this.openInstances
            );
            return {
                resources: {
                    page,
                },
                close: () =>
                    __awaiter(this, void 0, void 0, function* () {
                        this.openInstances -= 1;
                        yield page.close();
                    }),
            };
        });
    }
    canHandle(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // we can limit the number of open pages with this function
            return true;
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            this.isClosed = true;
            clearInterval(this.browserHealthCheckInterval);
            yield this.deps.onShutdown();
            if (this.repairing) {
                yield this.repair();
            }
            this.deps.log.debug(
                `Closing worker`,
                "groupId",
                this.deps.groupId,
                "workerId",
                this.deps.id
            );
            yield this.currentBrowser.close();
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQnJvd3NlclBlclJlcXVlc3RHcm91cC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb25jdXJyZW5jeS9idWlsdC1pbi9Ccm93c2VyUGVyUmVxdWVzdEdyb3VwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLDRFQUdzQztBQWF0QyxNQUFhLHNCQUVYLFNBQVEsbUNBQWtDO0lBTXhDLFlBQ0ksT0FBZ0MsRUFDaEMsU0FBd0IsRUFDaEIsSUFBMkM7UUFFbkQsS0FBSyxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQztRQUZsQixTQUFJLEdBQUosSUFBSSxDQUF1QztRQVIvQyxxQkFBZ0IsR0FBb0MsRUFBRSxDQUFDO1FBQ3ZELHlCQUFvQixHQUE2QyxFQUFFLENBQUM7UUFDcEUsOEJBQXlCLEdBQW1DLEVBQUUsQ0FBQztRQUMvRCxpQkFBWSxHQUFHLENBQUMsQ0FBQztRQXdCakIsZUFBVSxHQUFHLENBQUMsT0FBZ0IsRUFBVSxFQUFFO1lBQzlDLE1BQU0sb0JBQW9CLEdBQUcsT0FBOEIsQ0FBQztZQUU1RCxJQUFJLE9BQU8sQ0FBQSxvQkFBb0IsYUFBcEIsb0JBQW9CLHVCQUFwQixvQkFBb0IsQ0FBRSxPQUFPLENBQUEsS0FBSyxRQUFRLEVBQUU7Z0JBQ25ELE9BQU8sb0JBQW9CLENBQUMsT0FBTyxDQUFDO2FBQ3ZDO1lBRUQsT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxJQUFJLEVBQUUsQ0FBQztRQUNyQyxDQUFDLENBQUM7UUFFTSxpQkFBWSxHQUFHLENBQ25CLE9BQXNCLEVBQ3RCLFVBQXNDLEVBQ3RDLE9BQWdCLEVBQ2hCLE9BQWUsRUFDakIsRUFBRTtZQUNBLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7WUFFbkMsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQztZQUMxQyxJQUFJLENBQUMsSUFBSSxDQUFD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
