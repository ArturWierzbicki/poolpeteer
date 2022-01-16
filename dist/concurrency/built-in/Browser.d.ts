import { PuppeteerNodeLaunchOptions } from "puppeteer";
import ConcurrencyImplementation, {
    WorkerInstance,
} from "../ConcurrencyImplementation";
export default class Browser extends ConcurrencyImplementation {
    init(): Promise<void>;
    close(): Promise<void>;
    private nextWorkerId;
    workerInstance(
        perBrowserOptions: PuppeteerNodeLaunchOptions | undefined
    ): Promise<WorkerInstance>;
}
