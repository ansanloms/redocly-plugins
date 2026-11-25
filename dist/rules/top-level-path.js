/**
 * PathItem の key を追跡し、paths 直下の PathItem の path だけを返す。
 *
 * callbacks 内の PathItem は paths 直下の PathItem の内側に入れ子になるため、key のスタックで深さを数える。
 * paths 直下の PathItem (深さ 1 かつ key が "/" 始まり) のみ対象とし、
 * callbacks (深さ 2 以上)、webhooks・components.pathItems (key が "/" 始まりでない) は対象外とする。
 */
export const createTopLevelPathTracker = () => {
    const pathItems = [];
    return {
        enter: (key) => {
            pathItems.push(String(key));
        },
        leave: () => {
            pathItems.pop();
        },
        /** paths 直下の PathItem の中にいればその path を、そうでなければ undefined を返す。 */
        current: () => {
            const path = pathItems[0];
            if (pathItems.length !== 1 || path === undefined || !path.startsWith("/")) {
                return undefined;
            }
            return path;
        },
    };
};
/**
 * tracker と、visitor の `PathItem` に差し込む enter / leave をまとめて返す。
 *
 * rule 側は返り値の `PathItem` を visitor にそのまま置き、`tracker.current()` で paths 直下の path を引く。
 */
export const createTopLevelPathVisitor = () => {
    const tracker = createTopLevelPathTracker();
    return {
        tracker,
        PathItem: {
            enter: (_target, ctx) => {
                tracker.enter(ctx.key);
            },
            leave: () => {
                tracker.leave();
            },
        },
    };
};
