import Job from './Job';
import Worker from './Worker';
import ConcurrencyImplementation from './concurrency/ConcurrencyImplementation';
import { LaunchOptions } from 'puppeteer';
import Cluster from './Cluster';
declare type WorkersDeps<JobData, ReturnData> = {
    browserOptions: LaunchOptions;
    browser: ConcurrencyImplementation<JobData>;
    cluster: Cluster;
    maxConcurrency: number;
    workerCreationDelay: number;
};
export default class Workers<JobData = any, ReturnData = any> {
    private deps;
    private workers;
    private workersStarting;
    private lastLaunchedWorkerTime;
    private isClosed;
    constructor(deps: WorkersDeps<JobData, ReturnData>);
    launchWorker(job: Job<JobData, ReturnData>): Promise<void>;
    private allowedToStartWorker;
    isAnyJobActive(): boolean;
    private getWorkerById;
    private removeWorker;
    canLaunchWorker(job?: Job<JobData, ReturnData>): Promise<boolean>;
    getWorker(job: Job<JobData, ReturnData>): Promise<Worker<JobData, ReturnData> | undefined>;
    canHandle(job: Job<JobData, ReturnData>): Promise<boolean | undefined>;
    hasFreeCapacity(job?: Job<JobData, ReturnData>): Promise<boolean | undefined>;
    close(): Promise<void>;
    busyWorkersCount(): number;
    count(): number;
    get(): Worker<JobData, ReturnData>[];
    getStartingCount(): number;
}
export {};
