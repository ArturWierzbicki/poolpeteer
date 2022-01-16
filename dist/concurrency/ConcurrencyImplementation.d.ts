import * as puppeteer from "puppeteer";
import { PuppeteerNode, PuppeteerNodeLaunchOptions } from "puppeteer";
/**
 * ABSTRACT CLASS Needs to be implemented to manage one or more browsers via puppeteer instances
 *
 * The ConcurrencyImplementation creates WorkerInstances. Workers create JobInstances:
 * One WorkerInstance per maxWorkers, one JobInstance per job
 */
export default abstract class ConcurrencyImplementation<JobData = unknown> {
    protected options: PuppeteerNodeLaunchOptions;
    protected puppeteer: PuppeteerNode;
    /**
     * @param options  Options that should be provided to puppeteer.launch
     * @param puppeteer  puppeteer object (like puppeteer or puppeteer-core)
     */
    constructor(options: PuppeteerNodeLaunchOptions, puppeteer: PuppeteerNode);
    /**
     * Initializes the manager
     */
    abstract init(): Promise<void>;
    /**
     * Closes the manager (called when cluster is about to shut down)
     */
    abstract close(): Promise<void>;
    /**
     * Creates a worker and returns it
     */
    abstract workerInstance(
        perBrowserOptions: puppeteer.LaunchOptions | undefined,
        onShutdown: (workerId: number) => void,
        jobData?: JobData
    ): Promise<WorkerInstance<JobData>>;
    getExistingWorkerInstanceFor(
        jobData?: JobData
    ): WorkerInstance<JobData> | undefined;
}
/**
 * WorkerInstances are created by calling the workerInstance function.
 * In case maxWorkers is set to 4, 4 workers will be created.
 */
export interface WorkerInstance<JobData = unknown> {
    jobInstance: (data?: JobData) => Promise<JobInstance>;
    /**
     * Closes the worker (called when the cluster is about to shut down)
     */
    close: () => Promise<void>;
    /**
     * Repair is called when there is a problem with the worker (like call or close throwing
     * an error)
     */
    repair: () => Promise<void>;
    canHandle?: (data?: JobData) => Promise<boolean>;
    id: number;
}
/**
 * JobInstance which is created for the execution of one job. After usage
 * the associated resources will be destroyed by calling close.
 * resources needs to contain the page and might contain any other
 * related resources (like the browser).
 */
export interface JobInstance {
    resources: ResourceData;
    /**
     * Called to close the related resources
     */
    close: () => Promise<void>;
}
export interface ResourceData {
    page: puppeteer.Page;
    [key: string]: any;
}
export declare type ConcurrencyImplementationClassType<JobData = unknown> =
    new (
        options: PuppeteerNodeLaunchOptions,
        puppeteer: any
    ) => ConcurrencyImplementation<JobData>;
