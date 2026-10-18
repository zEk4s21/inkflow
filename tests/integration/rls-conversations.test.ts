import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

type Client = SupabaseClient<Database>;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const newHash = () => createHash("sha256").update(randomBytes(32)).digest("hex");

describe.skipIf(!url || !publishableKey || !secretKey)("Conversaciones del asistente: permisos y tope de mensajes", () => {
  const run = `${Date.now()}`;
  let admin: Client;
  let anon: Client;
  let member: Client;
  let outsider: Client;
  const userIds: string[] = [];
  const ws = { a: "", b: "" };

  async function user(label: string, workspaceId: string) {
    const email = `${label}-${run}@example.com`;
    const password = "clave-de-prueba-larga-123";
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    await admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: data.user.id, role: "staff" }).throwOnError();
    const client = createClient<Database>(url!, publishableKey!, options);
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    return client;
  }

  async function conversation(workspaceId = ws.a) {
    const { data } = await admin.from("conversations").insert({ workspace_id: workspaceId, token_hash: newHash() }).select("id").single().throwOnError();
    return data.id;
  }

  const turn = (id: string, max: number, text = "hola") => ({
    p_conversation: id,
    p_max_messages: max,
    p_input_tokens: 100,
    p_output_tokens: 20,
    p_brief: { idea: text },
    p_user_message: text,
    p_assistant_message: "respuesta",
  });

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, options);
    anon = createClient<Database>(url!, publishableKey!, options);
    const { data: a } = await admin.from("workspaces").insert({ slug: `conva-${run}`, name: "A" }).select("id").single().throwOnError();
    const { data: b } = await admin.from("workspaces").insert({ slug: `convb-${run}`, name: "B" }).select("id").single().throwOnError();
    ws.a = a.id;
    ws.b = b.id;
    member = await user("conv-a", ws.a);
    outsider = await user("conv-b", ws.b);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("workspaces").delete().in("id", [ws.a, ws.b].filter(Boolean)).throwOnError();
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  });

  it("el público no lee, no escribe ni usa las funciones", async () => {
    const id = await conversation();
    expect((await anon.from("conversations").select("id")).error?.code).toBe("42501");
    expect((await anon.from("conversations").insert({ workspace_id: ws.a, token_hash: newHash() })).error?.code).toBe("42501");
    expect((await anon.from("conversation_messages").insert({ conversation_id: id, role: "user", content: "x" })).error?.code).toBe("42501");
    expect((await anon.rpc("record_conversation_turn", turn(id, 30))).error?.code).toBe("42501");
    expect((await member.rpc("record_conversation_turn", turn(id, 30))).error?.code).toBe("42501");
    expect((await member.rpc("workspace_ai_tokens_since", { p_workspace: ws.a, p_since: "2020-01-01" })).error?.code).toBe("42501");
  });

  it("los miembros leen las de su estudio, sin el hash del token, y no las modifican", async () => {
    const id = await conversation();
    await admin.rpc("record_conversation_turn", turn(id, 30)).throwOnError();

    const { data } = await member.from("conversations").select("id, brief, message_count").eq("id", id).single().throwOnError();
    expect(data).toMatchObject({ brief: { idea: "hola" }, message_count: 1 });
    expect((await member.from("conversations").select("token_hash").eq("id", id)).error?.code).toBe("42501");
    expect((await member.from("conversation_messages").select("role").eq("conversation_id", id)).data).toHaveLength(2);
    expect((await member.from("conversations").update({ status: "closed" }).eq("id", id)).error?.code).toBe("42501");

    expect((await outsider.from("conversations").select("id").eq("id", id)).data).toEqual([]);
    expect((await outsider.from("conversation_messages").select("id").eq("conversation_id", id)).data).toEqual([]);
  });

  it("guarda los mensajes en orden y suma los tokens", async () => {
    const id = await conversation();
    for (const text of ["uno", "dos", "tres"]) await admin.rpc("record_conversation_turn", turn(id, 30, text)).throwOnError();
    const { data: messages } = await admin.from("conversation_messages").select("role, content").eq("conversation_id", id).order("created_at").throwOnError();
    expect(messages.map((message) => message.content)).toEqual(["uno", "respuesta", "dos", "respuesta", "tres", "respuesta"]);
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "user", "assistant", "user", "assistant"]);
    const { data } = await admin.from("conversations").select("message_count, input_tokens, output_tokens").eq("id", id).single().throwOnError();
    expect(data).toEqual({ message_count: 3, input_tokens: 300, output_tokens: 60 });
  });

  it("el tope de mensajes se respeta aunque lleguen varios a la vez", async () => {
    const id = await conversation();
    const results = await Promise.all(Array.from({ length: 6 }, (_, index) => admin.rpc("record_conversation_turn", turn(id, 2, `m${index}`))));
    expect(results.map((result) => result.error)).toEqual(Array(6).fill(null));
    expect(results.filter((result) => result.data === true)).toHaveLength(2);
    const { data } = await admin.from("conversations").select("message_count, input_tokens").eq("id", id).single().throwOnError();
    // Los rechazados no guardan mensajes, pero los tokens gastados se cuentan igual.
    expect(data).toEqual({ message_count: 2, input_tokens: 600 });
    expect((await admin.from("conversation_messages").select("id").eq("conversation_id", id)).data).toHaveLength(4);
  });

  it("no guarda en conversaciones cerradas o vencidas, y suma el consumo del estudio", async () => {
    const closed = await conversation();
    await admin.from("conversations").update({ status: "closed" }).eq("id", closed).throwOnError();
    expect((await admin.rpc("record_conversation_turn", turn(closed, 30))).data).toBe(false);
    const expired = await conversation();
    await admin.from("conversations").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", expired).throwOnError();
    expect((await admin.rpc("record_conversation_turn", turn(expired, 30))).data).toBe(false);

    const other = await conversation(ws.b);
    await admin.rpc("record_conversation_turn", { p_conversation: other, p_max_messages: 30, p_input_tokens: 7, p_output_tokens: 3 }).throwOnError();
    const { data: usedB } = await admin.rpc("workspace_ai_tokens_since", { p_workspace: ws.b, p_since: "2020-01-01" }).throwOnError();
    expect(usedB).toBe(10);
    const { data: future } = await admin.rpc("workspace_ai_tokens_since", { p_workspace: ws.b, p_since: "2100-01-01" }).throwOnError();
    expect(future).toBe(0);
  });
});
