import * as puppeteer from "puppeteer";
import { PuppeteerNode, PuppeteerNodeLaunchOptions } from "puppeteer";
import ConcurrencyImplementation, {
    ResourceData,
} from "./ConcurrencyImplementation";

import { debugGenerator, timeoutExecute } from "../util";

const debug = debugGenerator("SingleBrowserImpl");

const BROWSER_TIMEOUT = 5000;

export default abstract class SingleBrowserImplementation extends ConcurrencyImplementation {
    protected browser: puppeteer.Browser | null = null;

    private nextWorkerId = 0;
    private repairing: boolean = false;
    private repairRequested: boolean = false;
    private openInstances: number = 0;
    private waitingForRepairResolvers: ((value: unknown) => void)[] = [];

    public constructor(
        options: PuppeteerNodeLaunchOptions,
        puppeteer: PuppeteerNode
    ) {
        super(options, puppeteer);
    }

    protected getBrowser(): puppeteer.Browser {
        if (!this.browser) {
            throw new Error(
                "SingleBrowserImplementation has not been initialized!"
            );
        }

        return this.browser;
    }

    private async repair() {
        if (this.openInstances !== 0 || this.repairing) {
            // already repairing or there are still pages open? wait for start/finish
            await new Promise((resolve) =>
                this.waitingForRepairResolvers.push(resolve)
            );
            return;
        }

        this.repairing = true;
        debug("Starting repair");

        try {
            // will probably fail, but just in case the repair was not necessary
            await timeoutExecute(
                BROWSER_TIMEOUT,
                (<puppeteer.Browser>this.browser).close()
            );
        } catch (e) {
            debug("Unable to close browser.");
        }

        try {
            this.browser = await this.puppeteer.launch(this.options);
        } catch (err) {
            throw new Error("Unable to restart chrome.");
        }
        this.repairRequested = false;
        this.repairing = false;
        this.waitingForRepairResolvers.forEach((resolve) => resolve(undefined));
        this.waitingForRepairResolvers = [];
    }

    public async init() {
        this.browser = await this.puppeteer.launch(this.options);
    }

    public async close() {
        await this.getBrowser().close();
    }

    protected abstract createResources(): Promise<ResourceData>;

    protected abstract freeResources(resources: ResourceData): Promise<void>;

    public async workerInstance() {
        let resources: ResourceData;

        const workerId = this.nextWorkerId;

        this.nextWorkerId = this.nextWorkerId + 1;

        return {
            id: workerId,
            jobInstance: async () => {
                if (this.repairRequested) {
                    await this.repair();
                }

                await timeoutExecute(
                    BROWSER_TIMEOUT,
                    (async () => {
                        resources = await this.createResources();
                    })()
                );
                this.openInstances += 1;

                return {
                    resources,

                    close: async () => {
                        this.openInstances -= 1; // decrement first in case of error
                        await timeoutExecute(
                            BROWSER_TIMEOUT,
                            this.freeResources(resources)
                        );

                        if (this.repairRequested) {
                            await this.repair();
                        }
                    },
                };
            },

            close: async () => {},

            repair: async () => {
                debug("Repair requested");
                this.repairRequested = true;
                await this.repair();
            },
        };
    }
}
