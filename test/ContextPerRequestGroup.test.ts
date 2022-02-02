import Cluster from "../src/Cluster";
import * as http from "http";

let testServer: http.Server;

const TEST_URL = "http://127.0.0.1:3001/";

beforeAll(async () => {
    // test server
    try {
        testServer = http
            .createServer((req, res) => {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(
                    "<!DOCTYPE HTML>\n" +
                        '<html><body style="font-weight: bold"><script>\n' +
                        "    setTimeout(() => {\n" +
                        "        const cookies = document.cookie.split(';');\n" +
                        "        const cookiesListItems = cookies.map(c => `<li>${c}</li>`)\n" +
                        "        document.body.innerHTML = `<ol>${cookiesListItems.join('')}</ol>`\n" +
                        "    }, 100)\n" +
                        "</script></body></html>\n"
                );
            })
            .listen(3001, "127.0.0.1");
    } catch (err: any) {
        console.log(err);
        throw err;
    }
});

afterAll(() => {
    testServer.close();
});

const concurrencyType = Cluster.CONCURRENCY_CONTEXT_PER_REQUEST_GROUP;

const cookieName = "puppeteer-cluster-testcookie";

describe("cookie sharing", () => {
    test("cookie sharing in Cluster.CONTEXT_PER_REQUEST_GROUP", async () => {
        expect.assertions(34);
        const cluster = await Cluster.launch<{
            url: string;
            groupId: number;
            cookies: { name: string; value: string }[];
            id: string;
        }>({
            puppeteerOptions: { args: ["--no-sandbox"], headless: false },
            maxConcurrency: 3,
            workerShutdownTimeout: 3000,
            concurrency: concurrencyType,
        });

        cluster.task(async ({ page, data: { url, cookies, id } }) => {
            await page.goto(url);

            const cookieToSet = cookies.find((c) => c.value === id)!;
            await page.setCookie({
                name: cookieToSet.name,
                value: cookieToSet.value,
                url: TEST_URL,
            });

            await page.waitForTimeout(1000);

            const pageCookies = await page.cookies();
            expect(pageCookies.length).toEqual(cookies.length);
            cookies.forEach(({ name, value }) => {
                const pageCookie = pageCookies.find(
                    (c) => c.name === name && c.value === value
                );
                expect(pageCookie).toBeDefined();
            });
        });

        const cookies = (count: number, id: number) =>
            Array(count)
                .fill(null)
                .map((_, i) => ({
                    name: `${cookieName}_${id}_${i + 1}`,
                    value: `${i + 1}`,
                }));

        // start three contexts in parallel, two tasks per context
        // cookies are shared between tasks in a single context, but not between contexts
        cluster.queue({
            groupId: 1,
            url: TEST_URL,
            cookies: cookies(2, 1),
            id: "1",
        });
        cluster.queue({
            groupId: 1,
            url: TEST_URL,
            cookies: cookies(2, 1),
            id: "2",
        });

        cluster.queue({
            groupId: 2,
            url: TEST_URL,
            cookies: cookies(2, 2),
            id: "1",
        });
        cluster.queue({
            groupId: 2,
            url: TEST_URL,
            cookies: cookies(2, 2),
            id: "2",
        });

        cluster.queue({
            groupId: 3,
            url: TEST_URL,
            cookies: cookies(2, 3),
            id: "1",
        });
        cluster.queue({
            groupId: 3,
            url: TEST_URL,
            cookies: cookies(2, 3),
            id: "2",
        });

        await cluster.idle();

        // tasks reusing context & cookies from a previous run
        await delay(2000);
        cluster.queue({
            groupId: 3,
            url: TEST_URL,
            cookies: cookies(4, 3),
            id: "3",
        });
        cluster.queue({
            groupId: 3,
            url: TEST_URL,
            cookies: cookies(4, 3),
            id: "4",
        });
        await cluster.idle();

        // tasks in a new context
        await delay(5000);
        cluster.queue({
            groupId: 3,
            url: TEST_URL,
            cookies: cookies(2, 3),
            id: "1",
        });
        cluster.queue({
            groupId: 3,
            url: TEST_URL,
            cookies: cookies(2, 3),
            id: "2",
        });
        await cluster.idle();

        await cluster.close();
    });
});

const delay = (d: number) =>
    new Promise((resolve) => {
        setTimeout(resolve, d);
    });
