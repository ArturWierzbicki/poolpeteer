import { ResourceData } from "../ConcurrencyImplementation";
import SingleBrowserImplementation from "../SingleBrowserImplementation";

export default class Page extends SingleBrowserImplementation {
    protected async createResources(): Promise<ResourceData> {
        return {
            page: await this.getBrowser().newPage(),
        };
    }

    protected async freeResources(resources: ResourceData): Promise<void> {
        await resources.page.close();
    }
}
