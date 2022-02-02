export type Primitive = string | number | symbol | undefined | bigint;

function hasRef(arg: any): arg is object | Function {
    const type = typeof arg;
    return arg && ["object", "function"].includes(type);
}

const groupIdByRef = new WeakMap<object, Primitive>();

export const getGroupId = (jobData: unknown): Primitive => {
    const maybeDataWithGroupId = jobData as { groupId: unknown };

    if (
        maybeDataWithGroupId &&
        typeof maybeDataWithGroupId === "object" &&
        "groupId" in maybeDataWithGroupId &&
        !hasRef(maybeDataWithGroupId.groupId)
    ) {
        return maybeDataWithGroupId.groupId as Primitive;
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

    return jobData as Primitive;
};
