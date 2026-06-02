import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointListOptions,
  CheckpointTuple,
  SerializerProtocol,
  copyCheckpoint,
  CheckpointMetadata,
  CheckpointPendingWrite,
  PendingWrite,
  WRITES_IDX_MAP
} from "@langchain/langgraph-checkpoint";
import { RunnableConfig } from "@langchain/core/runnables";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../shared/supabase";

function uint8ArrayToHex(arr: Uint8Array): string {
  return '\\x' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToUint8Array(hex: string): Uint8Array {
  if (hex.startsWith('\\x')) hex = hex.slice(2);
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return arr;
}

export class SupabaseCheckpointer extends BaseCheckpointSaver {
  private client: SupabaseClient;

  constructor(serde?: SerializerProtocol) {
    super(serde);
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const thread_id = config.configurable?.thread_id;
    const checkpoint_ns = config.configurable?.checkpoint_ns ?? "";
    const checkpoint_id = config.configurable?.checkpoint_id;

    if (!thread_id) return undefined;

    let query = this.client
      .from("agent_checkpoints")
      .select("*")
      .eq("thread_id", thread_id)
      .eq("checkpoint_ns", checkpoint_ns);

    if (checkpoint_id) {
      query = query.eq("checkpoint_id", checkpoint_id);
    } else {
      query = query.order("checkpoint_id", { ascending: false }).limit(1);
    }

    const { data: checkpoints, error } = await query;
    
    if (error || !checkpoints || checkpoints.length === 0) {
      return undefined;
    }

    const row = checkpoints[0];
    const checkpoint: Checkpoint = typeof row.checkpoint === 'string' ? JSON.parse(row.checkpoint) : row.checkpoint;
    const metadata: CheckpointMetadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
    const parentCheckpointId = row.parent_checkpoint_id;

    const { data: writesData } = await this.client
      .from("agent_checkpoint_writes")
      .select("*")
      .eq("thread_id", thread_id)
      .eq("checkpoint_ns", checkpoint_ns)
      .eq("checkpoint_id", row.checkpoint_id);

    const pendingWrites: CheckpointPendingWrite[] = await Promise.all(
      (writesData || []).map(async (writeRow: any) => {
        const valBytes = typeof writeRow.value === 'string' ? hexToUint8Array(writeRow.value) : writeRow.value;
        return [
          writeRow.task_id,
          writeRow.channel,
          await this.serde.loadsTyped(writeRow.type, valBytes)
        ] as CheckpointPendingWrite;
      })
    );

    return {
      config: {
        configurable: {
          thread_id,
          checkpoint_ns,
          checkpoint_id: row.checkpoint_id,
        },
      },
      checkpoint,
      metadata,
      pendingWrites,
      ...(parentCheckpointId && {
        parentConfig: {
          configurable: {
            thread_id,
            checkpoint_ns,
            checkpoint_id: parentCheckpointId,
          },
        },
      }),
    };
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions
  ): AsyncGenerator<CheckpointTuple> {
    const thread_id = config.configurable?.thread_id;
    if (!thread_id) return;

    let query = this.client
      .from("agent_checkpoints")
      .select("*")
      .eq("thread_id", thread_id)
      .order("checkpoint_id", { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    // Simplification for filtering based on before
    if (options?.before?.configurable?.checkpoint_id) {
      query = query.lt("checkpoint_id", options.before.configurable.checkpoint_id);
    }

    const { data: checkpoints, error } = await query;
    if (error || !checkpoints) return;

    for (const row of checkpoints) {
      const checkpoint: Checkpoint = typeof row.checkpoint === 'string' ? JSON.parse(row.checkpoint) : row.checkpoint;
      const metadata: CheckpointMetadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
      
      const { data: writesData } = await this.client
        .from("agent_checkpoint_writes")
        .select("*")
        .eq("thread_id", thread_id)
        .eq("checkpoint_ns", row.checkpoint_ns)
        .eq("checkpoint_id", row.checkpoint_id);

      const pendingWrites: CheckpointPendingWrite[] = await Promise.all(
        (writesData || []).map(async (writeRow: any) => {
          const valBytes = typeof writeRow.value === 'string' ? hexToUint8Array(writeRow.value) : writeRow.value;
          return [
            writeRow.task_id,
            writeRow.channel,
            await this.serde.loadsTyped(writeRow.type, valBytes)
          ] as CheckpointPendingWrite;
        })
      );

      yield {
        config: {
          configurable: {
            thread_id,
            checkpoint_ns: row.checkpoint_ns,
            checkpoint_id: row.checkpoint_id,
          },
        },
        checkpoint,
        metadata,
        pendingWrites,
        ...(row.parent_checkpoint_id && {
          parentConfig: {
            configurable: {
              thread_id,
              checkpoint_ns: row.checkpoint_ns,
              checkpoint_id: row.parent_checkpoint_id,
            },
          },
        }),
      };
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<RunnableConfig> {
    const thread_id = config.configurable?.thread_id;
    const checkpoint_ns = config.configurable?.checkpoint_ns ?? "";
    const parent_checkpoint_id = config.configurable?.checkpoint_id;

    if (!thread_id) {
      throw new Error("Missing thread_id");
    }

    const preparedCheckpoint = copyCheckpoint(checkpoint);

    const { error } = await this.client
      .from("agent_checkpoints")
      .upsert({
        thread_id,
        checkpoint_ns,
        checkpoint_id: checkpoint.id,
        parent_checkpoint_id,
        checkpoint: preparedCheckpoint,
        metadata
      });

    if (error) {
      console.error("Error saving checkpoint:", error);
    }

    return {
      configurable: {
        thread_id,
        checkpoint_ns,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string
  ): Promise<void> {
    const thread_id = config.configurable?.thread_id;
    const checkpoint_ns = config.configurable?.checkpoint_ns ?? "";
    const checkpoint_id = config.configurable?.checkpoint_id;

    if (!thread_id || !checkpoint_id) {
      throw new Error("Missing thread_id or checkpoint_id");
    }

    const rows = await Promise.all(writes.map(async ([channel, value], idx) => {
      const [type, serializedValue] = await this.serde.dumpsTyped(value);
      return {
        thread_id,
        checkpoint_ns,
        checkpoint_id,
        task_id: taskId,
        idx: WRITES_IDX_MAP[channel] ?? idx,
        channel,
        type,
        value: uint8ArrayToHex(serializedValue as Uint8Array)
      };
    }));

    if (rows.length > 0) {
      const { error } = await this.client
        .from("agent_checkpoint_writes")
        .upsert(rows);
      if (error) {
        console.error("Error saving writes:", error);
      }
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.client.from("agent_checkpoints").delete().eq("thread_id", threadId);
    await this.client.from("agent_checkpoint_writes").delete().eq("thread_id", threadId);
  }
}
