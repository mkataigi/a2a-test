import { AgentCard, TaskSendParams, Task } from "./schema.js";

export class A2AClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // taskId を生成する関数
  private generateTaskId(): string {
    return crypto.randomUUID();
  }

  // AgentCard を取得するメソッド
  async agentCard(): Promise<AgentCard> {
    const response = await fetch(`${this.baseUrl}/.well-known/agent.json`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch AgentCard");
    }
    const agentCard: AgentCard = await response.json();
    return agentCard;
  }

  // tasks/send メソッドを実装する
  async sendTask(params: TaskSendParams): Promise<any> {
    const taskId = this.generateTaskId();
    const requestBody = {
      jsonrpc: "2.0",
      id: taskId,
      method: "tasks/send",
      params: params,
    };
    const response = await fetch(`${this.baseUrl}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      throw new Error("Failed to send task");
    }
    const responseBody = await response.json();
    return responseBody;
  }

  // tasks/get メソッドを実装する
  async getTask(taskId: string): Promise<Task> {
    const requestBody = {
      jsonrpc: "2.0",
      id: taskId,
      method: "tasks/get",
      params: {
        id: taskId,
      },
    };
    const response = await fetch(`${this.baseUrl}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      throw new Error("Failed to get task");
    }
    const responseBody = await response.json();
    return responseBody;
  }
}
