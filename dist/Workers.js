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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV29ya2Vycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9Xb3JrZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQ0EscUNBQThCO0FBZTlCLE1BQXFCLE9BQU87SUFReEIsWUFBb0IsSUFBc0M7UUFBdEMsU0FBSSxHQUFKLElBQUksQ0FBa0M7UUFObEQsWUFBTyxHQUFrQyxFQUFFLENBQUM7UUFDNUMsb0JBQWUsR0FBRyxDQUFDLENBQUM7UUFDcEIsMkJBQXNCLEdBQVcsQ0FBQyxDQUFDO1FBRW5DLGFBQVEsR0FBRyxLQUFLLENBQUM7SUFFb0MsQ0FBQztJQUVqRCxZQUFZLENBQUMsR0FBNkI7O1lBQ25ELHdDQUF3QztZQUN4QyxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUMsQ0FBQztZQUMxQixJQUFJLENBQUMsc0JBQXNCLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBRXpDLElBQUk7Z0JBQ0EsTUFBTSxxQkFBcUIsR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTztxQkFDaEQsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUN4QixDQUFDLFFBQWdCLEVBQUUsRUFBRTtvQkFDakIsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDaEMsQ0FBQyxFQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFFOUIsTUFBTSxNQUFNLEdBQUcsSUFBSSxnQkFBTSxDQUFzQjtvQkFDM0MsT0FBTyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTztvQkFDMUIsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO29CQUNWLE9BQU8sRUFBRSxxQkFBcUI7b0JBQzlCLEVBQUUsRUFBRSxxQkFBcUIsQ0FBQyxFQUFFO2lCQUMvQixDQUFDLENBQUM7Z0JBRUgsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFO29CQUNmLDBFQUEwRTtvQkFDMUUsTUFBTSxDQUFDLEtB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