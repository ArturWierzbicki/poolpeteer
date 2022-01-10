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
const Job_1 = require("./Job");
const Display_1 = require("./Display");
const util = require("./util");
const builtInConcurrency = require("./concurrency/builtInConcurrency");
const Queue_1 = require("./Queue");
const SystemMonitor_1 = require("./SystemMonitor");
const events_1 = require("events");
const Workers_1 = require("./Workers");
const debug = util.debugGenerator('Cluster');
const DEFAULT_OPTIONS = {
    concurrency: 2,
    maxConcurrency: 1,
    workerCreationDelay: 0,
    puppeteerOptions: {
    // headless: false, // just for testing...
    },
    perBrowserOptions: undefined,
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
        this.perBrowserOptions = null;
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
        this.options = Object.assign(Object.assign({}, DEFAULT_OPTIONS), options);
        if (this.options.monitor) {
            this.monitoringInterval = setInterval(() => this.monitor(), MONITORING_DISPLAY_INTERVAL);
        }
    }
    static launch(options) {
        return __awaiter(this, void 0, void 0, function* () {
            debug('Launching');
            const cluster = new Cluster(options);
            yield cluster.init();
            return cluster;
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            const browserOptions = this.options.puppeteerOptions;
            let puppeteer = this.options.puppeteer;
            if (this.options.puppeteer == null) { // check for null or undefined
                puppeteer = require('puppeteer');
            }
            else {
                debug('Using provided (custom) puppteer object.');
            }
            if (this.options.concurrency === Cluster.CONCURRENCY_PAGE) {
                this.browser = new builtInConcurrency.Page(browserOptions, puppeteer);
            }
            else if (this.options.concurrency === Cluster.CONCURRENCY_CONTEXT) {
                this.browser = new builtInConcurrency.Context(browserOptions, puppeteer);
            }
            else if (this.options.concurrency === Cluster.CONCURRENCY_BROWSER) {
                this.browser = new builtInConcurrency.Browser(browserOptions, puppeteer);
            }
            else if (typeof this.options.concurrency === 'function') {
                this.browser = new this.options.concurrency(browserOptions, puppeteer);
            }
            else {
                throw new Error(`Unknown concurrency option: ${this.options.concurrency}`);
            }
            this.workers = new Workers_1.default({
                browserOptions, cluster: this, browser: this.browser,
                maxConcurrency: this.options.maxConcurrency,
                workerCreationDelay: this.options.workerCreationDelay
            });
            if (typeof this.options.maxConcurrency !== 'number') {
                throw new Error('maxConcurrency must be of number type');
            }
            if (this.options.perBrowserOptions
                && this.options.perBrowserOptions.length !== this.options.maxConcurrency) {
                throw new Error('perBrowserOptions length must equal maxConcurrency');
            }
            if (this.options.perBrowserOptions) {
                this.perBrowserOptions = [...this.options.perBrowserOptions];
            }
            try {
                yield this.browser.init();
            }
            catch (err) {
                throw new Error(`Unable to launch browser, error message: ${err.message}`);
            }
            if (this.options.monitor) {
                yield this.systemMonitor.init();
            }
            // needed in case resources are getting free (like CPU/memory) to check if
            // can launch workers
            this.checkForWorkInterval = setInterval(() => this.work(), CHECK_FOR_WORK_INTERVAL);
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
                this.nextWorkCall = Math.max(this.nextWorkCall + WORK_CALL_INTERVAL_LIMIT, now);
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
            if (this.jobQueue.size() === 0) { // no jobs available
                if (!this.workers.isAnyJobActive()) {
                    this.idleResolvers.forEach(resolve => resolve());
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
            if (this.options.skipDuplicateUrls
                && url !== undefined && this.duplicateCheckUrls.has(url)) {
                // already crawled, just ignore
                debug(`Skipping duplicate URL: ${job.getUrl()}`);
                this.work();
                return;
            }
            // Check if the job needs to be delayed due to sameDomainDelay
            if (this.options.sameDomainDelay !== 0 && domain !== undefined) {
                const lastDomainAccess = this.lastDomainAccesses.get(domain);
                if (lastDomainAccess !== undefined
                    && lastDomainAccess + this.options.sameDomainDelay > Date.now()) {
                    this.jobQueue.push(job, {
                        delayUntil: lastDomainAccess + this.options.sameDomainDelay,
                    });
                    this.work();
                    return;
                }
            }
            if (!(yield this.workers.canHandle(job))) { // no workers available
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
            }
            else if (this.taskFunction !== null) {
                jobFunction = this.taskFunction;
            }
            else {
                throw new Error('No task function defined!');
            }
            const result = yield worker.handle(jobFunction, job, this.options.timeout);
            if (result.type === 'error') {
                if (job.executeCallbacks) {
                    job.executeCallbacks.reject(result.error);
                    this.errorCount += 1;
                }
                else { // ignore retryLimits in case of executeCallbacks
                    job.addError(result.error);
                    const jobWillRetry = job.tries <= this.options.retryLimit;
                    this.emit('taskerror', result.error, job.data, jobWillRetry);
                    if (jobWillRetry) {
                        let delayUntil = undefined;
                        if (this.options.retryDelay !== 0) {
                            delayUntil = Date.now() + this.options.retryDelay;
                        }
                        this.jobQueue.push(job, {
                            delayUntil,
                        });
                    }
                    else {
                        this.errorCount += 1;
                    }
                }
            }
            else if (result.type === 'success' && job.executeCallbacks) {
                job.executeCallbacks.resolve(result.data);
            }
            this.waitForOneResolvers.forEach(resolve => resolve(job.data));
            this.waitForOneResolvers = [];
            this.work();
        });
    }
    // Type Guard for TypeScript
    isTaskFunction(data) {
        return (typeof data === 'function');
    }
    queueJob(data, taskFunction, callbacks) {
        let realData;
        let realFunction;
        if (this.isTaskFunction(data)) {
            realFunction = data;
        }
        else {
            realData = data;
            realFunction = taskFunction;
        }
        const job = new Job_1.default(realData, realFunction, callbacks);
        this.allTargetCount += 1;
        this.jobQueue.push(job);
        this.emit('queue', realData, realFunction);
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
        return new Promise(resolve => this.idleResolvers.push(resolve));
    }
    waitForOne() {
        return new Promise(resolve => this.waitForOneResolvers.push(resolve));
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            this.isClosed = true;
            clearInterval(this.checkForWorkInterval);
            clearTimeout(this.workCallTimeout);
            yield this.workers.close();
            try {
                yield this.browser.close();
            }
            catch (err) {
                debug(`Error: Unable to close browser, message: ${err.message}`);
            }
            if (this.monitoringInterval) {
                this.monitor();
                clearInterval(this.monitoringInterval);
            }
            if (this.display) {
                this.display.close();
            }
            this.systemMonitor.close();
            debug('Closed');
        });
    }
    monitor() {
        if (!this.display) {
            this.display = new Display_1.default();
        }
        const display = this.display;
        const now = Date.now();
        const timeDiff = now - this.startTime;
        const doneTargets = this.allTargetCount - this.jobQueue.size() -
            this.workers.busyWorkersCount();
        const donePercentage = this.allTargetCount === 0
            ? 1 : (doneTargets / this.allTargetCount);
        const donePercStr = (100 * donePercentage).toFixed(2);
        const errorPerc = doneTargets === 0 ?
            '0.00' : (100 * this.errorCount / doneTargets).toFixed(2);
        const timeRunning = util.formatDuration(timeDiff);
        let timeRemainingMillis = -1;
        if (donePercentage !== 0) {
            timeRemainingMillis = ((timeDiff) / donePercentage) - timeDiff;
        }
        const timeRemining = util.formatDuration(timeRemainingMillis);
        const cpuUsage = this.systemMonitor.getCpuUsage().toFixed(1);
        const memoryUsage = this.systemMonitor.getMemoryUsage().toFixed(1);
        const pagesPerSecond = doneTargets === 0 ?
            '0' : (doneTargets * 1000 / timeDiff).toFixed(2);
        display.log(`== Start:     ${util.formatDateTime(this.startTime)}`);
        display.log(`== Now:       ${util.formatDateTime(now)} (running for ${timeRunning})`);
        display.log(`== Progress:  ${doneTargets} / ${this.allTargetCount} (${donePercStr}%)`
            + `, errors: ${this.errorCount} (${errorPerc}%)`);
        display.log(`== Remaining: ${timeRemining} (@ ${pagesPerSecond} pages/second)`);
        display.log(`== Sys. load: ${cpuUsage}% CPU / ${memoryUsage}% memory`);
        display.log(`== Workers:   ${this.workers.count()}`);
        const workers = this.workers.get();
        workers.forEach((worker, i) => {
            let workOrIdle;
            let workerUrl = '';
            let jobCount = '';
            if (worker.isIdle()) {
                workOrIdle = 'IDLE';
            }
            else {
                workOrIdle = 'WORK';
                const jobs = worker.activeJobs;
                jobCount = jobs.length > 1 ? `${jobs.length} JOBS: ` : '';
                workerUrl = jobs.length ?
                    worker.activeJobs.map(j => j.getUrl() || 'UNKNOWN TARGET').join(', ')
                    : 'NO TARGET (should not be happening)';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2x1c3Rlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9DbHVzdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQ0EsK0JBQTZFO0FBQzdFLHVDQUFnQztBQUNoQywrQkFBK0I7QUFHL0IsdUVBQXVFO0FBR3ZFLG1DQUE0QjtBQUM1QixtREFBNEM7QUFDNUMsbUNBQXNDO0FBR3RDLHVDQUFnQztBQUVoQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBdUI3QyxNQUFNLGVBQWUsR0FBbUI7SUFDcEMsV0FBVyxFQUFFLENBQUM7SUFDZCxjQUFjLEVBQUUsQ0FBQztJQUNqQixtQkFBbUIsRUFBRSxDQUFDO0lBQ3RCLGdCQUFnQixFQUFFO0lBQ2QsMENBQTBDO0tBQzdDO0lBQ0QsaUJBQWlCLEVBQUUsU0FBUztJQUM1QixPQUFPLEVBQUUsS0FBSztJQUNkLE9BQU8sRUFBRSxFQUFFLEdBQUcsSUFBSTtJQUNsQixVQUFVLEVBQUUsQ0FBQztJQUNiLFVBQVUsRUFBRSxDQUFDO0lBQ2IsaUJBQWlCLEVBQUUsS0FBSztJQUN4QixlQUFlLEVBQUUsQ0FBQztJQUNsQixTQUFTLEVBQUUsU0FBUztDQUN2QixDQUFDO0FBY0YsTUFBTSwyQkFBMkIsR0FBRyxHQUFHLENBQUM7QUFDeEMsTUFBTSx1QkFBdUIsR0FBRyxHQUFHLENBQUM7QUFDcEMsTUFBTSx3QkFBd0IsR0FBRyxFQUFFLENBQUM7QUFFcEMsTUFBcUIsT0FBeUMsU0FBUSxxQkFBWTtJQXlDOUUsWUFBb0IsT0FBd0M7UUFDeEQsS0FBSyxFQUFFLENBQUM7UUFuQ0osc0JBQWlCLEdBQTJCLElBQUksQ0FBQztRQUNqRCxZQUFPLEdBQWlDLElBQTJDLENBQUM7UUFFcEYsbUJBQWMsR0FBRyxDQUFDLENBQUM7UUFDbkIsYUFBUSxHQUFvQyxJQUFJLGVBQUssRUFBNEIsQ0FBQztRQUNsRixlQUFVLEdBQUcsQ0FBQyxDQUFD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