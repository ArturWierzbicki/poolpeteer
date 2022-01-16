/// <reference types="node" />
import { Page, PuppeteerNodeLaunchOptions } from "puppeteer";
import { EventEmitter } from "events";
import { ConcurrencyImplementationClassType } from "./concurrency/ConcurrencyImplementation";
interface ClusterOptions<JobData = unknown> {
    concurrency: number | ConcurrencyImplementationClassType<JobData>;
    workerShutdownTimer?: number;
    maxConcurrency: number;
    workerCreationDelay: number;
    puppeteerOptions: PuppeteerNodeLaunchOptions;
    monitor: boolean;
    timeout: number;
    retryLimit: number;
    retryDelay: number;
    skipDuplicateUrls: boolean;
    sameDomainDelay: number;
    puppeteer: any;
}
declare type Partial<T> = {
    [P in keyof T]?: T[P];
};
declare type ClusterOptionsArgument<JobData> = Partial<ClusterOptions<JobData>>;
interface TaskFunctionArguments<JobData> {
    page: Page;
    data: JobData;
    worker: {
        id: number;
    };
}
export declare type TaskFunction<JobData, ReturnData> = (
    arg: TaskFunctionArguments<JobData>
) => Promise<ReturnData>;
export default class Cluster<
    JobData = any,
    ReturnData = any
> extends EventEmitter {
    static CONCURRENCY_PAGE: number;
    static CONCURRENCY_CONTEXT: number;
    static CONCURRENCY_BROWSER: number;
    static CONCURRENCY_BROWSER_PER_REQUEST_GROUP: number;
    private options;
    private workers;
    private allTargetCount;
    private jobQueue;
    private errorCount;
    private taskFunction;
    private idleResolvers;
    private waitForOneResolvers;
    private browser;
    private isClosed;
    private startTime;
    private monitoringInterval;
    private display;
    private duplicateCheckUrls;
    private lastDomainAccesses;
    private systemMonitor;
    private checkForWorkInterval;
    static launch<JobData, ReturnData = unknown>(
        options: ClusterOptionsArgument<JobData>
    ): Promise<Cluster<JobData, ReturnData>>;
    private constructor();
    private init;
    task(taskFunction: TaskFunction<JobData, ReturnData>): Promise<void>;
    private nextWorkCall;
    private workCallTimeout;
    private work;
    private scheduleNextWork;
    private doWork;
    private isTaskFunction;
    private queueJob;
    queue(
        data: JobData,
        taskFunction?: TaskFunction<JobData, ReturnData>
    ): Promise<void>;
    queue(taskFunction: TaskFunction<JobData, ReturnData>): Promise<void>;
    execute(
        data: JobData,
        taskFunction?: TaskFunction<JobData, ReturnData>
    ): Promise<ReturnData>;
    execute(
        taskFunction: TaskFunction<JobData, ReturnData>
    ): Promise<ReturnData>;
    idle(): Promise<void>;
    waitForOne(): Promise<JobData>;
    close(): Promise<void>;
    private monitor;
}
export {};
