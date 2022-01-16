"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ABSTRACT CLASS Needs to be implemented to manage one or more browsers via puppeteer instances
 *
 * The ConcurrencyImplementation creates WorkerInstances. Workers create JobInstances:
 * One WorkerInstance per maxWorkers, one JobInstance per job
 */
class ConcurrencyImplementation {
    /**
     * @param options  Options that should be provided to puppeteer.launch
     * @param puppeteer  puppeteer object (like puppeteer or puppeteer-core)
     */
    constructor(options, puppeteer) {
        this.options = options;
        this.puppeteer = puppeteer;
    }
    getExistingWorkerInstanceFor(jobData) {
        return undefined;
    }
}
exports.default = ConcurrencyImplementation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29uY3VycmVuY3lJbXBsZW1lbnRhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb25jdXJyZW5jeS9Db25jdXJyZW5jeUltcGxlbWVudGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBR0E7Ozs7O0dBS0c7QUFDSCxNQUE4Qix5QkFBeUI7SUFJbkQ7OztPQUdHO0lBQ0gsWUFDSSxPQUFtQyxFQUNuQyxTQUF3QjtRQUV4QixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztJQUMvQixDQUFDO0lBcUJNLDRCQUE0QixDQUMvQixPQUFpQjtRQUVqQixPQUFPLFNBQVMsQ0FBQztJQUNyQixDQUFDO0NBQ0o7QUF4Q0QsNENBd0NDIn0=
