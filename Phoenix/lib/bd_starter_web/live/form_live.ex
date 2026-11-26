defmodule BdStarterWeb.FormLive do
  @moduledoc """
  A BusinessDash form, drawn on this server:
  `live_render(@conn, BdStarterWeb.FormLive, session: %{"slug" => "…"})`.

  The same forms every BD starter renders (`<BdForm>` on the web, Swift's,
  Kotlin's, Flutter's, Laravel's), run by the same engine: the form's
  controller (`BdStarter.Forms.FormController`, a port of forms-core) lives in
  this LiveView, so the rules (required fields, conditions, steps,
  calculations, the checks BD runs again on submit) are the engine's, not a
  second copy of them.

  In the browser:
    * a change to any box (leaving a text box, picking a choice) reaches the
      server, so conditional fields appear, calculations update and a box
      marked wrong clears once it's right;
    * Next checks the step, Back and the step dots move between steps, and
      Submit checks everything and sends it to BD with the server's key.

  A picked file uploads to this server at once and waits in a temporary file
  until Submit uploads it to BD, so an abandoned form never leaves a file on BD.
  """
  use BdStarterWeb, :live_view

  require Logger

  alias BdStarter.Forms

  alias BdStarter.Forms.{
    Field,
    FieldPath,
    FormController,
    FormView,
    Json,
    PickedFile,
    SampleBackend,
    SubmitOptions
  }

  alias BdStarterWeb.FormComponents

  # The largest file the picker takes; a field's own limit is the engine's to enforce.
  @max_upload_bytes 50 * 1024 * 1024

  @impl true
  def mount(_params, session, socket) do
    slug = session["slug"] || SampleBackend.slug()

    submit_label =
      case session["submit_label"] do
        label when is_binary(label) and label != "" -> String.slice(label, 0, 60)
        _ -> "Submit"
      end

    socket =
      socket
      |> assign(
        slug: slug,
        submit_label: submit_label,
        referrer: session["referrer"],
        form_id: Regex.replace(~r/[^\p{L}\p{N}_-]/u, slug, "-"),
        sample: slug == SampleBackend.slug()
      )
      |> load()

    {:ok, socket, layout: false}
  end

  # Read the form and start fresh: values seeded, nothing marked.
  defp load(socket) do
    try do
      schema = Forms.schema!(socket.assigns.slug)
      options = %SubmitOptions{source: "phoenix-starter", referrer: socket.assigns.referrer}
      c = FormController.new(schema, Forms.backend(socket.assigns.slug), options)

      # collection_select options load here, before the render needs them.
      c =
        c
        |> FormController.fields()
        |> FormView.value_fields()
        |> Enum.filter(&(&1.type == "collection_select"))
        |> Enum.reduce(c, &FormController.load_collection_options(&2, &1.id))

      socket
      |> assign(c: c, unavailable: nil, problems: %{}, notices: [])
      |> allow_file_uploads()
    rescue
      e ->
        Logger.warning("[bd] form #{socket.assigns.slug} unavailable: #{Exception.message(e)}")

        message =
          if is_struct(e, Forms.FormsError),
            do: Exception.message(e),
            else: "Could not load this form."

        assign(socket, c: nil, unavailable: message, problems: %{}, notices: [])
    end
  end

  # ── What the page asks for ────────────────────────────────────────────────

  @impl true
  def handle_event("change", params, socket) do
    {refused, socket} = take_refused_files(socket)
    socket = socket |> apply_input(params) |> recheck() |> assign(notices: refused)
    {:noreply, socket}
  end

  # Enter in a box, or the primary button: Next on a step, else Submit.
  def handle_event("enter", params, socket) do
    socket = apply_input(socket, params)
    c = socket.assigns.c

    if FormController.consecutive?(c) and not FormController.last_step?(c) do
      {_, c} = FormController.next(c)
      {:noreply, assign(socket, c: c, problems: c.errors, notices: [])}
    else
      {:noreply, submit(socket)}
    end
  end

  def handle_event("back", _params, socket) do
    c = FormController.back(socket.assigns.c)
    {:noreply, assign(socket, c: c, problems: %{}, notices: [])}
  end

  def handle_event("step", %{"index" => raw}, socket) do
    c = socket.assigns.c

    case Integer.parse(to_string(raw)) do
      {i, ""} when i >= 0 ->
        if i < FormController.current_step(c),
          do: {:noreply, assign(socket, c: FormController.go_to_step(c, i), problems: %{})},
          else: {:noreply, socket}

      _ ->
        {:noreply, socket}
    end
  end

  def handle_event("add-row", %{"path" => raw}, socket) do
    case FormComponents.decode_path(raw) do
      nil ->
        {:noreply, socket}

      path ->
        {:noreply,
         socket
         |> assign(c: FormController.add_entry(socket.assigns.c, path))
         |> recheck()
         |> allow_file_uploads()}
    end
  end

  def handle_event("remove-row", %{"path" => raw, "row" => row}, socket) do
    with %FieldPath{} = path <- FormComponents.decode_path(raw),
         {i, ""} <- Integer.parse(to_string(row)) do
      c = FormController.remove_entry(socket.assigns.c, i, path)
      prefix = FieldPath.key(path) <> "["

      problems =
        socket.assigns.problems
        |> Enum.reject(fn {k, _} -> String.starts_with?(k, prefix) end)
        |> Map.new()

      {:noreply, socket |> assign(c: c, problems: problems) |> recheck() |> allow_file_uploads()}
    else
      _ -> {:noreply, socket}
    end
  end

  def handle_event("remove-file", %{"path" => raw, "index" => index}, socket) do
    with %FieldPath{} = path <- FormComponents.decode_path(raw),
         {i, ""} <- Integer.parse(to_string(index)) do
      c = socket.assigns.c
      before = c.pending_files
      c = FormController.remove_file(c, i, path)
      discard(Map.drop(before, Map.keys(c.pending_files)))
      {:noreply, socket |> assign(c: c) |> recheck()}
    else
      _ -> {:noreply, socket}
    end
  end

  # "Fill it in again", after a submit.
  def handle_event("again", _params, socket), do: {:noreply, load(socket)}

  # ── Boxes → values ────────────────────────────────────────────────────────

  defp apply_input(%{assigns: %{c: nil}} = socket, _params), do: socket

  defp apply_input(socket, params) do
    case params["input"] do
      input when is_map(input) -> assign(socket, c: FormView.apply_input(socket.assigns.c, input))
      _ -> socket
    end
  end

  # A change: re-check only what's already marked, so a fixed box clears and
  # an untouched one isn't scolded.
  defp recheck(%{assigns: %{c: nil}} = socket), do: socket
  defp recheck(%{assigns: %{problems: problems}} = socket) when problems == %{}, do: socket

  defp recheck(socket) do
    {_, checked} = FormController.validate_all(socket.assigns.c)
    assign(socket, problems: Map.take(checked.errors, Map.keys(socket.assigns.problems)))
  end

  defp submit(socket) do
    c = socket.assigns.c
    held = c.pending_files
    {result, c} = FormController.submit(c)
    # Uploaded to BD (or the form's done): the waiting copies go.
    discard(if result.ok, do: held, else: Map.drop(held, Map.keys(c.pending_files)))

    notices =
      if not result.ok and c.errors == %{},
        do: [result.message || "Could not send the form. Try again."],
        else: []

    assign(socket, c: c, problems: c.errors, notices: notices)
  end

  defp discard(files), do: Enum.each(files, fn {_, file} -> PickedFile.discard(file) end)

  # ── Files ─────────────────────────────────────────────────────────────────

  # Every file field showing (repeater rows included) gets its own upload.
  defp allow_file_uploads(%{assigns: %{c: nil}} = socket), do: socket

  defp allow_file_uploads(socket) do
    c = socket.assigns.c
    known = Map.keys(socket.assigns[:uploads] || %{})

    c
    |> FormController.fields()
    |> file_paths(c, [])
    |> Enum.reduce(socket, fn {field, path}, socket ->
      name = FormView.upload_name(path)

      if name in known do
        socket
      else
        most = Kernel.trunc(Json.num(Field.config(field, "fileConfig", "maxFiles")) || 1.0)

        allow_upload(socket, name,
          accept: :any,
          max_entries: most |> max(1) |> min(20),
          max_file_size: @max_upload_bytes,
          auto_upload: true,
          progress: &uploaded/3
        )
      end
    end)
  end

  defp file_paths(fields, c, entries) do
    Enum.flat_map(FormView.value_fields(fields), fn f ->
      path = FieldPath.new(f.id, entries)

      case f.type do
        "file_upload" ->
          [{f, path}]

        "multi_populator" ->
          count = FormView.repeater(f, FormController.value(c, path)).count

          Enum.flat_map(
            0..(count - 1)//1,
            &file_paths(f.children || [], c, FieldPath.entry(path, &1))
          )

        _ ->
          []
      end
    end)
  end

  # A file landed on this server: hand it to the engine, which keeps it (as a
  # placeholder in the values) or refuses it with a message.
  defp uploaded(name, entry, socket) do
    if not entry.done? do
      {:noreply, socket}
    else
      dir = Path.join(System.tmp_dir!(), "bd-forms")
      File.mkdir_p!(dir)
      sweep(dir)

      held =
        consume_uploaded_entry(socket, entry, fn %{path: path} ->
          dest = Path.join(dir, Ecto.UUID.generate())
          File.cp!(path, dest)
          {:ok, dest}
        end)

      file = %PickedFile{
        name: entry.client_name,
        mime_type:
          if(entry.client_type in [nil, ""],
            do: "application/octet-stream",
            else: entry.client_type
          ),
        size: entry.client_size,
        path: held
      }

      case path_for(socket, name) do
        nil ->
          PickedFile.discard(file)
          {:noreply, socket}

        path ->
          id = Ecto.UUID.generate()
          {taken, c} = FormController.add_files(socket.assigns.c, [{id, file}], path)
          if taken == [], do: PickedFile.discard(file)
          key = FieldPath.key(path)

          problems =
            case Map.get(c.errors, key) do
              nil -> Map.delete(socket.assigns.problems, key)
              message -> Map.put(socket.assigns.problems, key, message)
            end

          {:noreply, assign(socket, c: c, problems: problems)}
      end
    end
  end

  # A file held for a form nobody sent goes a day later, the next time anyone attaches one.
  defp sweep(dir) do
    cutoff = System.os_time(:second) - 86_400

    for name <- File.ls!(dir),
        path <- [Path.join(dir, name)],
        {:ok, %File.Stat{mtime: mtime}} <- [File.stat(path, time: :posix)],
        mtime < cutoff,
        do: File.rm(path)
  end

  defp path_for(socket, name) do
    c = socket.assigns.c

    c
    |> FormController.fields()
    |> file_paths(c, [])
    |> Enum.find_value(fn {_, path} -> if FormView.upload_name(path) == name, do: path end)
  end

  # A file the picker itself refused (too large, too many): said once, then let go.
  defp take_refused_files(socket) do
    configs =
      for {name, %Phoenix.LiveView.UploadConfig{} = config} <- socket.assigns[:uploads] || %{},
          do: {name, config}

    Enum.reduce(configs, {[], socket}, fn {name, config}, acc ->
      Enum.reduce(config.entries, acc, fn entry, {messages, socket} ->
        case for({ref, error} <- config.errors, ref == entry.ref, do: error) do
          [] ->
            {messages, socket}

          [error | _] ->
            {messages ++ [refusal(error, entry)], cancel_upload(socket, name, entry.ref)}
        end
      end)
    end)
  end

  defp refusal(:too_large, entry), do: "\"#{entry.client_name}\" is larger than this form takes."
  defp refusal(:too_many_files, _entry), do: "That's more files than this takes."
  defp refusal(_, entry), do: "\"#{entry.client_name}\" couldn't be attached."

  # ── The page ──────────────────────────────────────────────────────────────

  @impl true
  def render(%{c: nil} = assigns) do
    ~H"""
    <div class="bd-form-host">
      <div class="bd-form" data-bd-status="error">
        <div class="bd-form__error" role="alert">{@unavailable || "Could not load this form."}</div>
      </div>
    </div>
    """
  end

  def render(assigns) do
    c = assigns.c

    assigns =
      assign(assigns,
        v: %{
          c: c,
          errors: assigns.problems,
          form_id: assigns.form_id,
          uploads: assigns[:uploads] || %{}
        },
        stepped: FormView.stepped?(c),
        labels: FormView.summary_labels(c, assigns.problems)
      )

    ~H"""
    <div class="bd-form-host">
      <%= if FormController.submitted?(@c) do %>
        <div class="bd-form" id={"bd-form-#{@form_id}"} data-bd-status="submitted">
          <div class="bd-form__success" role="status">
            <p class="bd-form__success-title">Thanks — we got it.</p>
            <p :if={@sample} class="bd-form__success-note">
              This is the bundled sample, so nothing was sent.
            </p>
            <button class="bd-btn bd-btn--ghost" type="button" phx-click="again">Fill it in again</button>
          </div>
        </div>
      <% else %>
        <form
          class="bd-form"
          id={"bd-form-#{@form_id}"}
          data-bd-status="idle"
          novalidate
          phx-change="change"
          phx-submit="enter"
        >
          <img :if={@c.schema.org_icon} class="bd-form__org-icon" src={@c.schema.org_icon} alt="" />
          <div
            :if={(@c.schema.title || "") != "" or (@c.schema.description || "") != ""}
            class="bd-form__header"
          >
            <h2 :if={(@c.schema.title || "") != ""} class="bd-form__title">{@c.schema.title}</h2>
            <p :if={(@c.schema.description || "") != ""} class="bd-form__description">
              {@c.schema.description}
            </p>
          </div>

          <%= if @stepped and FormView.shows_progress?(@c) do %>
            <div :if={FormView.progress_bar?(@c)} class="bd-progress bd-progress--bar">
              <span class="bd-progress__count">{FormController.current_step(@c) + 1} / {FormController.step_count(
                @c
              )}</span>
              <div class="bd-progress__track">
                <div
                  class="bd-progress__fill"
                  style={"width:#{round(FormController.progress(@c) * 100)}%"}
                >
                </div>
              </div>
            </div>
            <div :if={!FormView.progress_bar?(@c)} class="bd-progress bd-progress--steps">
              <div class="bd-progress__steps">
                <%= for i <- 0..(FormController.step_count(@c) - 1)//1, current = FormController.current_step(@c) do %>
                  <div
                    :if={i > 0}
                    class={["bd-progress__line", i <= current && "bd-progress__line--done"]}
                  >
                  </div>
                  <button
                    class={[
                      "bd-progress__step",
                      i == current && "bd-progress__step--current",
                      i < current && "bd-progress__step--done"
                    ]}
                    type="button"
                    phx-click="step"
                    phx-value-index={i}
                    disabled={i >= current}
                    aria-current={if i == current, do: "step"}
                  >
                    <span class={[
                      "bd-progress__dot",
                      i == current && "bd-progress__dot--current",
                      i < current && "bd-progress__dot--done"
                    ]}>{if i < current, do: "✓", else: i + 1}</span>
                    <span class="bd-progress__title">{FormController.step_title(@c, i)}</span>
                  </button>
                <% end %>
              </div>
            </div>
          <% end %>

          <div :for={notice <- @notices} class="bd-form__error" role="alert">{notice}</div>

          <div :if={@labels != []} class="bd-form__error-summary" role="alert">
            <div class="bd-form__error-summary-title">
              Please complete the highlighted field{if length(@labels) == 1, do: "", else: "s"}.
            </div>
            <div class="bd-form__error-summary-list">{Enum.join(@labels, ", ")}</div>
          </div>

          <%!-- Every step is in the page (the ones you're not on are hidden), so every box's value comes back with each change. --%>
          <%= if @stepped do %>
            <div
              :for={{step, i} <- Enum.with_index(FormController.steps(@c))}
              class="bd-step"
              data-bd-step={i}
              hidden={i != FormController.current_step(@c)}
            >
              <FormComponents.tree v={@v} fields={step} flat={true} />
            </div>
          <% else %>
            <FormComponents.tree v={@v} fields={FormController.fields(@c)} />
          <% end %>

          <div class="bd-nav">
            <button
              :if={@stepped}
              class="bd-btn bd-btn--ghost bd-btn--back"
              type="button"
              phx-click="back"
              disabled={FormController.first_step?(@c)}
            >Back</button>
            <%= if @stepped and not FormController.last_step?(@c) do %>
              <button class="bd-btn bd-btn--next" type="submit">Next</button>
            <% else %>
              <button class="bd-btn bd-btn--submit" type="submit" phx-disable-with="Sending…"><span class="bd-btn__label">{@submit_label}</span></button>
            <% end %>
          </div>
        </form>
      <% end %>
    </div>
    """
  end
end
