import Job from './Job';
import Cluster, { TaskFunction } from './Cluster';
import { WorkerInstance } from './concurrency/ConcurrencyImplementation';
interface WorkerOptions<JobData> {
    cluster: Cluster;
    args: string[];
    id: number;
    browser: WorkerInstance<JobData>;
}
export interface WorkError {
    type: 'error';
    error: Error;
}
export interface WorkData {
    type: 'success';
    data: any;
}
export declare type WorkResult = WorkError | WorkData;
export default class Worker<JobData, ReturnData> implements WorkerOptions<JobData> {
    cluster: Cluster;
    args: string[];
    id: number;
    browser: WorkerInstance<JobData>;
    activeJobs: Job<JobData, ReturnData>[];
    constructor({ cluster, args, id, browser }: WorkerOptions<JobData>);
    canHandle(job: Job<JobData, ReturnData>): Promise<boolean>;
    handle(task: TaskFunction<JobData, ReturnData>, job: Job<JobData, ReturnData>, timeout: number): Promise<WorkResult>;
    close(): Promise<void>;
    isIdle(): boolean;
}
export {};
