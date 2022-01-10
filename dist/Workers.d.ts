import Job from './Job';
import Worker from './Worker';
export default class Workers<JobData = any, ReturnData = any> {
    private deps;
    private workers;
    private workersStarting;
    private lastLaunchedWorkerTime;
    private isClosed;
    private constructor();
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
