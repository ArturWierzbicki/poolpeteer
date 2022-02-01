import ConcurrencyImplementation, {
    WorkerInstance,
    JobInstance,
} from "../ConcurrencyImplementation";
import * as puppeteer from "puppeteer";
import { LaunchOptions, PuppeteerNode } from "puppeteer";
import { timeoutExecute } from "../../util";
import { getGroupId, Primitive } from "./groupId";

type ContextPerRequestGroupDeps = {
    workerShutdownTimeout: number;
    log: Logger;
};

type Logger = {
    debug: (message?: string, ...optionalParams: any[]) => void;
};

export class ContextPerRequestGroup<
    JobData
> extends ConcurrencyImplementation<JobData> {
    private browser: puppeteer.Browser | undefined;
    private workersByGroupId: Map<Primitive, Worker<JobData>> = new Map();
    private workersInitByGroupId: Map<Primitive, Promise<Worker<JobData>>> =
        new Map();
    private nextWorkerId = 0;
    private browserHealthCheckInterval: NodeJS.Timeout | undefined;
    private repairing = false;
    private repairRequested = false;
    private waitingForRepairResolvers: ((value: unknown) => void)[] = [];

    constructor(
        options: puppeteer.LaunchOptions,
        puppeteer: PuppeteerNode,
        private deps: ContextPerRequestGroupDeps
    ) {
        super(options, puppeteer);
    }

    private async repair() {
        if (
            this.repairing ||
            Object.values(this.workersByGroupId).some((w) => w.activeJobs > 0)
        ) {
            // already repairing or there are still pages open? wait for start/finish
            await new Promise((resolve) =>
                this.waitingForRepairResolvers.push(resolve)
            );
            return;
        }
        this.repairing = true;

        await this.closeAllWorkers();

        try {
            // will probably fail, but just in case the repair was not necessary
            await timeoutExecute(30000, this.getBrowser()?.close());
        } catch (e) {
            this.deps.log.debug("Unable to close browser.");
        }

        try {
            this.browser = await this.puppeteer.launch(this.options);
        } catch (err) {
            throw new Error("Unable to restart chrome.");
        }

        const workers = Object.values(this.workersByGroupId);
        for (const worker of workers) {
            const context = await this.createContext();
            worker.onRepairFinished(context);
        }

        this.waitingForRepairResolvers.forEach((resolve) => resolve(undefined));
        this.waitingForRepairResolvers = [];
        this.repairing = false;
        this.repairRequested = false;
    }

    async init() {
        this.browser = await this.puppeteer.launch(this.options);
        this.browserHealthCheckInterval = setInterval(() => {
            if (
                this.browser &&
                !this.repairing &&
                !this.browser.isConnected()
            ) {
                this.repair();
            }
        }, 20000);
    }

    private async closeAllWorkers() {
        await Promise.allSettled(Object.values(this.workersInitByGroupId));
        try {
            await Promise.all(
                Object.values(this.workersByGroupId).map((w) => w.close())
            );
        } catch (err: any) {
            this.deps.log.debug(
                "Failed to close some workers",
                "err",
                err.stack
            );
        }

        this.workersByGroupId.clear();
        this.workersInitByGroupId.clear();
    }

    async close() {
        if (this.repairing) {
            await this.repair();
        }
        this.deps.log.debug(
            "Closing ContextPerRequestGroupConcurrency manager"
        );

        if (this.browserHealthCheckInterval) {
            clearInterval(this.browserHealthCheckInterval);
        }
        await this.closeAllWorkers();
        await this.browser?.close();
    }

    private getBrowser(): puppeteer.Browser {
        if (!this.browser) {
            throw new Error("ContextPerRequestGroup has not been initialized");
        }

        return this.browser;
    }

    private async createContext(): Promise<puppeteer.BrowserContext> {
        const browser = this.getBrowser();
        return browser.createIncognitoBrowserContext();
    }

    private createWorker = async (
        options: LaunchOptions,
        onShutdown: (workerId: number) => void,
        jobData: JobData,
        groupId: Primitive
    ) => {
        if (this.repairRequested) {
            await this.repair();
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

        const context = await this.createContext();

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
    };

    async workerInstance(
        perBrowserOptions: puppeteer.LaunchOptions | undefined,
        onShutdown: (workerId: number) => void,
        jobData: JobData
    ) {
        if (this.repairRequested) {
            await this.repair();
        }

        const groupId = getGroupId(jobData);

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
    }

    getExistingWorkerInstanceFor(
        jobData?: JobData
    ): WorkerInstance<JobData> | undefined {
        if (this.repairRequested) {
            return undefined;
        }

        const groupId = getGroupId(jobData);
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
            worker?.id
        );

        return worker;
    }
}

type WorkerDeps = {
    groupId: Primitive;
    id: number;
    log: Logger;
    context: puppeteer.BrowserContext;
    shutdownTimeout: number;
    onShutdown: () => void;
    onRepairRequested: () => void;
};

class Worker<JobData> implements WorkerInstance<JobData> {
    private currentContext: puppeteer.BrowserContext;
    private repairRequested = false;
    private repairing = false;
    private waitingForRepairResolvers: Array<(val?: unknown) => void> = [];
    private shutdownTimeout: NodeJS.Timeout | undefined;

    activeJobs = 0;
    isClosed = false;

    constructor(private deps: WorkerDeps) {
        this.currentContext = deps.context;
        this.refreshShutdownTimeout();
    }

    onRepairFinished = (context: puppeteer.BrowserContext) => {
        this.repairing = false;
        this.repairRequested = false;
        this.closeCurrentContext();

        this.waitingForRepairResolvers.forEach((resolve) => resolve());
        this.waitingForRepairResolvers = [];
        this.currentContext = context;
        this.refreshShutdownTimeout();
    };

    private closeCurrentContext = async (): Promise<void> => {
        if (!this.currentContext) {
            return;
        }

        try {
            await this.currentContext.close();
        } catch (err: any) {
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
    };

    refreshShutdownTimeout = () => {
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

    async repair() {
        this.repairRequested = true;
        if (this.activeJobs !== 0) {
            // already repairing or there are still pages open? wait for start/finish
            await new Promise((resolve) =>
                this.waitingForRepairResolvers.push(resolve)
            );
            return;
        }
        this.repairing = true;

        if (this.shutdownTimeout) {
            clearTimeout(this.shutdownTimeout);
        }
        this.deps.onRepairRequested();
    }

    get id() {
        return this.deps.id;
    }

    async jobInstance(data: JobData | undefined): Promise<JobInstance> {
        if (this.repairRequested) {
            this.deps.log.debug(
                "Waiting for repair to finish before returning new job instance",
                "groupId",
                this.deps.groupId,
                "workerId",
                this.deps.id
            );
            await this.repair();
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

        const page = await this.currentContext.newPage();

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
            close: async () => {
                this.activeJobs -= 1;
                this.refreshShutdownTimeout();

                try {
                    await page.close();
                } finally {
                    if (this.repairRequested) {
                        await this.repair();
                    }
                }
            },
        };
    }

    async canHandle(data: JobData | undefined) {
        if (this.isClosed || this.repairRequested) {
            return false;
        }
        // we can limit the number of open pages with this function
        return getGroupId(data) === this.deps.groupId;
    }

    async close(): Promise<void> {
        if (this.isClosed) {
            return;
        }

        this.isClosed = true;
        if (this.shutdownTimeout) {
            clearTimeout(this.shutdownTimeout);
        }
        await this.deps.onShutdown();

        if (this.repairRequested) {
            await this.repair();
        }
        this.deps.log.debug(
            `Closing worker`,
            "groupId",
            this.deps.groupId,
            "workerId",
            this.deps.id
        );

        try {
            await timeoutExecute(5000, this.currentContext.close());
        } catch (err: any) {
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
    }
}
