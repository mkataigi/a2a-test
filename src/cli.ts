import { ToolSet, tool, streamText } from "ai";
import { createInterface } from "node:readline/promises";
import { google } from "@ai-sdk/google";
import { A2AClient } from "./client.js";
import { z } from "zod";

const client = new A2AClient("http://localhost:3000");

const agentCard = await client.agentCard();
const tools: ToolSet = {};
for (const skill of agentCard.skills) {
  tools[skill.id] = tool({
    description: `
      AI エージェント ${
        agentCard.name
      } のスキルです。結果は artifact として返されます。
      スキル名: ${skill.name}
      スキルの説明: ${skill.description}
      例: ${skill.examples?.join(", ")}
    `,
    parameters: z.object({
      input: z
        .string()
        .min(1)
        .describe("AI エージェントにタスクを要求するための入力です。"),
    }),
    execute: async ({ input }) => {
      return await client.sendTask({
        id: skill.id,
        message: {
          role: "user",
          parts: [
            {
              type: "text",
              text: input,
              metadata: {},
            },
          ],
        },
      });
    },
  });
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  while (true) {
    const input = await rl.question("あなた: ");
    if (input === "exit") {
      break;
    }

    const response = streamText({
      model: google("gemini-2.5-pro-exp-03-25"),
      tools,
      messages: [{ role: "user", content: input }],
      maxSteps: 5,
    });

    rl.write("AI: ");
    for await (const chunk of response.textStream) {
      rl.write(chunk);
    }

    rl.write("\n");
  }
}

main()
  .catch((err) => {
    console.error("Error:", err);
  })
  .finally(() => {
    rl.close();
  });
