import { AgentCard } from "../schema.js";

export const agentCard: AgentCard = {
  name: "Dice Agent",
  description: "サイコロを振るエージェント",
  url: "http://localhost:3000",
  provider: {
    organization: "azukiazusa",
    url: "https://azukiazusa.dev",
  },
  version: "1.0.0",
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  authentication: {
    schemes: [],
  },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  skills: [
    {
      id: "dice-roll",
      name: "サイコロを振る",
      description:
        "サイコロを振ってランダムな値を返すエージェントです。サイコロの目は1から6までの整数です。",
      tags: ["dice", "random"],
      examples: [
        "サイコロを振ってください。",
        "1から6までの整数を返してください。",
      ],
      inputModes: ["text/plain"],
      outputModes: ["text/plain"],
    },
  ],
};
