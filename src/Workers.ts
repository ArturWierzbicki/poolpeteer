import Job from './Job';
import Worker from './Worker';

import ConcurrencyImplementation
    from './concurrency/ConcurrencyImplementation';
import { LaunchOptions } from 'puppeteer';
import Cluster from './Cluster';

type WorkersDeps<JobData, ReturnData> = {
    browserOptions: LaunchOptions;
    browser: ConcurrencyImplementation<JobData>
    cluster: Cluster
    maxConcurrency: number
    workerCreationDelay: number
};

export default class Workers<JobData = any, ReturnData = any> {

    private workers: Worker<JobData, ReturnData>[] = [];
    private workersStarting = 0;
    private lastLaunchedWorkerTime: number = 0;

    private isClosed = false;

    constructor(private deps: WorkersDeps<JobData, ReturnData>) {}

    public async launchWorker(job: Job<JobData, ReturnData>) {
        // signal, that we are starting a worker
        this.workersStarting += 1;
        this.lastLaunchedWorkerTime = Date.now();

        try {
            const workerBrowserInstance = await this.deps.browser
                .workerInstance(this.deps.browserOptions,
                                (workerId: number) => {
                                    this.removeWorker(workerId);
                                },
                                job.data);

            if (!(this.getWorkerById(workerBrowserInstance.id))) {
                const worker = new Worker<JobData, ReturnData>({
                    cluster: this.deps.cluster,
                    args: [''], // this.options.args,
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
            throw new Error(`Unable to launch browser for worker, error message: ${err.message}`);
        } finally {
            this.workersStarting -= 1;
        }
    }

    private allowedToStartWorker(): boolean {
        const workerCount = this.workers.length + this.workersStarting;
        return (
            // option: maxConcurrency
            (this.deps.maxConcurrency === 0
                || workerCount < this.deps.maxConcurrency)
            // just allow worker creaton every few milliseconds
            && (this.deps.workerCreationDelay === 0
                || this.lastLaunchedWorkerTime + this.deps.workerCreationDelay < Date.now())
        );
    }

    isAnyJobActive() {
        return false;
    }

    private getWorkerById(id: number): Worker<JobData, ReturnData>  | undefined {
        return this.workers.find(w => w.id === id);
    }

    private removeWorker(workerId: number) {
        const worker = this.getWorkerById(workerId);
        if (worker) {
            this.workers.splice(this.workers.indexOf(worker), 1);
        }
    }

    async canLaunchWorker(job?: Job<JobData, ReturnData>) {
        return !this.deps.browser.getExistingWorkerInstanceFor(job?.data)
            && this.allowedToStartWorker();
    }

    async getWorker(job: Job<JobData, ReturnData>):
        Promise<Worker<JobData, ReturnData> | undefined> {
        const existingInstance = this.deps.browser.getExistingWorkerInstanceFor(job.data);
        if (!existingInstance) {
            return undefined;
        }

        return this.getWorkerById(existingInstance.id);
    }

    async canHandle(job: Job<JobData, ReturnData>) {
        const worker = await this.getWorker(job);
        return worker?.canHandle?.(job);
    }

    hasFreeCapacity(job?: Job<JobData, ReturnData>) {
        return (job && this.canHandle(job)) || (this.canLaunchWorker(job));
    }

    async close() {
        this.isClosed = true;
        await Promise.all(this.workers.map(w => w.close()));
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
