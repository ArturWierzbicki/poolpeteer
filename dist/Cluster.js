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
const Job_1 = require("./Job");
const Display_1 = require("./Display");
const util = require("./util");
const builtInConcurrency = require("./concurrency/builtInConcurrency");
const Queue_1 = require("./Queue");
const SystemMonitor_1 = require("./SystemMonitor");
const events_1 = require("events");
const Workers_1 = require("./Workers");
const debug = util.debugGenerator("Cluster");
const DEFAULT_OPTIONS = {
    concurrency: 2,
    maxConcurrency: 1,
    workerCreationDelay: 0,
    puppeteerOptions: {
        // headless: false, // just for testing...
    },
    monitor: false,
    timeout: 30 * 1000,
    retryLimit: 0,
    retryDelay: 0,
    skipDuplicateUrls: false,
    sameDomainDelay: 0,
    puppeteer: undefined,
};
const MONITORING_DISPLAY_INTERVAL = 500;
const CHECK_FOR_WORK_INTERVAL = 100;
const WORK_CALL_INTERVAL_LIMIT = 10;
class Cluster extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.workers = null;
        this.allTargetCount = 0;
        this.jobQueue = new Queue_1.default();
        this.errorCount = 0;
        this.taskFunction = null;
        this.idleResolvers = [];
        this.waitForOneResolvers = [];
        this.browser = null;
        this.isClosed = false;
        this.startTime = Date.now();
        this.monitoringInterval = null;
        this.display = null;
        this.duplicateCheckUrls = new Set();
        this.lastDomainAccesses = new Map();
        this.systemMonitor = new SystemMonitor_1.default();
        this.checkForWorkInterval = null;
        this.nextWorkCall = 0;
        this.workCallTimeout = null;
        this.options = Object.assign(
            Object.assign({}, DEFAULT_OPTIONS),
            options
        );
        if (this.options.monitor) {
            this.monitoringInterval = setInterval(
                () => this.monitor(),
                MONITORING_DISPLAY_INTERVAL
            );
        }
    }
    static launch(options) {
        return __awaiter(this, void 0, void 0, function* () {
            debug("Launching");
            const cluster = new Cluster(options);
            yield cluster.init();
            return cluster;
        });
    }
    init() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const browserOptions = this.options.puppeteerOptions;
            let puppeteer = this.options.puppeteer;
            if (this.options.puppeteer == null) {
                // check for null or undefined
                puppeteer = require("puppeteer");
            } else {
                debug("Using provided (custom) puppteer object.");
            }
            if (this.options.concurrency === Cluster.CONCURRENCY_PAGE) {
                this.browser = new builtInConcurrency.Page(
                    browserOptions,
                    puppeteer
                );
            } else if (
                this.options.concurrency === Cluster.CONCURRENCY_CONTEXT
            ) {
                this.browser = new builtInConcurrency.Context(
                    browserOptions,
                    puppeteer
                );
            } else if (
                this.options.concurrency === Cluster.CONCURRENCY_BROWSER
            ) {
                this.browser = new builtInConcurrency.Browser(
                    browserOptions,
                    puppeteer
                );
            } else if (
                this.options.concurrency ===
                Cluster.CONCURRENCY_BROWSER_PER_REQUEST_GROUP
            ) {
                const logger = util.debugGenerator("BrowserPerRequestGroup");
                this.browser = new builtInConcurrency.BrowserPerRequestGroup(
                    browserOptions,
                    puppeteer,
                    {
                        workerShutdownTimeout:
                            (_a = this.options.workerShutdownTimeout) !==
                                null && _a !== void 0
                                ? _a
                                : 5000,
                        log: {
                            debug: (msg, ...args) => {
                                logger(`${msg}${JSON.stringify(args)}`);
                            },
                        },
                    }
                );
            } else if (
                this.options.concurrency ===
                Cluster.CONCURRENCY_CONTEXT_PER_REQUEST_GROUP
            ) {
                const logger = util.debugGenerator("BrowserPerRequestGroup");
                this.browser = new builtInConcurrency.ContextPerRequestGroup(
                    browserOptions,
                    puppeteer,
                    {
                        workerShutdownTimeout:
                            (_b = this.options.workerShutdownTimeout) !==
                                null && _b !== void 0
                                ? _b
                                : 5000,
                        log: {
                            debug: (msg, ...args) => {
                                logger(`${msg}${JSON.stringify(args)}`);
                            },
                        },
                    }
                );
            } else if (typeof this.options.concurrency === "function") {
                this.browser = new this.options.concurrency(
                    browserOptions,
                    puppeteer
                );
            } else {
                throw new Error(
                    `Unknown concurrency option: ${this.options.concurrency}`
                );
            }
            this.workers = new Workers_1.default({
                browserOptions,
                cluster: this,
                browser: this.browser,
                maxConcurrency: this.options.maxConcurrency,
                workerCreationDelay: this.options.workerCreationDelay,
            });
            if (typeof this.options.maxConcurrency !== "number") {
                throw new Error("maxConcurrency must be of number type");
            }
            try {
                yield this.browser.init();
            } catch (err) {
                throw new Error(
                    `Unable to launch browser, error message: ${err.message}`
                );
            }
            if (this.options.monitor) {
                yield this.systemMonitor.init();
            }
            // needed in case resources are getting free (like CPU/memory) to check if
            // can launch workers
            this.checkForWorkInterval = setInterval(
                () => this.work(),
                CHECK_FOR_WORK_INTERVAL
            );
        });
    }
    task(taskFunction) {
        return __awaiter(this, void 0, void 0, function* () {
            this.taskFunction = taskFunction;
        });
    }
    // check for new work soon (wait if there will be put more data into the queue, first)
    work() {
        return __awaiter(this, void 0, void 0, function* () {
            // make sure, we only call work once every WORK_CALL_INTERVAL_LIMIT (currently: 10ms)
            if (this.workCallTimeout === null) {
                const now = Date.now();
                // calculate when the next work call should happen
                this.nextWorkCall = Math.max(
                    this.nextWorkCall + WORK_CALL_INTERVAL_LIMIT,
                    now
                );
                const timeUntilNextWorkCall = this.nextWorkCall - now;
                this.workCallTimeout = setTimeout(() => {
                    this.workCallTimeout = null;
                    this.doWork();
                }, timeUntilNextWorkCall);
            }
        });
    }
    scheduleNextWork() {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.workers.hasFreeCapacity(this.jobQueue.peek())) {
                this.work();
            }
        });
    }
    doWork() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.jobQueue.size() === 0) {
                // no jobs available
                if (!this.workers.isAnyJobActive()) {
                    this.idleResolvers.forEach((resolve) => resolve());
                }
                return;
            }
            const job = this.jobQueue.peek();
            if (job === undefined) {
                // skip, there are items in the queue but they are all delayed
                return;
            }
            const url = job.getUrl();
            const domain = job.getDomain();
            // Check if URL was already crawled (on skipDuplicateUrls)
            if (
                this.options.skipDuplicateUrls &&
                url !== undefined &&
                this.duplicateCheckUrls.has(url)
            ) {
                // already crawled, just ignore
                debug(`Skipping duplicate URL: ${job.getUrl()}`);
                this.jobQueue.remove(job);
                this.work();
                return;
            }
            // Check if the job needs to be delayed due to sameDomainDelay
            if (this.options.sameDomainDelay !== 0 && domain !== undefined) {
                const lastDomainAccess = this.lastDomainAccesses.get(domain);
                if (
                    lastDomainAccess !== undefined &&
                    lastDomainAccess + this.options.sameDomainDelay > Date.now()
                ) {
                    this.jobQueue.remove(job);
                    this.jobQueue.push(job, {
                        delayUntil:
                            lastDomainAccess + this.options.sameDomainDelay,
                    });
                    this.work();
                    return;
                }
            }
            if (!(yield this.workers.canHandle(job))) {
                // no workers available
                if (yield this.workers.canLaunchWorker(job)) {
                    yield this.workers.launchWorker(job);
                    this.work();
                }
                return;
            }
            const worker = yield this.workers.getWorker(job);
            if (!worker) {
                // this shouldn't happen
                return;
            }
            this.jobQueue.remove(job);
            // Check are all positive, let's actually run the job
            if (this.options.skipDuplicateUrls && url !== undefined) {
                this.duplicateCheckUrls.add(url);
            }
            if (this.options.sameDomainDelay !== 0 && domain !== undefined) {
                this.lastDomainAccesses.set(domain, Date.now());
            }
            this.scheduleNextWork();
            let jobFunction;
            if (job.taskFunction !== undefined) {
                jobFunction = job.taskFunction;
            } else if (this.taskFunction !== null) {
                jobFunction = this.taskFunction;
            } else {
                throw new Error("No task function defined!");
            }
            let result = null;
            try {
                result = yield worker.handle(
                    jobFunction,
                    job,
                    this.options.timeout
                );
            } catch (err) {
                debug("swallowing " + err.message);
            }
            if (result.type === "error") {
                if (job.executeCallbacks) {
                    job.executeCallbacks.reject(result.error);
                    this.errorCount += 1;
                } else {
                    // ignore retryLimits in case of executeCallbacks
                    job.addError(result.error);
                    const jobWillRetry = job.tries <= this.options.retryLimit;
                    this.emit(
                        "taskerror",
                        result.error,
                        job.data,
                        jobWillRetry
                    );
                    if (jobWillRetry) {
                        let delayUntil = undefined;
                        if (this.options.retryDelay !== 0) {
                            delayUntil = Date.now() + this.options.retryDelay;
                        }
                        this.jobQueue.push(job, {
                            delayUntil,
                        });
                    } else {
                        this.errorCount += 1;
                    }
                }
            } else if (result.type === "success" && job.executeCallbacks) {
                job.executeCallbacks.resolve(result.data);
            }
            this.waitForOneResolvers.forEach((resolve) => resolve(job.data));
            this.waitForOneResolvers = [];
            this.work();
        });
    }
    // Type Guard for TypeScript
    isTaskFunction(data) {
        return typeof data === "function";
    }
    queueJob(data, taskFunction, callbacks) {
        let realData;
        let realFunction;
        if (this.isTaskFunction(data)) {
            realFunction = data;
        } else {
            realData = data;
            realFunction = taskFunction;
        }
        const job = new Job_1.default(realData, realFunction, callbacks);
        this.allTargetCount += 1;
        this.jobQueue.push(job);
        this.emit("queue", realData, realFunction);
        this.work();
    }
    queue(data, taskFunction) {
        return __awaiter(this, void 0, void 0, function* () {
            this.queueJob(data, taskFunction);
        });
    }
    execute(data, taskFunction) {
        return new Promise((resolve, reject) => {
            const callbacks = { resolve, reject };
            this.queueJob(data, taskFunction, callbacks);
        });
    }
    idle() {
        return new Promise((resolve) => this.idleResolvers.push(resolve));
    }
    waitForOne() {
        return new Promise((resolve) => this.waitForOneResolvers.push(resolve));
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            debug("Closing");
            this.isClosed = true;
            clearInterval(this.checkForWorkInterval);
            clearTimeout(this.workCallTimeout);
            yield this.workers.close();
            try {
                yield this.browser.close();
            } catch (err) {
                debug(
                    `Error: Unable to close browser, message: ${err.message}`
                );
            }
            if (this.monitoringInterval) {
                this.monitor();
                clearInterval(this.monitoringInterval);
            }
            if (this.display) {
                this.display.close();
            }
            this.systemMonitor.close();
            debug("Closed");
        });
    }
    monitor() {
        if (!this.display) {
            this.display = new Display_1.default();
        }
        const display = this.display;
        const now = Date.now();
        const timeDiff = now - this.startTime;
        const doneTargets =
            this.allTargetCount -
            this.jobQueue.size() -
            this.workers.busyWorkersCount();
        const donePercentage =
            this.allTargetCount === 0 ? 1 : doneTargets / this.allTargetCount;
        const donePercStr = (100 * donePercentage).toFixed(2);
        const errorPerc =
            doneTargets === 0
                ? "0.00"
                : ((100 * this.errorCount) / doneTargets).toFixed(2);
        const timeRunning = util.formatDuration(timeDiff);
        let timeRemainingMillis = -1;
        if (donePercentage !== 0) {
            timeRemainingMillis = timeDiff / donePercentage - timeDiff;
        }
        const timeRemining = util.formatDuration(timeRemainingMillis);
        const cpuUsage = this.systemMonitor.getCpuUsage().toFixed(1);
        const memoryUsage = this.systemMonitor.getMemoryUsage().toFixed(1);
        const pagesPerSecond =
            doneTargets === 0
                ? "0"
                : ((doneTargets * 1000) / timeDiff).toFixed(2);
        display.log(`== Start:     ${util.formatDateTime(this.startTime)}`);
        display.log(
            `== Now:       ${util.formatDateTime(
                now
            )} (running for ${timeRunning})`
        );
        display.log(
            `== Progress:  ${doneTargets} / ${this.allTargetCount} (${donePercStr}%)` +
                `, errors: ${this.errorCount} (${errorPerc}%)`
        );
        display.log(
            `== Remaining: ${timeRemining} (@ ${pagesPerSecond} pages/second)`
        );
        display.log(`== Sys. load: ${cpuUsage}% CPU / ${memoryUsage}% memory`);
        display.log(`== Workers:   ${this.workers.count()}`);
        const workers = this.workers.get();
        workers.forEach((worker, i) => {
            let workOrIdle;
            let workerUrl = "";
            let jobCount = "";
            if (worker.isIdle()) {
                workOrIdle = "IDLE";
            } else {
                workOrIdle = "WORK";
                const jobs = worker.activeJobs;
                jobCount = jobs.length > 1 ? `${jobs.length} JOBS: ` : "";
                workerUrl = jobs.length
                    ? worker.activeJobs
                          .map((j) => j.getUrl() || "UNKNOWN TARGET")
                          .join(", ")
                    : "NO TARGET (should not be happening)";
            }
            display.log(`   #${i} ${workOrIdle} ${jobCount} ${workerUrl}`);
        });
        for (let i = 0; i < this.workers.getStartingCount(); i += 1) {
            display.log(`   #${workers.length + i} STARTING...`);
        }
        display.resetCursor();
    }
}
exports.default = Cluster;
Cluster.CONCURRENCY_PAGE = 1; // shares cookies, etc.
Cluster.CONCURRENCY_CONTEXT = 2; // no cookie sharing (uses contexts)
Cluster.CONCURRENCY_BROWSER = 3; // no cookie sharing and individual processes (uses contexts)
Cluster.CONCURRENCY_BROWSER_PER_REQUEST_GROUP = 4; // share browser for requests from the same group
Cluster.CONCURRENCY_CONTEXT_PER_REQUEST_GROUP = 5; // share context for requests from the same group
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2x1c3Rlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9DbHVzdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQUEsK0JBQTZFO0FBQzdFLHVDQUFnQztBQUNoQywrQkFBK0I7QUFHL0IsdUVBQXVFO0FBR3ZFLG1DQUE0QjtBQUM1QixtREFBNEM7QUFDNUMsbUNBQXNDO0FBSXRDLHVDQUFnQztBQUdoQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBdUI3QyxNQUFNLGVBQWUsR0FBbUI7SUFDcEMsV0FBVyxFQUFFLENBQUM7SUFDZCxjQUFjLEVBQUUsQ0FBQztJQUNqQixtQkFBbUIsRUFBRSxDQUFDO0lBQ3RCLGdCQUFnQixFQUFFO0lBQ2QsMENBQTBDO0tBQzdDO0lBQ0QsT0FBTyxFQUFFLEtBQUs7SUFDZCxPQUFPLEVBQUUsRUFBRSxHQUFHLElBQUk7SUFDbEIsVUFBVSxFQUFFLENBQUM7SUFDYixVQUFVLEVBQUUsQ0FBQztJQUNiLGlCQUFpQixFQUFFLEtBQUs7SUFDeEIsZUFBZSxFQUFFLENBQUM7SUFDbEIsU0FBUyxFQUFFLFNBQVM7Q0FDdkIsQ0FBQztBQWNGLE1BQU0sMkJBQTJCLEdBQUcsR0FBRyxDQUFDO0FBQ3hDLE1BQU0sdUJBQXVCLEdBQUcsR0FBRyxDQUFDO0FBQ3BDLE1BQU0sd0JBQXdCLEdBQUcsRUFBRSxDQUFDO0FBRXBDLE1BQXFCLE9BR25CLFNBQVEscUJBQVk7SUErQ2xCLFlBQW9CLE9BQXdDO1FBQ3hELEtBQUssRUFBRSxDQUFDO1FBeENKLFlBQU8sR0FBaUMsSUFHL0MsQ0FBQztRQUVNLG1CQUFjLEdBQUcsQ0FBQyxDQUFDO1FBQ25CLGFBQVEsR0FBb0MsSUFBSSxlQUFLLEVBRTFELENBQUM7UUFDSSxlQUFVLEdBQUcsQ0FBQyxDQUFDO1FBRWYsaUJBQVksR0FBNkMsSUFBSSxDQUFDO1FBQzlELGtCQUFhLEdBQW1CLEVBQUUsQ0FB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
