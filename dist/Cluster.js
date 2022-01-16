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
        var _a;
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
                this.browser = new builtInConcurrency.BrowserPerRequestGroup(
                    browserOptions,
                    puppeteer,
                    {
                        workerShutdownTimer:
                            (_a = this.options.workerShutdownTimer) !== null &&
                            _a !== void 0
                                ? _a
                                : 10000,
                        log: {
                            debug: util.debugGenerator(
                                "BrowserPerRequestGroup"
                            ),
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
Cluster.CONCURRENCY_BROWSER_PER_REQUEST_GROUP = 3; // share browser for requests from the same group
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2x1c3Rlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9DbHVzdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQUEsK0JBQTZFO0FBQzdFLHVDQUFnQztBQUNoQywrQkFBK0I7QUFHL0IsdUVBQXVFO0FBR3ZFLG1DQUE0QjtBQUM1QixtREFBNEM7QUFDNUMsbUNBQXNDO0FBSXRDLHVDQUFnQztBQUdoQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBdUI3QyxNQUFNLGVBQWUsR0FBbUI7SUFDcEMsV0FBVyxFQUFFLENBQUM7SUFDZCxjQUFjLEVBQUUsQ0FBQztJQUNqQixtQkFBbUIsRUFBRSxDQUFDO0lBQ3RCLGdCQUFnQixFQUFFO0lBQ2QsMENBQTBDO0tBQzdDO0lBQ0QsT0FBTyxFQUFFLEtBQUs7SUFDZCxPQUFPLEVBQUUsRUFBRSxHQUFHLElBQUk7SUFDbEIsVUFBVSxFQUFFLENBQUM7SUFDYixVQUFVLEVBQUUsQ0FBQztJQUNiLGlCQUFpQixFQUFFLEtBQUs7SUFDeEIsZUFBZSxFQUFFLENBQUM7SUFDbEIsU0FBUyxFQUFFLFNBQVM7Q0FDdkIsQ0FBQztBQWNGLE1BQU0sMkJBQTJCLEdBQUcsR0FBRyxDQUFDO0FBQ3hDLE1BQU0sdUJBQXVCLEdBQUcsR0FBRyxDQUFDO0FBQ3BDLE1BQU0sd0JBQXdCLEdBQUcsRUFBRSxDQUFDO0FBRXBDLE1BQXFCLE9BR25CLFNBQVEscUJBQVk7SUE4Q2xCLFlBQW9CLE9BQXdDO1FBQ3hELEtBQUssRUFBRSxDQUFDO1FBeENKLFlBQU8sR0FBaUMsSUFHL0MsQ0FBQztRQUVNLG1CQUFjLEdBQUcsQ0FBQyxDQUFDO1FBQ25CLGFBQVEsR0FBb0MsSUFBSSxlQUFLLEVBRTFELENBQUM7UUFDSSxlQUFVLEdBQUcsQ0FBQyxDQUFDO1FBRWYsaUJBQVksR0FBNkMsSUFBSSxDQUFDO1FBQzlELGtCQUFhLEdBQW1CLEVBQUUsQ0FB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
