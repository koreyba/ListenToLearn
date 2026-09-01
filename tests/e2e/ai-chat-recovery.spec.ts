import { expect, test, type Page } from "@playwright/test";

const baseTime = "2026-09-01T10:00:00.000Z";

function chatDetail(messages: Array<Record<string, unknown>>) {
  return {
    id: "chat-1",
    title: "Reliability practice",
    explanationLanguage: "ru",
    targetCount: 0,
    messageCount: messages.length,
    createdAt: baseTime,
    updatedAt: baseTime,
    targets: [],
    messages,
    writeProposals: [],
  };
}

function chatMessage(input: {
  id: string;
  role: "user" | "assistant";
  sequence: number;
  content: string;
  status: "complete" | "pending" | "failed";
  clientMessageId: string;
  errorCode?: string | null;
  terminal?: Record<string, unknown> | null;
  updatedAt?: string;
}) {
  return {
    ...input,
    errorCode: input.errorCode || null,
    terminal: input.terminal || null,
    createdAt: baseTime,
    updatedAt: input.updatedAt || baseTime,
  };
}

async function mockAuthenticatedChat(
  page: Page,
  getCurrentDetail: () => ReturnType<typeof chatDetail>,
) {
  await page.route("**/api/session", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      user: { id: "user-1", email: "learner@example.com", name: "Learner" },
    }),
  }));
  await page.route("**/api/ai/chats", (route) => {
    const detail = getCurrentDetail();
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        generationConfigured: true,
        chats: [{
          id: detail.id,
          title: detail.title,
          explanationLanguage: detail.explanationLanguage,
          targetCount: detail.targetCount,
          messageCount: detail.messageCount,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt,
        }],
      }),
    });
  });
  await page.route("**/api/ai/chats/chat-1", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ chat: getCurrentDetail() }),
  }));
}

test("an interrupted Retry converges to the saved terminal response", async ({ page }) => {
  const user = chatMessage({
    id: "user-message-1",
    role: "user",
    sequence: 1,
    content: "Teach me resilient.",
    status: "complete",
    clientMessageId: "client-turn-1",
  });
  let currentDetail = chatDetail([
    user,
    chatMessage({
      id: "assistant-message-1",
      role: "assistant",
      sequence: 2,
      content: "",
      status: "failed",
      clientMessageId: "client-turn-1",
      errorCode: "provider_timeout",
      terminal: { termination: "provider_error" },
    }),
  ]);
  await mockAuthenticatedChat(page, () => currentDetail);
  await page.route("**/api/ai/chats/chat-1/messages", async (route) => {
    const payload = route.request().postDataJSON() as { clientMessageId: string };
    expect(payload.clientMessageId).toBe("client-turn-1");
    currentDetail = chatDetail([
      user,
      chatMessage({
        id: "assistant-message-1",
        role: "assistant",
        sequence: 2,
        content: "**Resilient** means able to recover quickly.",
        status: "complete",
        clientMessageId: "client-turn-1",
        updatedAt: "2026-09-01T10:01:00.000Z",
      }),
    ]);
    await route.abort("connectionfailed");
  });

  await page.goto("/chat?chat=chat-1");
  await page.getByRole("button", { name: "Retry" }).click();

  await expect(page.getByText("Resilient", { exact: true })).toBeVisible();
  await expect(page.getByText("means able to recover quickly.", { exact: true })).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByText(/live connection was interrupted/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
});

test("Stop terminalizes a saved pending turn and leaves the composer usable", async ({ page }) => {
  const user = chatMessage({
    id: "user-message-1",
    role: "user",
    sequence: 1,
    content: "Give me another example.",
    status: "complete",
    clientMessageId: "client-turn-1",
  });
  let currentDetail = chatDetail([
    user,
    chatMessage({
      id: "assistant-message-1",
      role: "assistant",
      sequence: 2,
      content: "",
      status: "pending",
      clientMessageId: "client-turn-1",
    }),
  ]);
  await mockAuthenticatedChat(page, () => currentDetail);
  await page.route("**/api/ai/chats/chat-1/messages/client-turn-1/cancel", async (route) => {
    currentDetail = chatDetail([
      user,
      chatMessage({
        id: "assistant-message-1",
        role: "assistant",
        sequence: 2,
        content: "",
        status: "failed",
        clientMessageId: "client-turn-1",
        errorCode: "generation_cancelled",
        terminal: { termination: "user_cancelled" },
        updatedAt: "2026-09-01T10:01:00.000Z",
      }),
    ]);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ cancelled: true }) });
  });

  await page.goto("/chat?chat=chat-1");
  await page.getByRole("button", { name: "Stop response" }).click();

  await expect(page.getByText("You stopped this response. Retry it if needed.")).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeEnabled();

  const composer = page.getByLabel("Your practice request");
  await composer.fill("Continue with a shorter example.");
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
});
