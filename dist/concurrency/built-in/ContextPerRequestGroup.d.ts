import ConcurrencyImplementation, {
    WorkerInstance,
    JobInstance,
} from "../ConcurrencyImplementation";
import * as puppeteer from "puppeteer";
import { PuppeteerNode } from "puppeteer";
import { Primitive } from "./groupId";
declare type ContextPerRequestGroupDeps = {
    workerShutdownTimeout: number;
    log: Logger;
};
declare type Logger = {
    debug: (message?: string, ...optionalParams: any[]) => void;
};
export declare class ContextPerRequestGroup<
    JobData
> extends ConcurrencyImplementation<JobData> {
    private deps;
    private browser;
    private workersByGroupId;
    private workersInitByGroupId;
    private nextWorkerId;
    private browserHealthCheckInterval;
    private repairing;
    private repairRequested;
    private waitingForRepairResolvers;
    constructor(
        options: puppeteer.LaunchOptions,
        puppeteer: PuppeteerNode,
        deps: ContextPerRequestGroupDeps
    );
    private repair;
    init(): Promise<void>;
    private closeAllWorkers;
    close(): Promise<void>;
    private getBrowser;
    private createContext;
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
    groupId: Primitive;
    id: number;
    log: Logger;
    context: puppeteer.BrowserContext;
    shutdownTimeout: number;
    onShutdown: () => void;
    onRepairRequested: () => void;
};
declare class Worker<JobData> implements WorkerInstance<JobData> {
    private deps;
    private currentContext;
    private repairRequested;
    private repairing;
    private waitingForRepairResolvers;
    private shutdownTimeout;
    activeJobs: number;
    isClosed: boolean;
    constructor(deps: WorkerDeps);
    onRepairFinished: (context: puppeteer.BrowserContext) => void;
    private closeCurrentContext;
    refreshShutdownTimeout: () => void;
    repair(): Promise<void>;
    get id(): number;
    jobInstance(data: JobData | undefined): Promise<JobInstance>;
    canHandle(data: JobData | undefined): Promise<boolean>;
    close(): Promise<void>;
}
export {};
