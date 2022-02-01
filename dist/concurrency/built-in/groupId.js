"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGroupId = void 0;
function hasRef(arg) {
    const type = typeof arg;
    return arg && ["object", "function"].includes(type);
}
const groupIdByRef = new WeakMap();
const getGroupId = (jobData) => {
    const maybeDataWithGroupId = jobData;
    if (
        typeof (maybeDataWithGroupId === null || maybeDataWithGroupId === void 0
            ? void 0
            : maybeDataWithGroupId.groupId) === "string"
    ) {
        return maybeDataWithGroupId.groupId;
    }
    if (hasRef(jobData)) {
        const groupId = groupIdByRef.get(jobData);
        if (groupId) {
            return groupId;
        }
        const randomGroupId = `${Math.random() * 1000}`;
        groupIdByRef.set(jobData, randomGroupId);
        return randomGroupId;
    }
    return jobData;
};
exports.getGroupId = getGroupId;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JvdXBJZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb25jdXJyZW5jeS9idWlsdC1pbi9ncm91cElkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUVBLFNBQVMsTUFBTSxDQUFDLEdBQVE7SUFDcEIsTUFBTSxJQUFJLEdBQUcsT0FBTyxHQUFHLENBQUM7SUFDeEIsT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3hELENBQUM7QUFFRCxNQUFNLFlBQVksR0FBRyxJQUFJLE9BQU8sRUFBcUIsQ0FBQztBQUUvQyxNQUFNLFVBQVUsR0FBRyxDQUFDLE9BQWdCLEVBQWEsRUFBRTtJQUN0RCxNQUFNLG9CQUFvQixHQUFHLE9BQThCLENBQUM7SUFFNUQsSUFBSSxPQUFPLENBQUEsb0JBQW9CLGFBQXBCLG9CQUFvQix1QkFBcEIsb0JBQW9CLENBQUUsT0FBTyxDQUFBLEtBQUssUUFBUSxFQUFFO1FBQ25ELE9BQU8sb0JBQW9CLENBQUMsT0FBTyxDQUFDO0tBQ3ZDO0lBRUQsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDakIsTUFBTSxPQUFPLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMxQyxJQUFJLE9BQU8sRUFBRTtZQUNULE9BQU8sT0FBTyxDQUFDO1NBQ2xCO1FBRUQsTUFBTSxhQUFhLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsSUFBSSxFQUFFLENBQUM7UUFDaEQsWUFBWSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDekMsT0FBTyxhQUFhLENBQUM7S0FDeEI7SUFFRCxPQUFPLE9BQW9CLENBQUM7QUFDaEMsQ0FBQyxDQUFDO0FBbkJXLFFBQUEsVUFBVSxjQW1CckIifQ==
