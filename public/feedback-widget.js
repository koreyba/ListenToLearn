(() => {
  if (!document.body || document.querySelector("[data-feedback-widget]")) return;

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  const root = document.createElement("div");
  root.dataset.feedbackWidget = "";
  root.innerHTML = `
    <button class="feedback-trigger" data-feedback-open type="button" aria-haspopup="dialog">
      <span aria-hidden="true">💬</span>
      <span>Feedback</span>
    </button>
    <div class="feedback-backdrop" data-feedback-backdrop hidden>
      <section aria-labelledby="feedback-title" aria-modal="true" class="feedback-dialog" role="dialog">
        <div class="feedback-heading">
          <div>
            <p>Beta feedback</p>
            <h2 id="feedback-title">Help improve Unmumble</h2>
          </div>
          <button aria-label="Close feedback" class="feedback-close" data-feedback-close type="button">×</button>
        </div>
        <form data-feedback-form>
          <label>
            <span>What is this about?</span>
            <select name="category">
              <option value="bug">🐛 Something is broken</option>
              <option value="idea">💡 I have an idea</option>
              <option value="other">💬 Something else</option>
            </select>
          </label>
          <label>
            <span>Tell us what happened or what you would like</span>
            <textarea maxlength="2000" name="message" placeholder="A couple of sentences is enough." required rows="5"></textarea>
          </label>
          <label class="feedback-image-field">
            <span>Screenshot <small>Optional · JPEG, PNG or WebP · max 5 MB</small></span>
            <input accept="image/jpeg,image/png,image/webp" name="image" type="file" />
          </label>
          <div class="feedback-image-preview" data-feedback-image-preview hidden>
            <img alt="Selected feedback screenshot" data-feedback-image />
            <div>
              <span data-feedback-image-name></span>
              <button data-feedback-image-remove type="button">Remove</button>
            </div>
          </div>
          <label aria-hidden="true" class="feedback-honeypot">
            Website
            <input autocomplete="off" name="website" tabindex="-1" type="text" />
          </label>
          <p aria-live="polite" class="feedback-status" data-feedback-status role="status"></p>
          <button class="feedback-submit" type="submit">Send feedback</button>
        </form>
      </section>
    </div>
  `;
  document.body.append(root);

  const trigger = root.querySelector("[data-feedback-open]");
  const backdrop = root.querySelector("[data-feedback-backdrop]");
  const closeButton = root.querySelector("[data-feedback-close]");
  const form = root.querySelector("[data-feedback-form]");
  const message = root.querySelector('textarea[name="message"]');
  const imageInput = root.querySelector('input[name="image"]');
  const imagePreview = root.querySelector("[data-feedback-image-preview]");
  const imagePreviewElement = root.querySelector("[data-feedback-image]");
  const imageName = root.querySelector("[data-feedback-image-name]");
  const imageRemove = root.querySelector("[data-feedback-image-remove]");
  const status = root.querySelector("[data-feedback-status]");
  const submit = root.querySelector(".feedback-submit");
  let previousFocus = null;
  let imagePreviewUrl = null;

  function clearImage() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    imagePreviewUrl = null;
    imageInput.value = "";
    imagePreviewElement.removeAttribute("src");
    imageName.textContent = "";
    imagePreview.hidden = true;
  }

  function open() {
    previousFocus = document.activeElement;
    backdrop.hidden = false;
    document.body.classList.add("feedback-open");
    message.focus();
  }

  function close() {
    backdrop.hidden = true;
    document.body.classList.remove("feedback-open");
    previousFocus?.focus?.();
  }

  trigger.addEventListener("click", open);
  closeButton.addEventListener("click", close);
  imageInput.addEventListener("change", () => {
    const image = imageInput.files?.[0];
    if (!image) {
      clearImage();
      return;
    }
    if (!IMAGE_TYPES.has(image.type)) {
      clearImage();
      status.textContent = "Attach a JPEG, PNG, or WebP image.";
      return;
    }
    if (image.size > MAX_IMAGE_BYTES) {
      clearImage();
      status.textContent = "Keep the image under 5 MB.";
      return;
    }
    status.textContent = "";
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    imagePreviewUrl = URL.createObjectURL(image);
    imagePreviewElement.src = imagePreviewUrl;
    imageName.textContent = image.name;
    imagePreview.hidden = false;
  });
  imageRemove.addEventListener("click", clearImage);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !backdrop.hidden) close();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const selectedImage = imageInput.files?.[0];
    data.set("pageUrl", window.location.href);
    data.delete("image");
    if (selectedImage) data.set("image", selectedImage, selectedImage.name);
    submit.disabled = true;
    status.textContent = "Sending…";
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        credentials: "same-origin",
        body: data,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Could not send feedback. Try again.");
      }
      form.reset();
      clearImage();
      status.textContent = "Thanks — feedback received.";
    } catch (error) {
      status.textContent = error instanceof Error
        ? error.message
        : "Could not send feedback. Try again.";
    } finally {
      submit.disabled = false;
    }
  });
})();
