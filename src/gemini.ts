import { GoogleGenerativeAI } from '@google/generative-ai';
import type { UserMetadata } from './github';
import type { ScanRecord } from './types';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export interface AnalysisResult {
  archetypeKey: 'frontend' | 'ai' | 'devops' | 'fullstack';
  scores: { subject: string; A: number; fullMark: number }[];
  acquiredNodeIds: string[];
  recommendedNodeIds: string[];
  unlockedNodeIds: string[];
  customLogs: string[];
}

export async function analyzeRepoWithGemini(
  metadata: UserMetadata,
  previousScan: ScanRecord | null = null
): Promise<AnalysisResult> {
  if (!API_KEY) {
    throw new Error('Gemini API Key が設定されていません。.envにキーを登録してください。');
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  // Prepare a condensed list of repositories to stay well within limits
  const repoSummary = metadata.repositories.slice(0, 20).map(r => 
    `- ${r.name}: ${r.language || 'N/A'} (★${r.stars})`
  ).join('\n');

  // Format previous scan baseline
  const previousScanPromptSection = previousScan ? `
【前回のスキャンデータ (ベースライン)】
- 前回のスキャン日時: ${previousScan.timestamp}
- 前回の適性スコア: ${JSON.stringify(previousScan.scores)}
- 前回の習得ノードID一覧: ${JSON.stringify(previousScan.acquiredNodeIds)}
- 前回の推奨ノードID一覧: ${JSON.stringify(previousScan.recommendedNodeIds)}
` : `【前回のスキャンデータ】: なし（これが初めての解析・ベースライン作成です）`;

  // Format recent events since last scan
  const recentEventsPromptSection = metadata.recentEvents.length > 0 
    ? metadata.recentEvents.map(e => 
        `[${e.createdAt}] ${e.type} on ${e.repoName}: ${e.commits.length > 0 ? `Commits: ${JSON.stringify(e.commits)}` : 'No commit msg'}`
      ).join('\n')
    : '前回のスキャン以降、新しいコミットやアクティビティは検知されませんでした。';

  const prompt = `
あなたはGitHubプロフィールの解析を行い、開発者の適性スコアとスキル習得マップを作成する高度なAI成長アナライザーです。
データベースに記録された前回のデータと、今回スキャンされた差分コミットデータを元に、インクリメンタルな経験値（スコア加算）とノードアンロック処理を行います。

ユーザー名: ${metadata.username}
公開リポジトリ総数: ${metadata.publicReposCount}

【前回のデータ】
${previousScanPromptSection}

【前回のスキャン以降に検知された新規アクティビティ・コミット履歴】
${recentEventsPromptSection}

【全体リポジトリ要約】
${repoSummary}

【言語構成統計】
${JSON.stringify(metadata.aggregatedLanguages)}

【主要パッケージ依存関係】
${JSON.stringify(metadata.packageJsonDeps)}

---

これらの情報に基づいて、現在の「適性 (Radar Chart)」および「マスター・スキルツリー (Skill Tree)」に反映させる状態を判定してください。

## 選択可能な技術ノードID一覧:
- 'git': Git
- 'html_css': HTML/CSS
- 'javascript': JavaScript
- 'typescript': TypeScript
- 'react': React
- 'nextjs': Next.js
- 'tailwind': Tailwind CSS
- 'nodejs': Node.js
- 'express': Express
- 'postgresql': PostgreSQL
- 'docker': Docker
- 'aws': AWS
- 'github_actions': GitHub Actions
- 'python': Python
- 'pytorch': PyTorch
- 'openai': OpenAI API
- 'langchain': LangChain

## 判定・差分加算のルール:
1. **acquiredNodeIds**: メタデータ（新規コミット差分、言語分布、主要な依存パッケージ）から実際に使われていると合理的に判断されるノードIDを格納してください。
2. **unlockedNodeIds**: 
   - 前回のスキャンが存在する場合：前回は未習得（'recommended' または 'locked'）だったが、今回の「新規コミット差分」または最新コードから新しく使われていることが確認できたノードIDのみを格納してください。
   - 初回の場合、または今回新規に解放されたものがない場合は空配列 \`[]\` にしてください。
3. **recommendedNodeIds**: 取得済みのノードから見て「次におすすめすべき技術ノード」を最大3つ選んでください。
4. **scores (経験値加算システム)**:
   - 前回のデータが存在する場合：前回のスコアをベースラインとし、上記【新規アクティビティ・コミット履歴】で検知された開発量（コミットされたファイルの内容やコミットメッセージ）に応じて、経験値をプラス加算（例：インフラに関連するコミットがあれば「インフラ: +8」など）して新しいスコアを決定してください。
   - 新規アクティビティ・コミットがない場合、スコアは前回と「同値」に据え置いてください（減らさないでください）。上限は100です。
   - 初回の場合：現在のスキルセットの量から 0〜100 の範囲で算出してください。
   - 科目：ネットワーク、インフラ、バックエンド、フロントエンド、AI
5. **archetypeKey**: 4つのカテゴリ ('frontend', 'ai', 'devops', 'fullstack') から最も強みのあるものを1つ選んでください。
6. **customLogs (成長フィードバック)**:
   - 前回のスキャンから何が変化したかに特化した、お祝いや成長のフィードバックコメント（日本語）を3〜4つ出力してください（例:「ユーザー名 さんの最新コミットを検知！Next.jsのルーティング実装を確認したため、フロントエンド経験値 +12 加算！ノード Next.js がアンロックされました！」など）。
   - コミットが無い場合：「新たにコミットされた差分コードはありません。学習を続けて、次のコミット後に再度スキャンしましょう！」などと励ましてください。

以下のJSONフォーマットで回答してください。余分なキーやマークダウンのコードブロック指示子は含めず、純粋なJSON文字列として出力してください。

{
  "archetypeKey": "frontend" | "ai" | "devops" | "fullstack",
  "scores": [
    { "subject": "ネットワーク", "A": number, "fullMark": 100 },
    { "subject": "インフラ", "A": number, "fullMark": 100 },
    { "subject": "バックエンド", "A": number, "fullMark": 100 },
    { "subject": "フロントエンド", "A": number, "fullMark": 100 },
    { "subject": "AI", "A": number, "fullMark": 100 }
  ],
  "acquiredNodeIds": string[],
  "recommendedNodeIds": string[],
  "unlockedNodeIds": string[],
  "customLogs": string[]
}
`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  try {
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as AnalysisResult;
  } catch (e) {
    console.error('Failed to parse Gemini JSON output:', responseText, e);
    throw new Error('解析データのJSON変換に失敗しました。');
  }
}
