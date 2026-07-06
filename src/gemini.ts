import { GoogleGenerativeAI } from '@google/generative-ai';
import type { UserMetadata } from './github';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export interface AnalysisResult {
  archetypeKey: 'frontend' | 'ai' | 'devops' | 'fullstack';
  scores: { subject: string; A: number; fullMark: number }[];
  acquiredNodeIds: string[];
  recommendedNodeIds: string[];
  customLogs: string[];
}

export async function analyzeRepoWithGemini(metadata: UserMetadata): Promise<AnalysisResult> {
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
  const repoSummary = metadata.repositories.slice(0, 30).map(r => 
    `- ${r.name}: ${r.language || 'N/A'} (★${r.stars}) - ${r.description.slice(0, 60)}`
  ).join('\n');

  const prompt = `
あなたはGitHubプロフィールの解析を行い、開発者の適性スコアとスキル習得マップを作成する高度なAIアナライザーです。
以下のメタデータは、ユーザーの全公開リポジトリ（最大30件抽出）から収集されたものです。

ユーザー名: ${metadata.username}
公開リポジトリ総数: ${metadata.publicReposCount}

【リポジトリ一覧】
${repoSummary}

【主要な使用言語の集計 (リポジトリ数)】
${JSON.stringify(metadata.aggregatedLanguages)}

【上位リポジトリから抽出されたパッケージ依存関係】
${JSON.stringify(metadata.packageJsonDeps)}

これらの情報に基づいて、この開発者の「適性 (Radar Chart)」および「マスター・スキルツリー (Skill Tree)」に反映させる状態を判定してください。

## 選択可能な技術ノードID一覧:
- 'git': Git (基本必須)
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

## 判定ルール:
1. "acquiredNodeIds" には、メタデータ（言語分布、レポジトリ名・説明、主要な依存パッケージ）から実際に使われていると合理的に判断されるノードIDを格納してください。
2. "recommendedNodeIds" には、取得済みのノードから見て「次におすすめすべき技術ノード」を最大3つ選んでください（まだ習得していないが、関連性が高いもの）。
3. "scores" (Radar chart用5科目) には、各科目の強さを 0〜100 の数値で評価してください:
   - 「ネットワーク」 (CI/CD、通信、API構造など)
   - 「インフラ」 (Docker, AWS, Gitなど)
   - 「バックエンド」 (Node.js, Express, Postgres, Pythonなど)
   - 「フロントエンド」 (HTML/CSS, JS, TS, React, Next.js, Tailwindなど)
   - 「AI」 (Python, PyTorch, OpenAI, LangChainなど)
4. "archetypeKey" は、4つのカテゴリ ('frontend', 'ai', 'devops', 'fullstack') の中から、最もスコアの比重が高いものに一番適したキーを1つ選んでください。
5. "customLogs" には、解析結果から言える事実やユーザーへのスキル分析のフィードバックコメント（日本語）を3〜4つ出力してください（例：「ユーザー名 chibicode さんの全公開リポジトリを解析！React製プロジェクトを多数確認しました。」等）。

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
