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
const Worker_1 = require("./Worker");
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
                const workerBrowserInstance = yield this.deps.browser
                    .workerInstance(this.deps.browserOptions, (workerId) => {
                    this.removeWorker(workerId);
                }, job.data);
                if (!(this.getWorkerById(workerBrowserInstance.id))) {
                    const worker = new Worker_1.default({
                        cluster: this.deps.cluster,
                        args: [''],
                        browser: workerBrowserInstance,
                        id: workerBrowserInstance.id,
                    });
                    if (this.isClosed) {
                        // cluster was closed while we created a new worker (should rarely happen)
                        worker.close();
                    }
                    else {
                        this.workers.push(worker);
                    }
                }
            }
            catch (err) {
                throw new Error(`Unable to launch browser for worker, error message: ${err.message}`);
            }
            finally {
                this.workersStarting -= 1;
            }
        });
    }
    allowedToStartWorker() {
        const workerCount = this.workers.length + this.workersStarting;
        return (
        // option: maxConcurrency
        (this.deps.maxConcurrency === 0
            || workerCount < this.deps.maxConcurrency)
            // just allow worker creaton every few milliseconds
            && (this.deps.workerCreationDelay === 0
                || this.lastLaunchedWorkerTime + this.deps.workerCreationDelay < Date.now()));
    }
    isAnyJobActive() {
        return false;
    }
    getWorkerById(id) {
        return this.workers.find(w => w.id === id);
    }
    removeWorker(workerId) {
        const worker = this.getWorkerById(workerId);
        if (worker) {
            this.workers.splice(this.workers.indexOf(worker), 1);
        }
    }
    canLaunchWorker(job) {
        return __awaiter(this, void 0, void 0, function* () {
            return !this.deps.browser.getExistingWorkerInstanceFor(job === null || job === void 0 ? void 0 : job.data)
                && this.allowedToStartWorker();
        });
    }
    getWorker(job) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingInstance = this.deps.browser.getExistingWorkerInstanceFor(job.data);
            if (!existingInstance) {
                return undefined;
            }
            return this.getWorkerById(existingInstance.id);
        });
    }
    canHandle(job) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const worker = yield this.getWorker(job);
            return (_a = worker === null || worker === void 0 ? void 0 : worker.canHandle) === null || _a === void 0 ? void 0 : _a.call(worker, job);
        });
    }
    hasFreeCapacity(job) {
        return (job && this.canHandle(job)) || (this.canLaunchWorker(job));
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            this.isClosed = true;
            yield Promise.all(this.workers.map(w => w.close()));
        });
    }
    busyWorkersCount() {
        return this.workers.filter(w => !w.isIdle()).length;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV29ya2Vycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9Xb3JrZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQ0EscUNBQThCO0FBZTlCLE1BQXFCLE9BQU87SUFReEIsWUFBb0IsSUFBc0M7UUFBdEMsU0FBSSxHQUFKLElBQUksQ0FBa0M7UUFObEQsWUFBTyxHQUFrQyxFQUFFLENBQUM7UUFDNUMsb0JBQWUsR0FBRyxDQUFDLENBQUM7UUFDcEIsMkJBQXNCLEdBQVcsQ0FBQyxDQUFDO1FBRW5DLGFBQVEsR0FBRyxLQUFLLENBQUM7SUFFb0MsQ0FBQztJQUVqRCxZQUFZLENBQUMsR0FBNkI7O1lBQ25ELHdDQUF3QztZQUN4QyxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUMsQ0FBQztZQUMxQixJQUFJLENBQUMsc0JBQXNCLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBRXpDLElBQUk7Z0JBQ0EsTUFBTSxxQkFBcUIsR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTztxQkFDaEQsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUN4QixDQUFDLFFBQWdCLEVBQUUsRUFBRTtvQkFDakIsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDaEMsQ0FBQyxFQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFFOUIsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO29CQUNqRCxNQUFNLE1BQU0sR0FBRyxJQUFJLGdCQUFNLENBQXNCO3dCQUMzQyxPQUFPLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPO3dCQUMxQixJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUM7d0JBQ1YsT0FBTyxFQUFFLHFCQUFxQjt3QkFDOUIsRUFBRSxFQUFFLHFCQUFxQixDQUFDLEVBQUU7cUJBQy9C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