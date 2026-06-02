import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { supabaseClient } from "../../shared/supabase";
import { Pinecone } from "@pinecone-database/pinecone";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "@langchain/core/messages";
import OpenAI from "openai";
import { SupabaseCheckpointer } from "./SupabaseCheckpointer";
import { BlueCcClient } from "../../shared/bluecc";

/**
 * Builds and compiles the LangGraph agent for the Command Center.
 * @param openaiKey - OpenAI API Key
 * @param pineconeKey - Pinecone API Key 
 * @param pineconeIndexName - Pinecone Index Name
 * @param userId - ID of the logged in user to scope memory
 * @param blueccTokenId - Blue.cc Token ID (optional)
 * @param blueccSecretId - Blue.cc Secret ID (optional)
 * @param blueccCompanyId - Blue.cc Company ID (optional)
 */
export const createLangGraphAgent = (
  openaiKey: string,
  pineconeKey: string,
  pineconeIndexName: string,
  userId: string,
  blueccTokenId: string = '',
  blueccSecretId: string = '',
  blueccCompanyId: string = ''
) => {

  // --- Initialize Pinecone ---
  const pc = new Pinecone({ apiKey: pineconeKey });
  const index = pc.index(pineconeIndexName);
  
  // We use standard OpenAI for embeddings here (tool runs in browser)
  const openaiClient = new OpenAI({ apiKey: openaiKey, dangerouslyAllowBrowser: true });

  // Initialize Blue.cc Client
  const blueClient = (blueccTokenId && blueccSecretId) 
    ? new BlueCcClient(blueccTokenId, blueccSecretId, blueccCompanyId || undefined)
    : null;

  // ==========================================
  // DEFINE TOOLS
  // ==========================================

  const getJobCountTool = tool(
    async () => {
      const res = await supabaseClient.getJobCount();
      return JSON.stringify(res);
    },
    {
      name: "get_job_count",
      description: "Returns the total number of jobs extracted in the database.",
      schema: z.object({}),
    }
  );

  const getJobsTool = tool(
    async ({ limit, offset }) => {
      const res = await supabaseClient.getJobs({ limit, offset });
      return JSON.stringify(res);
    },
    {
      name: "get_jobs",
      description: "Fetches a list of jobs from the database.",
      schema: z.object({
        limit: z.number().optional().default(10),
        offset: z.number().optional().default(0),
      }),
    }
  );

  const getQueueStatusTool = tool(
    async () => {
      const res = await supabaseClient.getQueueStatus();
      return JSON.stringify(res);
    },
    {
      name: "get_queue_status",
      description: "Returns all tasks currently in the priority queue.",
      schema: z.object({}),
    }
  );

  const enqueueTasksTool = tool(
    async ({ titles, assigned_to, location, client_id, target_site }) => {
      const res = await supabaseClient.enqueueTasks(titles, assigned_to, location, client_id, target_site);
      return JSON.stringify(res);
    },
    {
      name: "enqueue_tasks",
      description: "Enqueues new job scraping tasks. You MUST ask the user for these details if they don't provide them.",
      schema: z.object({
        titles: z.array(z.string()).describe("List of job titles to search for"),
        assigned_to: z.string().optional().describe("Worker ID to assign to. Leave blank for any node."),
        location: z.string().optional().describe("Location to search in."),
        client_id: z.string().optional().describe("Associated client ID."),
        target_site: z.string().optional().describe("Site to target, usually 'indeed' or 'trovolavoro'."),
      }),
    }
  );

  const deleteQueueTaskTool = tool(
    async ({ id }) => {
      const res = await supabaseClient.deleteQueueTask(id);
      return JSON.stringify(res);
    },
    {
      name: "delete_queue_task",
      description: "Deletes a task from the queue by its ID. DESTRUCTIVE ACTION.",
      schema: z.object({
        id: z.string().describe("The ID of the queue task to delete."),
      }),
    }
  );

  const resetCompletedTasksTool = tool(
    async () => {
      const res = await supabaseClient.resetCompletedTasks();
      return JSON.stringify(res);
    },
    {
      name: "reset_completed_tasks",
      description: "Resets all completed tasks in the queue back to pending. DESTRUCTIVE ACTION.",
      schema: z.object({}),
    }
  );

  const getActiveAgentsTool = tool(
    async () => {
      const res = await supabaseClient.getActiveAgents();
      return JSON.stringify(res);
    },
    {
      name: "get_active_agents",
      description: "Fetches a list of all active remote scraper worker nodes.",
      schema: z.object({}),
    }
  );

  const getClientsTool = tool(
    async () => {
      const res = await supabaseClient.getClients();
      return JSON.stringify(res);
    },
    {
      name: "get_clients",
      description: "Fetches a list of all enrolled clients.",
      schema: z.object({}),
    }
  );

  const deleteClientTool = tool(
    async ({ id }) => {
      const res = await supabaseClient.deleteClient(id);
      return JSON.stringify(res);
    },
    {
      name: "delete_client",
      description: "Deletes a client by its ID. DESTRUCTIVE ACTION.",
      schema: z.object({
        id: z.string().describe("The ID of the client to delete."),
      }),
    }
  );

  const knowledgeBaseTool = tool(
    async ({ query }) => {
      try {
        const embeddingRes = await openaiClient.embeddings.create({
          model: 'text-embedding-3-small',
          input: query,
        });
        const embedding = embeddingRes.data[0].embedding;
        const queryRes = await index.query({
          vector: embedding,
          topK: 5,
          includeMetadata: true,
        });
        const contextChunks = queryRes.matches
          .map((match: any) => {
            const metadata = match.metadata as any;
            return metadata?.text || metadata?.pageContent || metadata?.content || '';
          })
          .filter(Boolean)
          .join('\n\n---\n\n');
        return contextChunks || "No relevant knowledge found.";
      } catch (e: any) {
        return `Error querying knowledge base: ${e.message}`;
      }
    },
    {
      name: "search_knowledge_base",
      description: "Searches the Pinecone knowledge base for documentation, help, or platform instructions.",
      schema: z.object({
        query: z.string().describe("The search query"),
      }),
    }
  );

  // --- Blue.cc Tools ---

  const getBlueWorkspacesTool = tool(
    async () => {
      if (!blueClient) return "Blue.cc credentials are not configured in settings.";
      const res = await blueClient.getWorkspaces();
      return JSON.stringify(res);
    },
    {
      name: "get_blue_workspaces",
      description: "Fetches all Blue.cc projects/workspaces for the company.",
      schema: z.object({}),
    }
  );

  const getBlueWorkspaceContentTool = tool(
    async ({ projectId }) => {
      if (!blueClient) return "Blue.cc credentials are not configured in settings.";
      const res = await blueClient.getWorkspaceContent(projectId);
      return JSON.stringify(res);
    },
    {
      name: "get_blue_workspace_content",
      description: "Fetches lists and to-dos for a specific Blue.cc project/workspace.",
      schema: z.object({
        projectId: z.string().describe("The ID of the project to fetch content for."),
      }),
    }
  );

  const createBlueWorkspaceTool = tool(
    async ({ name, description }) => {
      if (!blueClient) return "Blue.cc credentials are not configured in settings.";
      const res = await blueClient.createWorkspace(name, description);
      return JSON.stringify(res);
    },
    {
      name: "create_blue_workspace",
      description: "Creates a new workspace in Blue.cc. DESTRUCTIVE ACTION.",
      schema: z.object({
        name: z.string().describe("Name of the new workspace"),
        description: z.string().optional().describe("Optional description"),
      }),
    }
  );

  const moveBlueTodoTool = tool(
    async ({ todoId, todoListId, projectId }) => {
      if (!blueClient) return "Blue.cc credentials are not configured in settings.";
      const res = await blueClient.moveTodo(todoId, todoListId, projectId);
      return JSON.stringify(res);
    },
    {
      name: "move_blue_todo",
      description: "Moves a to-do card to a different list/column. DESTRUCTIVE ACTION.",
      schema: z.object({
        todoId: z.string().describe("The ID of the to-do card"),
        todoListId: z.string().describe("The ID of the destination list/column"),
        projectId: z.string().describe("The ID of the project"),
      }),
    }
  );

  const createBlueCommentTool = tool(
    async ({ categoryId, category, text, projectId, parentId }) => {
      if (!blueClient) return "Blue.cc credentials are not configured in settings.";
      const res = await blueClient.createComment(categoryId, category, text, projectId, parentId);
      return JSON.stringify(res);
    },
    {
      name: "create_blue_comment",
      description: "Adds a comment to a Blue.cc to-do. DESTRUCTIVE ACTION.",
      schema: z.object({
        categoryId: z.string().describe("The ID of the to-do card"),
        category: z.string().describe("Typically 'TODO'"),
        text: z.string().describe("The comment text content"),
        projectId: z.string().optional().describe("The ID of the project"),
        parentId: z.string().optional().describe("The ID of the parent comment, if replying"),
      }),
    }
  );

  const tools = [
    getJobCountTool,
    getJobsTool,
    getQueueStatusTool,
    enqueueTasksTool,
    deleteQueueTaskTool,
    resetCompletedTasksTool,
    getActiveAgentsTool,
    getClientsTool,
    deleteClientTool,
    knowledgeBaseTool,
    getBlueWorkspacesTool,
    getBlueWorkspaceContentTool,
    createBlueWorkspaceTool,
    moveBlueTodoTool,
    createBlueCommentTool
  ];

  // ==========================================
  // DEFINE LLM AND SYSTEM PROMPT
  // ==========================================

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
    apiKey: openaiKey,
    configuration: { dangerouslyAllowBrowser: true }
  }).bindTools(tools);

  const SYSTEM_PROMPT = `You are the ultimate RecruitScout Dashboard LangGraph Agent. 
You have full access to the Supabase database, Pinecone knowledge base, and Blue.cc Workspaces via your tools.
You can help the user enqueue scraping tasks, manage agents, read jobs, fetch configurations, and manage their Blue.cc projects.

CRITICAL FORMATTING RULES:
- NEVER use markdown tables.
- ALWAYS display data using proper paragraphs and bulleted lists.
- Keep data concise and easy to read in a small chat window.

CRITICAL RULES FOR DESTRUCTIVE ACTIONS:
Before you call 'delete_queue_task', 'reset_completed_tasks', 'delete_client', 'create_blue_workspace', 'move_blue_todo', or 'create_blue_comment', you MUST ask the user for confirmation in the chat.
For example: "Are you sure you want to delete client X?" or "Are you sure you want to move this task to Done?"
Do NOT execute the destructive tool until the user replies with a clear "yes" or "confirm".`;

  // ==========================================
  // DEFINE GRAPH NODES
  // ==========================================

  // Define the function that calls the model
  const callModel = async (state: typeof MessagesAnnotation.State) => {
    const messages = state.messages;
    // Inject system message if not present
    let finalMessages = messages;
    if (messages.length > 0 && messages[0].getType() !== "system") {
      finalMessages = [new SystemMessage(SYSTEM_PROMPT), ...messages];
    } else if (messages.length === 0) {
      finalMessages = [new SystemMessage(SYSTEM_PROMPT)];
    }
    const response = await model.invoke(finalMessages);
    return { messages: [response] };
  };

  const toolNode = new ToolNode(tools);

  // ==========================================
  // BUILD GRAPH
  // ==========================================

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      // If the LLM decided to call a tool, route to "tools"
      if (lastMessage.additional_kwargs?.tool_calls?.length) {
        return "tools";
      }
      return "__end__";
    })
    .addEdge("tools", "agent");

  // Compile the graph with memory so it remembers the conversation
  const checkpointer = new SupabaseCheckpointer();
  const app = workflow.compile({ checkpointer });

  return app;
};
