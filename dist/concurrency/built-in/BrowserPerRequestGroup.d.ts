import ConcurrencyImplementation, {
    WorkerInstance,
    JobInstance,
} from "../ConcurrencyImplementation";
import * as puppeteer from "puppeteer";
import { LaunchOptions, PuppeteerNode } from "puppeteer";
declare type BrowserPerRequestGroupConcurrencyDeps = {
    workerShutdownTimeout: number;
    log: Logger;
};
declare type Logger = {
    debug: (message?: string, ...optionalParams: any[]) => void;
};
export declare class BrowserPerRequestGroup<
    JobData
> extends ConcurrencyImplementation<JobData> {
    private deps;
    private workersByGroupId;
    private workersInitByGroupId;
    private nextWorkerId;
    constructor(
        options: puppeteer.LaunchOptions,
        puppeteer: PuppeteerNode,
        deps: BrowserPerRequestGroupConcurrencyDeps
    );
    private repair;
    init(): Promise<void>;
    close(): Promise<void>;
    private createWorker;
    workerInstance(
        perBrowserOptions: puppeteer.LaunchOptions | undefined,
        onShutdown: (workerId: number) => void,
        jobData: JobData
    ): Promise<Worker<JobData>>;
    getExistingWorkerInstanceFor(
        jobData?: JobData
    ): WorkerInstance<JobData> | undefined;
}
declare type WorkerDeps = {
    groupId: string;
    id: number;
    log: Logger;
    launchOptions: LaunchOptions;
    puppeteer: PuppeteerNode;
    shutdownTimeout: number;
    browser: puppeteer.Browser;
    onShutdown: () => void;
};
declare class Worker<JobData> implements WorkerInstance<JobData> {
    private deps;
    private currentBrowser;
    private repairing;
    private isClosed;
    private openInstances;
    private waitingForRepairResolvers;
    private browserHealthCheckInterval;
    private shutdownTimeout;
    constructor(deps: WorkerDeps);
    refreshShutdownTimeout: () => void;
    repair(): Promise<void>;
    get id(): number;
    jobInstance(data: JobData | undefined): Promise<JobInstance>;
    canHandle(data: JobData | undefined): Promise<boolean>;
    close(): Promise<void>;
}
export {};
