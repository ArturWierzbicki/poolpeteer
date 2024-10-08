import * as puppeteer from "puppeteer";
import { PuppeteerNodeLaunchOptions } from "puppeteer";

import { debugGenerator, timeoutExecute } from "../../util";
import ConcurrencyImplementation, {
    WorkerInstance,
} from "../ConcurrencyImplementation";

const debug = debugGenerator("BrowserConcurrency");

const BROWSER_TIMEOUT = 5000;

export default class Browser extends ConcurrencyImplementation {
    public async init() {}
    public async close() {}

    private nextWorkerId = 0;

    public async workerInstance(
        perBrowserOptions: PuppeteerNodeLaunchOptions | undefined
    ): Promise<WorkerInstance> {
        const workerId = this.nextWorkerId;
        this.nextWorkerId = this.nextWorkerId + 1;

        const options = perBrowserOptions || this.options;
        let chrome = await this.puppeteer.launch(options);
        let page: puppeteer.Page;
        let context: puppeteer.BrowserContext;

        return {
            id: workerId,
            jobInstance: async () => {
                await timeoutExecute(
                    BROWSER_TIMEOUT,
                    (async () => {
                        context = await chrome.createBrowserContext();
                        page = await context.newPage();
                    })()
                );

                return {
                    resources: {
                        page,
                    },

                    close: async () => {
                        await timeoutExecute(BROWSER_TIMEOUT, context.close());
                    },
                };
            },

            close: async () => {
                await chrome.close();
            },

            repair: async () => {
                debug("Starting repair");
                try {
                    // will probably fail, but just in case the repair was not necessary
                    await timeoutExecute(BROWSER_TIMEOUT, chrome.close());
                } catch (e) {}

                // just relaunch as there is only one page per browser
                chrome = await this.puppeteer.launch(this.options);
            },
        };
    }
}
