import ConcurrencyImplementation, {
    WorkerInstance,
    JobInstance,
} from "../ConcurrencyImplementation";
import * as puppeteer from "puppeteer";
import { LaunchOptions, PuppeteerNode } from "puppeteer";

type BrowserPerRequestGroupConcurrencyDeps = {
    workerShutdownTimer: number;
    log: Logger;
};

type Logger = {
    debug: (message?: string, ...optionalParams: any[]) => void;
};

export class BrowserPerRequestGroup<
    JobData
> extends ConcurrencyImplementation<JobData> {
    private workersByGroupId: Record<string, Worker<JobData>> = {};
    private workersInitByGroupId: Record<string, Promise<Worker<JobData>>> = {};
    private deletionTimeoutByWorkerId: Record<number, NodeJS.Timeout> = {};
    private nextWorkerId = 0;

    constructor(
        options: puppeteer.LaunchOptions,
        puppeteer: PuppeteerNode,
        private deps: BrowserPerRequestGroupConcurrencyDeps
    ) {
        super(options, puppeteer);
    }

    private async repair() {}

    async init() {}

    async close() {
        this.deps.log.debug(
            "Closing BrowserPerRequestGroupConcurrency manager"
        );

        await Promise.all(
            Object.values(this.workersByGroupId).map((w) => w.close())
        );
    }

    private getGroupId = (jobData: unknown): string => {
        const maybeDataWithGroupId = jobData as { groupId: string };

        if (typeof maybeDataWithGroupId?.groupId === "string") {
            return maybeDataWithGroupId.groupId;
        }

        return `${Math.random() * 1000}`;
    };

    private createWorker = async (
        options: LaunchOptions,
        onShutdown: (workerId: number) => void,
        jobData: JobData,
        groupId: string
    ) => {
        const workerId = this.nextWorkerId;

        this.nextWorkerId = this.nextWorkerId + 1;
        this.deps.log.debug(
            `Creating new worker`,
            "groupId",
            groupId,
            "workerId",
            workerId
        );

        const browser = await this.puppeteer.launch(options);

        return new Worker({
            log: this.deps.log,
            id: workerId,
            groupId,
            browser,
            puppeteer: this.puppeteer,
            launchOptions: options,
            onShutdown: () => onShutdown(workerId),
        });
    };

    private setupDeletionTimer = (workerId: number, groupId: string) => {
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

    async workerInstance(
        perBrowserOptions: puppeteer.LaunchOptions | undefined,
        onShutdown: (workerId: number) => void,
        jobData: JobData
    ) {
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
    }

    getExistingWorkerInstanceFor(
        jobData?: JobData
    ): WorkerInstance<JobData> | undefined {
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
            worker?.id
        );

        return worker;
    }
}

type WorkerDeps = {
    groupId: string;
    id: number;
    log: Logger;
    launchOptions: LaunchOptions;
    puppeteer: PuppeteerNode;
    browser: puppeteer.Browser;
    onShutdown: () => void;
};

class Worker<JobData> implements WorkerInstance<JobData> {
    private currentBrowser: puppeteer.Browser;
    private repairing = false;
    private isClosed = false;
    private openInstances = 0;
    private waitingForRepairResolvers: Array<(val?: unknown) => void> = [];
    private browserHealthCheckInterval: NodeJS.Timeout;

    constructor(private deps: WorkerDeps) {
        this.currentBrowser = deps.browser;
        this.browserHealthCheckInterval = setInterval(() => {
            if (!this.currentBrowser.isConnected()) {
                this.close();
            }
        }, 20000);
    }

    async repair() {
        if (this.openInstances !== 0 || this.repairing) {
            // already repairing or there are still pages open? wait for start/finish
            await new Promise((resolve) =>
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
            await this.currentBrowser.close();
        } catch (err: any) {
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
            this.currentBrowser = await this.deps.puppeteer.launch(
                this.deps.launchOptions
            );
            this.deps.log.debug(
                "Worker finished repair",
                "groupId",
                this.deps.groupId,
                "workerId",
                this.deps.id
            );
        } catch (err: any) {
            throw new Error("Unable to restart chrome." + err.stack);
        }
        this.repairing = false;
        this.openInstances = 0;
        this.waitingForRepairResolvers.forEach((resolve) => resolve());
        this.waitingForRepairResolvers = [];
    }

    get id() {
        return this.deps.id;
    }

    async jobInstance(data: JobData | undefined): Promise<JobInstance> {
        if (this.repairing) {
            this.deps.log.debug(
                "Waiting for repair to finish before returning new job instance",
                "groupId",
                this.deps.groupId,
                "workerId",
                this.deps.id
            );
            await this.repair();
        }

        const page = await this.currentBrowser.newPage();
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
            close: async () => {
                this.openInstances -= 1;
                await page.close();
            },
        };
    }

    async canHandle(data: JobData | undefined) {
        // we can limit the number of open pages with this function
        return true;
    }

    async close(): Promise<void> {
        this.isClosed = true;

        clearInterval(this.browserHealthCheckInterval);
        await this.deps.onShutdown();

        if (this.repairing) {
            await this.repair();
        }
        this.deps.log.debug(
            `Closing worker`,
            "groupId",
            this.deps.groupId,
            "workerId",
            this.deps.id
        );
        await this.currentBrowser.close();
    }
}
