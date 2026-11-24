defmodule BdStarter.Forms.FormController do
  @moduledoc """
  The headless form: values, errors, steps and submission, with BD's rules
  applied exactly as the server applies them. A port of the Swift SDK's
  `BdFormController` (and so of the web renderer's `useForm`). It lives in a
  LiveView's assigns: every function takes the controller and gives back the
  next one.
  """

  alias BdStarter.Forms.{
    Backend,
    Calculation,
    Field,
    FieldPath,
    Formula,
    FormsError,
    Js,
    Json,
    Messages,
    PickedFile,
    Rules,
    Submission,
    SubmitOptions,
    SubmitResult
  }

  defstruct schema: nil,
            backend: nil,
            submit_options: %SubmitOptions{},
            # Field id → JSON value (repeater entries nested inside).
            values: %{},
            # Field path key → message.
            errors: %{},
            step: 0,
            # The visitor has tried to submit or advance: required errors show as they edit.
            has_attempted: false,
            result: nil,
            # Field id → {:loaded, options} | {:failed, message}.
            collection_options: %{},
            # Placeholder id → the PickedFile it stands for.
            pending_files: %{},
            seed: %{},
            functions_by_id: %{},
            user_functions: %{},
            calc_fields: [],
            field_index: %{},
            field_rank: %{},
            # fn reason, label, field -> text: rewords or localizes problems (nil: `Messages`).
            messages: nil

  def new(schema, backend \\ nil, submit_options \\ %SubmitOptions{}) do
    ordered = Rules.fields_in_order(schema.fields)

    {by_id, by_slug} =
      Enum.reduce(schema.business_functions, {%{}, %{}}, fn definition, {by_id, by_slug} ->
        {Map.put_new(by_id, definition["id"], definition), Map.put_new(by_slug, Js.upper(definition["slug"]), definition)}
      end)

    c = %__MODULE__{
      schema: schema,
      backend: backend,
      submit_options: submit_options,
      field_index: Rules.fields_by_id(schema.fields),
      field_rank:
        ordered |> Enum.with_index() |> Enum.reduce(%{}, fn {f, i}, acc -> Map.put_new(acc, f.id, i) end),
      functions_by_id: by_id,
      user_functions: Formula.user_functions(by_slug),
      calc_fields: Enum.filter(ordered, &(&1.type == "calculation")) |> Enum.uniq_by(& &1.id)
    }

    seed = apply_calcs(c, Rules.seed_initial_data(schema.fields))
    c = %{c | seed: seed, values: seed}

    # Conditions that compare a collection record's column need the records
    # loaded before they can evaluate.
    Enum.reduce(ordered, c, fn f, c ->
      rule = Field.rule(f)

      if rule != nil and is_binary(rule["matchField"]) and is_binary(rule["fieldId"]),
        do: load_collection_options(c, rule["fieldId"]),
        else: c
    end)
  end

  def message(c, reason, label, field), do: (c.messages || (&Messages.message/3)).(reason, label, field)

  # ── Schema ────────────────────────────────────────────────────────────────

  def fields(c), do: c.schema.fields
  def field(c, id), do: Map.get(c.field_index, id)
  def consecutive?(c), do: Json.bool(c.schema.settings["isConsecutive"]) == true

  @doc """
  The steps the visitor walks: one holding everything, or one per visible
  top-level element (a condition can add or remove a page).
  """
  def steps(c), do: Rules.compute_steps(fields(c), consecutive?(c), resolver(c, []))

  def step_count(c), do: max(length(steps(c)), 1)
  def current_step(c), do: c.step |> max(0) |> min(step_count(c) - 1)
  def first_step?(c), do: current_step(c) == 0
  def last_step?(c), do: current_step(c) == step_count(c) - 1
  def progress(c), do: (current_step(c) + 1) / step_count(c)

  def step_title(c, index) do
    first = c |> steps() |> Enum.at(index, []) |> List.first()

    cond do
      first != nil and Field.str(first, "stepTitle") != nil -> Field.str(first, "stepTitle")
      first != nil and first.label != "" -> first.label
      true -> "Step #{index + 1}"
    end
  end

  def submitted?(c), do: c.result != nil and c.result.ok

  # ── Values ────────────────────────────────────────────────────────────────

  def value(c, %FieldPath{} = path), do: Map.get(scope_values(c, path.entries), path.field_id)

  def set_value(c, value, %FieldPath{} = path) do
    c = %{c | values: apply_calcs(c, write(value, path, c.values))}
    revalidate(c, path)
  end

  @doc "The values a field inside these repeater entries sees."
  def scope_values(c, entries) do
    Enum.reduce(entries, c.values, fn {repeater, index}, scope ->
      Json.obj(Enum.at(Json.list(Map.get(scope, repeater)) || [], index)) || %{}
    end)
  end

  defp write(value, %FieldPath{field_id: id, entries: entries}, root), do: write_at(root, entries, id, value)

  defp write_at(scope, [], id, value), do: Map.put(scope, id, value)

  defp write_at(scope, [{repeater, index} | rest], id, value) do
    list = Json.list(Map.get(scope, repeater)) || []
    list = if length(list) <= index, do: list ++ List.duplicate(%{}, index + 1 - length(list)), else: list
    entry = Json.obj(Enum.at(list, index)) || %{}
    Map.put(scope, repeater, List.replace_at(list, index, write_at(entry, rest, id, value)))
  end

  defp apply_calcs(c, values) do
    Enum.reduce(c.calc_fields, values, fn f, values ->
      case Field.cfg(f, "calculationConfig") do
        nil ->
          values

        config ->
          r = Calculation.compute(config, &Map.get(values, &1), c.functions_by_id, c.user_functions)
          Map.put(values, f.id, if(r.ok, do: r.value, else: nil))
      end
    end)
  end

  # ── Repeaters ─────────────────────────────────────────────────────────────

  @doc "A repeater's entries: always at least one."
  def entries(c, %FieldPath{} = repeater) do
    case Enum.map(Json.list(value(c, repeater)) || [], &(Json.obj(&1) || %{})) do
      [] -> [%{}]
      list -> list
    end
  end

  def add_entry(c, %FieldPath{} = repeater) do
    with %Field{} = f <- field(c, repeater.field_id),
         list = entries(c, repeater),
         true <- length(list) < Kernel.trunc(Json.num(Field.config(f, "populatorConfig", "maxInstances")) || 10.0) do
      set_value(c, list ++ [%{}], repeater)
    else
      _ -> c
    end
  end

  def remove_entry(c, index, %FieldPath{} = repeater) do
    list = entries(c, repeater)

    if index < 0 or index >= length(list) or length(list) <= 1 do
      c
    else
      # Errors are keyed by entry index; shifting entries invalidates them.
      prefix = FieldPath.key(repeater) <> "["
      errors = c.errors |> Enum.reject(fn {key, _} -> String.starts_with?(key, prefix) end) |> Map.new()
      set_value(%{c | errors: errors}, List.delete_at(list, index), repeater)
    end
  end

  # ── Conditions ────────────────────────────────────────────────────────────

  @doc "What a condition compares, inside these entries."
  def resolver(c, entries) do
    scope =
      if entries == [],
        do: Rules.with_derived_field_values(fields(c), Rules.derive_reference_values(fields(c), c.values)),
        else: scope_values(c, entries)

    Rules.resolver(scope, match_resolver(c))
  end

  @doc "Is this block or page showing right now?"
  def visible?(c, node, entries \\ []), do: Rules.node_visible?(node, resolver(c, entries))

  @doc "The children of a concurrent-reveal group shown so far."
  def reveal_count(c, group, entries \\ []) do
    children = group.children || []

    if Field.bool(group, "concurrentReveal") != true,
      do: length(children),
      else: Rules.concurrent_reveal_count(children, scope_values(c, entries))
  end

  @doc "A condition on a collection record's column: the picked record's value there."
  def match_resolver(c) do
    options = c.collection_options

    fn rule, raw ->
      column = Json.str(rule["matchField"])
      source = Json.str(rule["fieldId"])

      loaded =
        case source && Map.get(options, source) do
          {:loaded, list} -> list
          _ -> nil
        end

      if column == nil or loaded == nil do
        raw
      else
        index = Enum.reduce(loaded, %{}, fn o, acc -> Map.put_new(acc, o.value, o) end)

        one = fn v ->
          case Map.get(index, Js.string(v)) do
            nil -> v
            o when column == "__label__" -> o.label
            o -> Map.get(o.match || %{}, column, v)
          end
        end

        cond do
          is_list(raw) -> Enum.map_join(raw, ", ", &Js.string(one.(&1)))
          raw in [nil, :undefined] -> raw
          true -> one.(raw)
        end
      end
    end
  end

  # ── Validation ────────────────────────────────────────────────────────────

  def error(c, %FieldPath{} = path), do: Map.get(c.errors, FieldPath.key(path))

  @doc "Required and value problems within these nodes, keyed by path."
  def problems(c, nodes) do
    match = match_resolver(c)

    missing =
      Enum.reduce(Rules.find_missing_required(nodes, c.values, match), %{}, fn m, out ->
        Map.put(out, m.path, message(c, "required", m.label, field(c, m.id)))
      end)

    Enum.reduce(Rules.find_invalid_values(nodes, c.values, match), missing, fn bad, out ->
      Map.put_new_lazy(out, bad.path, fn -> message(c, bad.reason, bad.label, field(c, bad.id)) end)
    end)
  end

  @doc "Check one field now (on blur): a format problem shows at once, a missing answer once they've tried to move on."
  def validate(c, %FieldPath{} = path) do
    case field(c, path.field_id) do
      nil ->
        c

      f ->
        value = Map.get(scope_values(c, path.entries), path.field_id)
        reason = if Rules.pending_upload?(value), do: nil, else: Rules.validate_value(f, value) || Rules.client_only_rule(f, value)

        problem =
          cond do
            reason != nil ->
              message(c, reason, f.label, f)

            c.has_attempted and (f.required or Field.must_be_true?(f)) and f.type not in Rules.static_or_layout() and
                Rules.empty?(f, value) ->
              message(c, "required", f.label, f)

            true ->
              nil
          end

        key = FieldPath.key(path)
        %{c | errors: if(problem == nil, do: Map.delete(c.errors, key), else: Map.put(c.errors, key, problem))}
    end
  end

  # After an edit: clear a fixed error, refresh one still wrong, and keep
  # either/or and repeater errors in step.
  defp revalidate(c, path) do
    c = if Map.has_key?(c.errors, FieldPath.key(path)), do: validate(c, path), else: c

    if not c.has_attempted do
      c
    else
      current = problems(c, fields(c))

      errors =
        c.errors
        |> Enum.reject(fn {key, _} ->
          f = field(c, key |> String.split(".") |> List.last())
          not Map.has_key?(current, key) and f != nil and f.type in ["or_condition", "multi_populator"]
        end)
        |> Map.new()

      %{c | errors: errors}
    end
  end

  @doc "Check the whole form and show every problem. `{clean?, controller}`."
  def validate_all(c) do
    errors = problems(c, fields(c))
    {errors == %{}, %{c | has_attempted: true, errors: errors}}
  end

  # ── Navigation ────────────────────────────────────────────────────────────

  @doc "Advance if the current step is complete; otherwise show what's missing. `{moved?, controller}`."
  def next(c) do
    all = steps(c)
    index = current_step(c)

    if index >= length(all) - 1 do
      {false, c}
    else
      c = %{c | has_attempted: true}

      case problems(c, Enum.at(all, index)) do
        found when found == %{} -> {true, %{c | errors: %{}, step: index + 1}}
        found -> {false, %{c | errors: found}}
      end
    end
  end

  def back(c) do
    if current_step(c) > 0, do: %{c | step: current_step(c) - 1, errors: %{}}, else: c
  end

  def go_to_step(c, index), do: %{c | step: index |> max(0) |> min(step_count(c) - 1)}

  # ── Files ─────────────────────────────────────────────────────────────────

  @doc """
  Add picked files (`[{placeholder id, PickedFile}]`) to a `file_upload`
  field. A file the field doesn't take is refused with a message; the rest
  upload on submit. `{ids taken, controller}`.
  """
  def add_files(c, files, %FieldPath{} = path) do
    case field(c, path.field_id) do
      nil ->
        {[], c}

      f ->
        max_files = Kernel.trunc(Json.num(Field.config(f, "fileConfig", "maxFiles")) || 1.0)
        allowed = Json.list(Field.config(f, "fileConfig", "allowedTypes"))
        max_mb = Json.num(Field.config(f, "fileConfig", "maxSize"))

        {list, taken, problem, c} =
          Enum.reduce_while(files, {Json.list(value(c, path)) || [], [], nil, c}, fn {id, file}, {list, taken, problem, c} ->
            cond do
              length(list) >= max_files ->
                {:halt, {list, taken, message(c, "max", f.label, f), c}}

              why = Rules.file_problem(file.name, file.mime_type, file.size, allowed, max_mb) ->
                {:cont, {list, taken, why, c}}

              true ->
                {item, c} = placeholder(c, file, f.id, id)
                {:cont, {list ++ [item], taken ++ [id], problem, c}}
            end
          end)

        c = set_value(c, list, path)
        c = if problem != nil, do: %{c | errors: Map.put(c.errors, FieldPath.key(path), problem)}, else: c
        {taken, c}
    end
  end

  def remove_file(c, index, %FieldPath{} = path) do
    list = Json.list(value(c, path)) || []

    if index < 0 or index >= length(list) do
      c
    else
      pending =
        case Json.str(Json.get(Enum.at(list, index), "localId")) do
          nil -> c.pending_files
          id -> Map.delete(c.pending_files, id)
        end

      set_value(%{c | pending_files: pending}, List.delete_at(list, index), path)
    end
  end

  @doc "A picked file's stand-in in the values until submit uploads it. `{placeholder, controller}`."
  def placeholder(c, %PickedFile{} = file, field_id, id \\ nil) do
    id = id || Ecto.UUID.generate()

    item = %{
      "pending" => true,
      "localId" => id,
      "fieldId" => field_id,
      "name" => file.name,
      "size" => file.size * 1.0,
      "mimeType" => file.mime_type
    }

    {item, %{c | pending_files: Map.put(c.pending_files, id, file)}}
  end

  # ── Remote data ───────────────────────────────────────────────────────────

  def load_collection_options(c, field_id) do
    state =
      case Map.get(c.collection_options, field_id) do
        {:loaded, _} = loaded ->
          loaded

        _ when c.backend == nil ->
          {:failed, "Options can't load without a backend."}

        _ ->
          try do
            {:loaded, Backend.collection_options(c.backend, c.schema.slug, field_id)}
          rescue
            _ -> {:failed, "Couldn't load the options."}
          end
      end

    %{c | collection_options: Map.put(c.collection_options, field_id, state)}
  end

  # ── Submit ────────────────────────────────────────────────────────────────

  @doc """
  Validate everything, upload picked files, and submit. Never raises: every
  outcome comes back as a result, and field problems land in `errors`.
  `{result, controller}`.
  """
  def submit(c) do
    c = %{c | has_attempted: true}
    found = problems(c, fields(c))
    max_files = Rules.form_wide_max_files()

    file_fields =
      c.field_index |> Map.values() |> Enum.filter(&(&1.type == "file_upload")) |> Enum.sort_by(&Map.get(c.field_rank, &1.id))

    total = Enum.sum(Enum.map(file_fields, fn f -> length(Json.list(Map.get(c.values, f.id)) || []) end))

    cond do
      found != %{} ->
        fail(c, "client_validation_failed", summary(map_size(found)), found)

      total > max_files ->
        errors =
          for f <- file_fields, (Json.list(Map.get(c.values, f.id)) || []) != [], into: %{} do
            {f.id, "At most #{max_files} files in total."}
          end

        fail(c, "client_validation_failed", "Please attach at most #{max_files} files in total.", errors)

      c.backend == nil ->
        fail(c, "network_error", "This form has no backend to submit to.", %{})

      true ->
        c = %{c | errors: %{}}
        {values, upload_errors, c} = resolve_uploads(c, c.values, "")
        c = %{c | values: values}

        if upload_errors != %{} do
          fail(c, "network_error", "Some files couldn't be uploaded. Please try again.", upload_errors)
        else
          o = c.submit_options

          submission = %Submission{
            data: Rules.to_submission_payload(fields(c), c.values),
            submitter_email: o.submitter_email,
            submitter_name: o.submitter_name,
            dry_run: if(o.dry_run, do: true),
            source: o.source,
            referrer: o.referrer,
            metadata: o.metadata
          }

          result = Backend.submit(c.backend, c.schema.slug, submission)
          c = %{c | result: result}

          c =
            if result.ok,
              do: c,
              else: jump_to_first_error(%{c | errors: map_issues(c, result.issues)})

          {result, c}
        end
    end
  end

  def summary(count), do: "Please fix the highlighted field#{if count == 1, do: "", else: "s"}."

  defp fail(c, reason, message, errors) do
    issues =
      for {key, text} <- errors do
        id = key |> String.split(".") |> List.last()

        %{
          "fieldId" => id,
          "label" => (field(c, id) && field(c, id).label) || id,
          "reason" => if(reason == "client_validation_failed", do: "invalid", else: "upload"),
          "message" => text
        }
      end

    result = SubmitResult.failure(0, reason, message, issues)
    c = jump_to_first_error(%{c | errors: errors, result: result})
    {result, c}
  end

  # Server issues arrive by field id (or output key): map them onto field errors.
  defp map_issues(c, issues) do
    key_to_id =
      for {id, f} <- c.field_index, Field.key(f) != nil, into: %{}, do: {Field.key(f), id}

    for issue <- issues, issue["fieldId"] != "", into: %{} do
      id =
        if Map.has_key?(c.field_index, issue["fieldId"]),
          do: issue["fieldId"],
          else: Map.get(key_to_id, issue["fieldId"], issue["fieldId"])

      f = field(c, id)
      {id, message(c, issue["reason"], (f && f.label) || issue["label"], f)}
    end
  end

  # In a stepped form, move to the step holding the first error.
  defp jump_to_first_error(c) do
    first = List.first(ordered_error_keys(c))

    if not consecutive?(c) or first == nil do
      c
    else
      root = first |> String.split("[") |> hd() |> String.split(".") |> hd()

      case Enum.find_index(steps(c), fn step -> Map.has_key?(Rules.fields_by_id(step), root) end) do
        nil -> c
        i -> %{c | step: i}
      end
    end
  end

  @doc "Error keys in the order their fields appear."
  def ordered_error_keys(c) do
    c.errors
    |> Map.keys()
    |> Enum.sort_by(fn key -> {Map.get(c.field_rank, key |> String.split("[") |> hd(), :infinity), key} end)
  end

  defp resolve_uploads(c, scope, prefix) do
    Enum.reduce(scope, {scope, %{}, c}, fn {key, value}, {out, errors, c} ->
      f = field(c, key)

      cond do
        f == nil or not is_list(value) ->
          {out, errors, c}

        f.type == "file_upload" ->
          {done, errors, c} =
            Enum.reduce(value, {[], errors, c}, fn item, {done, errors, c} ->
              id = if Rules.pending_upload?(item), do: item["localId"]
              file = id && Map.get(c.pending_files, id)

              if file == nil do
                {done ++ [item], errors, c}
              else
                try do
                  stored = Backend.upload(c.backend, c.schema.slug, f.id, file)
                  {done ++ [stored], errors, %{c | pending_files: Map.delete(c.pending_files, id)}}
                rescue
                  e ->
                    text = if is_struct(e, FormsError), do: Exception.message(e), else: "Couldn't upload #{file.name}."
                    {done ++ [item], Map.put(errors, prefix <> key, text), c}
                end
              end
            end)

          {Map.put(out, key, done), errors, c}

        f.type == "multi_populator" ->
          {list, errors, c} =
            value
            |> Enum.with_index()
            |> Enum.reduce({[], errors, c}, fn {entry, i}, {list, errors, c} ->
              if Json.object?(entry) do
                {entry, more, c} = resolve_uploads(c, entry, "#{prefix}#{key}[#{i}].")
                {list ++ [entry], Map.merge(errors, more), c}
              else
                {list ++ [entry], errors, c}
              end
            end)

          {Map.put(out, key, list), errors, c}

        true ->
          {out, errors, c}
      end
    end)
  end
end
