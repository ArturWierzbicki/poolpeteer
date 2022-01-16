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
const getGroupId = (jobData) => {
    const maybeDataWithGroupId = jobData;
    if (
        typeof (maybeDataWithGroupId === null || maybeDataWithGroupId === void 0
            ? void 0
            : maybeDataWithGroupId.groupId) === "string"
    ) {
        return maybeDataWithGroupId.groupId;
    }
    return `${Math.random() * 1000}`;
};
class BrowserPerRequestGroup extends ConcurrencyImplementation_1.default {
    constructor(options, puppeteer, deps) {
        super(options, puppeteer);
        this.deps = deps;
        this.workersByGroupId = {};
        this.workersInitByGroupId = {};
        this.nextWorkerId = 0;
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
                    shutdownTimeout: this.deps.workerShutdownTimeout,
                    onShutdown: () => {
                        delete this.workersByGroupId[groupId];
                        onShutdown(workerId);
                    },
                });
            });
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
            const groupId = getGroupId(jobData);
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
                existingWorker.refreshShutdownTimeout();
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
        const groupId = getGroupId(jobData);
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
exports.BrowserPerRequestGroup = BrowserPerRequestGroup;
class Worker {
    constructor(deps) {
        this.deps = deps;
        this.repairing = false;
        this.isClosed = false;
        this.openInstances = 0;
        this.waitingForRepairResolvers = [];
        this.refreshShutdownTimeout = () => {
            if (this.openInstances !== 0) {
                return;
            }
            if (this.shutdownTimeout) {
                clearTimeout(this.shutdownTimeout);
            }
            this.shutdownTimeout = setTimeout(() => {
                if (this.openInstances === 0) {
                    this.close();
                    this.deps.log.debug(
                        `Shutting down worker after timeout`,
                        "groupId",
                        this.deps.groupId,
                        "workerId",
                        this.deps.id,
                        "activeJobs",
                        this.openInstances
                    );
                }
            }, this.deps.shutdownTimeout);
        };
        this.currentBrowser = deps.browser;
        this.browserHealthCheckInterval = setInterval(() => {
            if (!this.currentBrowser.isConnected()) {
                this.close();
            }
        }, 20000);
        this.refreshShutdownTimeout();
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
            if (this.shutdownTimeout) {
                clearTimeout(this.shutdownTimeout);
                this.shutdownTimeout = undefined;
            }
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
                        this.refreshShutdownTimeout();
                        yield page.close();
                    }),
            };
        });
    }
    canHandle(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // we can limit the number of open pages with this function
            return getGroupId(data) === this.deps.groupId;
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isClosed) {
                return;
            }
            this.isClosed = true;
            clearInterval(this.browserHealthCheckInterval);
            if (this.shutdownTimeout) {
                clearTimeout(this.shutdownTimeout);
            }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQnJvd3NlclBlclJlcXVlc3RHcm91cC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb25jdXJyZW5jeS9idWlsdC1pbi9Ccm93c2VyUGVyUmVxdWVzdEdyb3VwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLDRFQUdzQztBQWF0QyxNQUFNLFVBQVUsR0FBRyxDQUFDLE9BQWdCLEVBQVUsRUFBRTtJQUM1QyxNQUFNLG9CQUFvQixHQUFHLE9BQThCLENBQUM7SUFFNUQsSUFBSSxPQUFPLENBQUEsb0JBQW9CLGFBQXBCLG9CQUFvQix1QkFBcEIsb0JBQW9CLENBQUUsT0FBTyxDQUFBLEtBQUssUUFBUSxFQUFFO1FBQ25ELE9BQU8sb0JBQW9CLENBQUMsT0FBTyxDQUFDO0tBQ3ZDO0lBRUQsT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxJQUFJLEVBQUUsQ0FBQztBQUNyQyxDQUFDLENBQUM7QUFFRixNQUFhLHNCQUVYLFNBQVEsbUNBQWtDO0lBS3hDLFlBQ0ksT0FBZ0MsRUFDaEMsU0FBd0IsRUFDaEIsSUFBMkM7UUFFbkQsS0FBSyxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQztRQUZsQixTQUFJLEdBQUosSUFBSSxDQUF1QztRQVAvQyxxQkFBZ0IsR0FBb0MsRUFBRSxDQUFDO1FBQ3ZELHlCQUFvQixHQUE2QyxFQUFFLENBQUM7UUFDcEUsaUJBQVksR0FBRyxDQUFDLENBQUM7UUF3QmpCLGlCQUFZLEdBQUcsQ0FDbkIsT0FBc0IsRUFDdEIsVUFBc0MsRUFDdEMsT0FBZ0IsRUFDaEIsT0FBZSxFQUNqQixFQUFFO1lBQ0EsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztZQUVuQyxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO1lBQzFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FDZixxQkFB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
