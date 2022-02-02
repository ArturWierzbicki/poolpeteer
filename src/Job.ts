import { URL } from "url";
import { TaskFunction } from "./Cluster";

export type ExecuteResolve = (value?: any) => void;
export type ExecuteReject = (reason?: any) => void;
export interface ExecuteCallbacks {
    resolve: (value?: any) => void;
    reject: ExecuteReject;
}

export default class Job<JobData, ReturnData> {
    public data?: JobData;
    public taskFunction: TaskFunction<JobData, ReturnData> | undefined;
    public executeCallbacks: ExecuteCallbacks | undefined;

    private lastError: Error | null = null;
    public tries: number = 0;

    public constructor(
        data?: JobData,
        taskFunction?: TaskFunction<JobData, ReturnData>,
        executeCallbacks?: ExecuteCallbacks
    ) {
        this.data = data;
        this.taskFunction = taskFunction;
        this.executeCallbacks = executeCallbacks;
    }

    public getUrl(): string | undefined {
        const data = this.data as any;

        if (!data) {
            return undefined;
        }
        if (typeof data === "string") {
            return data;
        }
        if (typeof data.url === "string") {
            return data.url;
        }

        const options = data.options;
        if (
            options &&
            typeof options === "object" &&
            typeof options.url === "string"
        ) {
            return options.url;
        }

        return undefined;
    }

    public getDomain(): string | undefined {
        // TODO use tld.js to restrict to top-level domain?
        const urlStr = this.getUrl();
        if (urlStr) {
            try {
                const url = new URL(urlStr);
                return url.hostname || undefined;
            } catch (e) {
                // if urlStr is not a valid URL this might throw
                // but we leave this to the user
                return undefined;
            }
        }
        return undefined;
    }

    public addError(error: Error): void {
        this.tries += 1;
        this.lastError = error;
    }
}
