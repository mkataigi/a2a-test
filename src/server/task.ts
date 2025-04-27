import { randomUUID } from "node:crypto";
import { Hono, Context } from "hono";
import { tool, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import {
  Artifact,
  ErrorMessage,
  Task,
  TaskSendParams,
  TaskStatus,
  Message,
} from "../schema";

const taskApp = new Hono();

taskApp.post("/", async (c) => {
  const body = await c.req.json();
  if (!isValidJsonRpcRequest(body)) {
    const errorResponse: ErrorMessage = {
      code: -32600,
      message: "Invalid Request",
    };
    return c.json(errorResponse, 400);
  }

  switch (body.method) {
    case "tasks/send":
      return handleSendTask(c, body);
    case "tasks/get":
      return handleGetTask(c, body);
    // その他に tasks/cancel や tasks/sendSubscribe などのメソッドもあるが、ここでは省略する
    case "tasks/cancel":
    // ...
    case "tasks/sendSubscribe":
    // ...
    default:
      const errorResponse: ErrorMessage = {
        code: -32601,
        message: "Method not found",
      };
      return c.json(errorResponse, 404);
  }
});

function isValidJsonRpcRequest(body: any) {
  return (
    typeof body === "object" &&
    body !== null &&
    body.jsonrpc === "2.0" &&
    typeof body.method === "string" &&
    (body.id === null ||
      typeof body.id === "string" ||
      typeof body.id === "number") &&
    (body.params === undefined ||
      typeof body.params === "object" ||
      Array.isArray(body.params))
  );
}

// タスクの状態を表すインターフェース
interface TaskAndHistory {
  task: Task;
  history: Message[];
}
// タスクの状態をメモリ上に保持する
const taskStore = new Map<string, TaskAndHistory>();

// タスクストアからタスクを取得する
// タスクが存在しない場合は新しいタスクを作成する
function getOrCreateTask(
  taskId: string,
  initialMessage: Message
): TaskAndHistory {
  // タスクストアからタスクを取得する
  let data = taskStore.get(taskId);
  if (!data) {
    const newTask: Task = {
      id: taskId,
      sessionId: randomUUID(),
      status: {
        // タスクの初期状態は submitted
        state: "submitted",
        timestamp: new Date().toISOString(),
        // 最初のメッセージは history に追加する
        message: undefined,
      },
      history: [],
      artifacts: [],
    };
    data = { task: newTask, history: [initialMessage] };
    taskStore.set(taskId, data);
  } else {
    // すでに存在するタスクなら history に追加する
    data = {
      ...data,
      history: [...data.history, initialMessage],
    };

    // すでに完了済みのタスクの場合はエラーを返す
    const completedStates = ["completed", "canceled", "failed"];
    if (completedStates.includes(data.task.status.state)) {
      const errorResponse: ErrorMessage = {
        code: -32603,
        message: "Task already completed",
      };
      throw new Error(JSON.stringify(errorResponse));
    }
  }
  return data;
}

async function handleSendTask(c: Context, body: any) {
  const params: TaskSendParams = body.params;
  // params の検証
  if (!params || !params.id || !params.message) {
    const errorResponse: ErrorMessage = {
      code: -32602,
      message: "Invalid params",
    };
    return c.json(errorResponse, 400);
  }

  const getOrCreateTaskResult = getOrCreateTask(params.id, params.message);

  // タスクの状態を "working" に更新する
  taskStore.set(params.id, {
    ...getOrCreateTaskResult,
    task: {
      ...getOrCreateTaskResult.task,
      status: {
        state: "working",
        timestamp: new Date().toISOString(),
      },
    },
  });

  // LLM にリクエストを送信する
  const result = await generateText({
    model: google("gemini-2.5-pro-exp-03-25"),
    tools: {
      dice,
    },
    maxSteps: 5,
    // AI エージェントへのリクエストはリクエストパラメータに入っている
    messages: params.message.parts.map((part) => ({
      role: params.message.role === "user" ? "user" : "system",
      content: part.type === "text" ? part.text : "",
    })),
  });

  // アーティファクトを生成する
  const artifact: Artifact = {
    name: "dice",
    description: "サイコロの目",
    parts: [
      {
        type: "text",
        text: result.text,
        metadata: {},
      },
    ],
    metadata: {},
    index: 0,
  };

  // 会話の履歴を取得する
  const steps = result.steps.map((step) => step.text);
  const history = result.steps.map((step) => ({
    role: "agent",
    parts: [
      {
        type: "text",
        text: step.text,
        metadata: {},
      },
    ],
    metadata: {},
  })) as Message[];

  // タスクの状態を "completed" に更新し、タスクの履歴に追加する
  taskStore.set(params.id, {
    ...getOrCreateTaskResult,
    task: {
      ...getOrCreateTaskResult.task,
      status: {
        state: "completed",
        message: {
          role: "agent",
          parts: [
            {
              type: "text",
              text: result.text,
              metadata: {},
            },
          ],
        },
        timestamp: new Date().toISOString(),
      },
      artifacts: [artifact],
      history: [...getOrCreateTaskResult.history, ...history],
    },
  });

  // レスポンスを返す
  const response = {
    jsonrpc: "2.0",
    id: body.id,
    result: {
      id: body.id,
      sessionId: getOrCreateTaskResult.task.sessionId,
      status: "completed",
      artifacts: [artifact],
    },
  };
  return c.json(response);
}

async function handleGetTask(c: Context, body: any) {
  const params = body.params;
  if (!params || !params.id) {
    const errorResponse: ErrorMessage = {
      code: -32602,
      message: "Invalid params",
    };
    return c.json(errorResponse, 400);
  }

  const taskAndHistory = taskStore.get(params.id);
  if (!taskAndHistory) {
    const errorResponse: ErrorMessage = {
      code: -32603,
      message: "Task not found",
    };
    return c.json(errorResponse, 404);
  }

  const response = {
    jsonrpc: "2.0",
    id: body.id,
    result: {
      id: taskAndHistory.task.id,
      sessionId: taskAndHistory.task.sessionId,
      status: taskAndHistory.task.status,
      artifacts: taskAndHistory.task.artifacts,
    },
  };
  return c.json(response);
}

const dice = tool({
  // ツールの説明。この説明を元に LLM がツールを選択する。
  description: "入力された面数のサイコロを振ります。",
  // ツールを呼び出す際に必要なパラメータを定義
  parameters: z.object({
    dice: z.number().min(1).describe("サイコロの面数").optional().default(6),
  }),
  // ツールが LLM によって呼び出されたときに実行される関数
  execute: async ({ dice = 6 }) => {
    return Math.floor(Math.random() * dice) + 1;
  },
});

export { taskApp };
