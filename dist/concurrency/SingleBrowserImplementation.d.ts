import * as puppeteer from "puppeteer";
import { PuppeteerNode, PuppeteerNodeLaunchOptions } from "puppeteer";
import ConcurrencyImplementation, {
    ResourceData,
} from "./ConcurrencyImplementation";
export default abstract class SingleBrowserImplementation extends ConcurrencyImplementation {
    protected browser: puppeteer.Browser | null;
    private nextWorkerId;
    private repairing;
    private repairRequested;
    private openInstances;
    private waitingForRepairResolvers;
    constructor(options: PuppeteerNodeLaunchOptions, puppeteer: PuppeteerNode);
    protected getBrowser(): puppeteer.Browser;
    private repair;
    init(): Promise<void>;
    close(): Promise<void>;
    protected abstract createResources(): Promise<ResourceData>;
    protected abstract freeResources(resources: ResourceData): Promise<void>;
    workerInstance(): Promise<{
        id: number;
        jobInstance: () => Promise<{
            resources: ResourceData;
            close: () => Promise<void>;
        }>;
        close: () => Promise<void>;
        repair: () => Promise<void>;
    }>;
}
