const MAX_NODE_IDS = 100;
const SCORE_SUBJECTS = ['ネットワーク', 'インフラ', 'バックエンド', 'フロントエンド', 'AI'];
function isNodeIdList(value) {
    return Array.isArray(value)
        && value.length <= MAX_NODE_IDS
        && value.every((item) => typeof item === 'string' && /^[a-z0-9_-]{1,64}$/.test(item));
}
function isScore(value) {
    if (!value || typeof value !== 'object')
        return false;
    const score = value;
    return typeof score.A === 'number'
        && Number.isFinite(score.A)
        && score.A >= 0
        && score.A <= 100
        && score.fullMark === 100
        && Number.isInteger(score.detectedCount)
        && score.detectedCount >= 0
        && score.detectedCount <= MAX_NODE_IDS;
}
export function parseExplanationInput(value) {
    if (!value || typeof value !== 'object')
        return null;
    const input = value;
    if (typeof input.username !== 'string' || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(input.username))
        return null;
    if (!isNodeIdList(input.acquiredNodeIds) || !isNodeIdList(input.unlockedNodeIds))
        return null;
    if (!Array.isArray(input.scores) || input.scores.length !== 5 || !input.scores.every(isScore))
        return null;
    return {
        username: input.username,
        acquiredNodeIds: input.acquiredNodeIds,
        unlockedNodeIds: input.unlockedNodeIds,
        scores: input.scores.map((score, index) => ({
            ...score,
            subject: SCORE_SUBJECTS[index],
        })),
    };
}
export function buildExplanationPrompt(input) {
    return `あなたは確定済みのGitHub技術検出結果を説明するアシスタントです。ノード開放、カテゴリ分類、相対値の計算、検出結果の追加・削除・変更をしないでください。能力、習熟度、適性を評価せず、日本語の自然な説明を3件だけJSONで返してください。

ユーザー: ${input.username}
確定済みノード: ${input.acquiredNodeIds.join(', ') || 'なし'}
今回新規ノード: ${input.unlockedNodeIds.join(', ') || 'なし'}
分野別の検出技術数と相対値: ${input.scores.map((item) => `${item.subject}: ${item.detectedCount}件 (${item.A})`).join(', ')}

{"customLogs":["...","...","..."]}`;
}
export function parseExplanationResponse(value) {
    try {
        const parsed = JSON.parse(value);
        const logs = parsed.customLogs;
        if (!Array.isArray(logs) || logs.length !== 3)
            return null;
        if (!logs.every((log) => typeof log === 'string' && log.trim().length > 0 && log.length <= 300))
            return null;
        return logs;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=explanation.js.map