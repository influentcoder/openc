import { expect, type Page, test } from "@playwright/test";

const token = "e2e-token";

async function createSession(page: Page, workspace: "scratch" | "demo-project") {
  await page
    .getByRole("complementary")
    .getByRole("button", { name: "New session", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "New session" });
  if (workspace === "demo-project") {
    await dialog.getByLabel("Folder", { exact: true }).check();
    await dialog.getByRole("button", { name: /demo-project/ }).click();
    await dialog.getByRole("button", { name: "Use this folder" }).click();
  }
  await dialog.getByRole("button", { name: "Create session" }).click();
  await expect(dialog).toBeHidden();
}

async function send(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Message" }).fill(text);
  await page.getByRole("textbox", { name: "Message" }).press("Enter");
}

test("chat in a scratch session survives a page reload", async ({ page }) => {
  await page.goto(`/?token=${token}`);
  await createSession(page, "scratch");
  await send(page, "hello from e2e");
  const transcript = page.getByTestId("transcript");
  await expect(transcript.getByText("Echo #1: hello from e2e")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sessions" })).toContainText("hello from e2e");
  await page.reload();
  await expect(transcript.getByText("Echo #1: hello from e2e")).toBeVisible();
});

test("a folder session runs tools in the chosen folder", async ({ page }) => {
  await page.goto(`/?token=${token}`);
  await createSession(page, "demo-project");
  await expect(page.getByRole("region", { name: "Chat" })).toContainText("projects/demo-project");
  await send(page, "use a tool please");
  const toolCall = page.getByTestId("transcript").locator("details");
  await expect(toolCall).toContainText("Bash");
  await toolCall.locator("summary").click();
  await expect(toolCall).toContainText("src");
});

test("a running turn can be stopped", async ({ page }) => {
  await page.goto(`/?token=${token}`);
  await createSession(page, "scratch");
  await send(page, "be slow");
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByTestId("transcript").getByText("Interrupted")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
});
