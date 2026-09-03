import { expect, test } from "@playwright/test";

test("successful feedback becomes a prominent confirmation", async ({ page }) => {
  await page.route("**/api/feedback", async (route) => {
    expect(route.request().method()).toBe("POST");
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, id: "feedback-e2e" }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Feedback" }).click();
  await page.getByLabel("Tell us what happened or what you would like").fill(
    "Make the success state unmistakable.",
  );
  await page.getByRole("button", { name: "Send feedback" }).click();

  await expect(page.locator("[data-feedback-form]")).toBeHidden();
  await expect(page.locator("[data-feedback-success]")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Feedback sent" })).toBeVisible();
  await expect(page.getByText("Thanks — we received it.")).toBeVisible();
});
