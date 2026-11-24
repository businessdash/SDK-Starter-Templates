defmodule BdStarter.Forms.Rules do
  @moduledoc """
  BD's form rules, ported from the server validator
  (`apps/web/src/server/forms/validate.ts`) and the shared condition module,
  by way of the other native ports.

  The server is the authority: it runs all of this again on submit. Running
  it here first means a visitor learns "this is required" or "that isn't an
  email" next to the field, and is never told something the server would then
  contradict. So these follow the server line for line, quirks included.

  Values are a map, field id → JSON value (see `Json`).
  """

  alias BdStarter.Forms.{Dates, Field, FormsData, Js, Json, Re, Units}

  # Limits (server validate.ts).
  @max_string_len 50_000
  @max_textarea_len 200_000
  @max_array_len 500
  @max_phone_len 64
  @max_date_len 64
  @max_address_field_len 512
  @max_name_part_len 128
  @max_name_string_len 1024
  @max_nicknames 20
  @max_file_field_len 4096
  @max_icon_name_len 64
  @max_rich_text_len 20_000
  @max_keys 500

  @name_value_keys ~w(prefix first middle last suffix nicknames full short)

  @email "^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$"
  @url "^(https?:\\/\\/)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,}(?::\\d{1,5})?(?:[\\/?#]\\S*)?$"

  @doc "At most this many files across every file field in one submission."
  def form_wide_max_files, do: 5

  def max_array_len, do: @max_array_len

  # ── Element types ─────────────────────────────────────────────────────────

  @static_types ~w(title subtitle separator image richtext body_text bullet_list table)
  @container_types ~w(input_group flex_row condition_block or_condition)

  # Never required-checked: layout, static copy, and values nobody types.
  @static_or_layout ~w(title subtitle separator flex_row input_group condition_block or_condition image richtext body_text bullet_list table stepper calculation reference_value)

  # Carry no submitted value at all.
  @layout_only ~w(title subtitle separator flex_row input_group condition_block or_condition image richtext body_text bullet_list table reference_value)

  def static_types, do: @static_types
  def container_types, do: @container_types
  def static_or_layout, do: @static_or_layout
  def layout_only, do: @layout_only

  # ── Author regex ──────────────────────────────────────────────────────────

  @doc """
  An author's pattern as PCRE: a bare source or a `/source/flags` literal.
  A broken pattern gives nil and never blocks a submission.
  """
  def compile_field_regex(raw) do
    trimmed = Js.trim(raw)

    {source, flags} =
      case Regex.run(~r/^\/(.*)\/([dgimsuvy]*)\z/s, trimmed) do
        [_, source, flags] -> {source, flags}
        nil -> {trimmed, ""}
      end

    modifiers =
      "u" <>
        if(String.contains?(flags, "i"), do: "i", else: "") <>
        if(String.contains?(flags, "m"), do: "m", else: "") <>
        if(String.contains?(flags, "s"), do: "s", else: "")

    Enum.find_value([{source, modifiers}, {raw, "u"}], fn {pattern, mods} ->
      case Regex.compile(pattern, mods) do
        {:ok, regex} -> regex
        _ -> nil
      end
    end)
  end

  def regex_test(regex, value) do
    Regex.match?(regex, value)
  rescue
    _ -> false
  end

  # ── Conditions ────────────────────────────────────────────────────────────

  def eval_clause(value, op, target) do
    case op do
      "eq" -> Js.string(value) == target
      "neq" -> Js.string(value) != target
      "contains" -> String.contains?(Js.lower(Js.string(value)), Js.lower(target)) or target == ""
      "gt" -> Js.gt(Js.number(value), Js.parse_number(target))
      "lt" -> Js.lt(Js.number(value), Js.parse_number(target))
      "is_empty" -> Json.blank?(value)
      "is_not_empty" -> not Json.blank?(value)
      _ -> true
    end
  end

  @doc "[{operator, value}]"
  def clauses(nil), do: []

  def clauses(rule) do
    case Json.list(rule["clauses"]) do
      [_ | _] = listed ->
        Enum.map(listed, fn c -> {to_string(c["operator"]), Json.str(c["value"]) || ""} end)

      _ ->
        if is_binary(rule["operator"]), do: [{rule["operator"], Json.str(rule["value"]) || ""}], else: []
    end
  end

  @doc """
  Evaluate a rule. `resolve` gives the value the rule compares — usually the
  source field's, but a collection record's column with `matchField`.
  """
  def eval_condition(rule, resolve) do
    all = clauses(rule)

    cond do
      rule == nil or not is_binary(rule["fieldId"]) ->
        true

      all == [] ->
        true

      true ->
        value = resolve.(rule)
        test = fn {op, target} -> eval_clause(value, op, target) end
        if rule["match"] == "any", do: Enum.any?(all, test), else: Enum.all?(all, test)
    end
  end

  def eval_condition_on(rule, data),
    do: eval_condition(rule, fn r -> Map.get(data, Json.str(r["fieldId"]), :undefined) end)

  @doc "Only a condition block or a group can be hidden by a rule."
  def node_visible?(%Field{type: type} = node, resolve) when type in ["condition_block", "input_group"],
    do: eval_condition(Field.rule(node), resolve)

  def node_visible?(_, _), do: true

  @doc """
  Single page: one step holding everything. Consecutive: each visible
  top-level node is a step, so a hidden page is skipped, not shown blank.
  """
  def compute_steps(fields, false, _), do: [fields]

  def compute_steps(fields, true, resolve),
    do: fields |> Enum.filter(&node_visible?(&1, resolve)) |> Enum.map(&[&1])

  # ── Emptiness (server isEmpty) ────────────────────────────────────────────

  def empty?(%Field{type: type} = field, value) do
    empty_list = fn -> not is_list(value) or value == [] end
    empty_string = fn -> not is_binary(value) or value == "" end

    case type do
      t when t in ["checkbox", "tags", "file_upload"] ->
        empty_list.()

      t when t in ["collection_select", "choice_cards"] ->
        if Field.multi?(field), do: empty_list.(), else: empty_string.()

      "rich_text_input" ->
        not is_binary(value) or Js.trim(Regex.replace(~r/<[^>]*>/, value, "")) == ""

      "month_year" ->
        empty_string.()

      "boolean" ->
        # Consent: empty unless exactly true. Otherwise any explicit choice is an answer.
        if Field.must_be_true?(field), do: value != true, else: not is_boolean(value)

      "schedule" ->
        slot = is_binary(Json.get(value, "slotStartAt")) and Json.get(value, "slotStartAt") != ""
        asap = Json.get(value, "asap") == true
        days = (Json.list(Json.get(value, "days")) || []) != []
        times = (Json.list(Json.get(value, "times")) || []) != []
        not (slot or asap or days or times)

      "multi_populator" ->
        not is_list(value) or not Enum.any?(value, &instance_has_value?/1)

      "date_range" ->
        falsy?(Json.get(value, "start")) or falsy?(Json.get(value, "end"))

      "address" ->
        Enum.any?(~w(line1 city state zip), &falsy?(Json.get(value, &1)))

      "name" ->
        Js.trim(Json.str(Json.get(value, "first")) || "") == "" or
          Js.trim(Json.str(Json.get(value, "last")) || "") == ""

      "time_picker" ->
        case Field.time_mode(field) do
          "time_block" -> falsy?(Json.get(value, "start")) or falsy?(Json.get(value, "end"))
          "appointment" -> falsy?(Json.get(value, "date")) or falsy?(Json.get(value, "time"))
          _ -> Json.blank?(value)
        end

      "star_rating" ->
        not Json.number?(value) or Js.le(value, 0.0)

      "happiness_rating" ->
        # 0 is a real answer (😞 very unhappy), not a missing one.
        not Json.number?(value)

      "measurement" ->
        not Json.number?(Json.get(value, "value"))

      "url" ->
        url = Json.get(value, "url")
        not is_binary(url) or url == ""

      _ ->
        Json.blank?(value)
    end
  end

  @doc "JavaScript falsiness, for the server's `!v?.x` checks."
  def falsy?(nil), do: true
  def falsy?(v) when is_boolean(v), do: not v
  def falsy?(:nan), do: true
  def falsy?(v) when is_float(v) or is_integer(v), do: v == 0
  def falsy?(v) when is_binary(v), do: v == ""
  def falsy?(_), do: false

  def instance_has_value?(instance) do
    Json.object?(instance) and
      Enum.any?(instance, fn {_, v} ->
        cond do
          v == nil -> false
          is_binary(v) -> v != ""
          is_list(v) -> v != []
          true -> true
        end
      end)
  end

  # ── Value validation (server validateValue) ───────────────────────────────

  @doc """
  Why a non-empty value doesn't fit its field, or nil when it does. The
  reasons are the server's: type, format, min, max, options, regex,
  business_email. Empty values pass; required-ness is the required walk's.
  """
  def validate_value(%Field{} = field, value) do
    if Json.blank?(value), do: nil, else: validate(field.type, field, value)
  end

  defp len(s), do: Js.length(s)

  defp validate("email", field, value) do
    cond do
      not is_binary(value) -> "type"
      len(value) > @max_string_len -> "max"
      not Regex.match?(Re.get(@email, "u"), value) -> "format"
      Field.config(field, "emailConfig", "businessOnly") == true and consumer_email_domain?(email_domain(value) || "") -> "business_email"
      true -> nil
    end
  end

  defp validate("url", _field, value) do
    u = Json.get(value, "url")

    cond do
      not Json.object?(value) -> "type"
      Json.blank?(u) -> nil
      not is_binary(u) -> "type"
      len(u) > @max_string_len -> "max"
      not Regex.match?(Re.get(@url, "iu"), Js.trim(u)) -> "format"
      Json.has?(value, "verified") and Json.get(value, "verified") not in ["unverified", "safe", "unsafe"] -> "options"
      only_bounded_primitives?(value, @max_string_len) -> nil
      true -> "type"
    end
  end

  defp validate("phone", field, value) do
    cond do
      not is_binary(value) ->
        "type"

      len(value) > @max_phone_len ->
        "max"

      rx = regex_fail(field, value) ->
        rx

      true ->
        digits = Regex.replace(~r/[^0-9]/, value, "")

        if Field.config(field, "phoneConfig", "international") == true do
          if byte_size(digits) in 7..15, do: nil, else: "format"
        else
          national =
            if byte_size(digits) == 11 and String.starts_with?(digits, "1"), do: binary_part(digits, 1, 10), else: digits

          if byte_size(national) == 10, do: nil, else: "format"
        end
    end
  end

  defp validate(type, field, value) when type in ["number", "slider", "stepper"] do
    n =
      cond do
        Json.number?(value) -> Js.f(value)
        is_binary(value) and Js.trim(value) != "" and Js.parse_number(value) != :nan -> Js.parse_number(value)
        true -> :type
      end

    min = Json.num(Field.config(field, "validation", "min")) || Json.num(Field.config(field, "sliderConfig", "min"))
    max = Json.num(Field.config(field, "validation", "max")) || Json.num(Field.config(field, "sliderConfig", "max"))

    cond do
      n == :type -> "type"
      type == "number" and Field.bool(field, "allowDecimal") == false and not Js.integer?(n) and Js.finite?(n) -> "format"
      type == "number" and Field.bool(field, "allowNegative") == false and Js.lt(n, 0.0) -> "min"
      min != nil and Js.lt(n, min) -> "min"
      max != nil and Js.gt(n, max) -> "max"
      true -> nil
    end
  end

  defp validate("star_rating", field, value) do
    max_stars = Json.num(Field.config(field, "starRatingConfig", "maxStars")) || 5.0

    cond do
      not Json.number?(value) -> "type"
      Js.lt(value, 0.0) or Js.gt(value, max_stars + 0.0001) -> "max"
      true -> nil
    end
  end

  defp validate("happiness_rating", _field, value) do
    # Five faces valued 0–4; nothing else is a face.
    cond do
      not Json.number?(value) -> "type"
      not Js.finite?(value) or not Js.integer?(value) or value < 0 or value > 4 -> "options"
      true -> nil
    end
  end

  defp validate("boolean", _field, value), do: if(is_boolean(value), do: nil, else: "type")

  defp validate(type, field, value) when type in ["select", "radio"] do
    opts = Field.options(field)

    cond do
      not is_binary(value) -> "type"
      len(value) > @max_string_len -> "max"
      opts != nil and Field.bool(field, "allowCustom") != true and value not in opts -> "options"
      true -> nil
    end
  end

  defp validate("collection_select", field, value) do
    cond do
      Field.multi?(field) -> string_list(value, fn s -> if len(s) > @max_string_len, do: "max" end)
      not is_binary(value) -> "type"
      len(value) > @max_string_len -> "max"
      true -> nil
    end
  end

  defp validate("rich_text_input", _field, value) do
    cond do
      not is_binary(value) -> "type"
      len(value) > @max_rich_text_len -> "max"
      true -> nil
    end
  end

  defp validate("month_year", _field, value) do
    cond do
      not is_binary(value) -> "type"
      Regex.match?(~r/^\d{4}-(0[1-9]|1[0-2])\z/, value) -> nil
      true -> "format"
    end
  end

  defp validate("color_picker", _field, value) do
    cond do
      not is_binary(value) -> "type"
      Regex.match?(~r/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\z/, value) -> nil
      true -> "format"
    end
  end

  defp validate("icon_select", field, value) do
    allowed = Json.strings(Field.config(field, "iconConfig", "allowedIcons"))

    cond do
      not is_binary(value) -> "type"
      len(value) > @max_icon_name_len -> "max"
      not Regex.match?(~r/^[a-z0-9]+(?:-[a-z0-9]+)*\z/, value) -> "format"
      allowed != [] and value not in allowed -> "options"
      true -> nil
    end
  end

  defp validate("image_input", _field, value) do
    cond do
      not is_binary(value) -> "type"
      len(value) > @max_string_len -> "max"
      Regex.match?(Re.get(@url, "iu"), Js.trim(value)) -> nil
      true -> "format"
    end
  end

  defp validate("tags", _field, value),
    do: string_list(value, fn s -> if len(s) > @max_string_len, do: "max" end)

  defp validate("checkbox", field, value) do
    opts = Field.options(field)

    string_list(value, fn s ->
      if opts != nil and Field.bool(field, "allowCustom") != true and s not in opts, do: "options"
    end)
  end

  defp validate("service_selector", field, value) do
    offered = Enum.map(Json.list(Field.config(field, "serviceConfig", "options")) || [], & &1["id"])
    string_list(value, fn s -> if offered != [] and s not in offered, do: "options" end)
  end

  defp validate("choice_cards", field, value) do
    labels = Enum.map(Field.cards(field), & &1["label"])
    check = fn s -> if labels != [] and s not in labels, do: "options" end

    cond do
      Field.multi?(field) -> string_list(value, check)
      not is_binary(value) -> "type"
      len(value) > @max_string_len -> "max"
      true -> check.(value)
    end
  end

  defp validate("file_upload", field, value) do
    max_files =
      min(Kernel.trunc(Json.num(Field.config(field, "fileConfig", "maxFiles")) || @max_array_len * 1.0), @max_array_len)

    cond do
      not is_list(value) -> "type"
      length(value) > max_files -> "max"
      Enum.any?(value, fn item -> not Json.object?(item) or not only_bounded_primitives?(item, @max_file_field_len) end) -> "type"
      true -> nil
    end
  end

  defp validate("currency", field, value) do
    cond do
      not Json.number?(value) or value == :nan -> "type"
      Field.config(field, "currencyConfig", "allowNegative") != true and Js.lt(value, 0.0) -> "format"
      Field.config(field, "currencyConfig", "allowDecimal") == false and Js.finite?(value) and not Js.integer?(value) -> "format"
      true -> nil
    end
  end

  defp validate("measurement", field, value) do
    raw = Json.get(value, "value")
    n = Json.num(raw)
    unit = Json.str(Json.get(value, "unit"))
    category = Units.category(Json.str(Field.config(field, "unitConfig", "category")))

    cond do
      not Json.object?(value) -> "type"
      Json.blank?(raw) -> nil
      n == nil or n == :nan -> "type"
      unit == nil -> "type"
      category != nil and not Units.contains?(category, unit) -> "options"
      Field.config(field, "unitConfig", "allowDecimal") == false and Js.finite?(n) and not Js.integer?(n) -> "format"
      only_bounded_primitives?(value, @max_date_len) -> nil
      true -> "type"
    end
  end

  defp validate("multi_populator", field, value) do
    max_instances =
      min(Kernel.trunc(Json.num(Field.config(field, "populatorConfig", "maxInstances")) || 10.0), @max_array_len)

    known = instance_value_fields(field.children || [])

    cond do
      not is_list(value) ->
        "type"

      length(value) > max_instances ->
        "max"

      true ->
        Enum.find_value(value, fn instance ->
          cond do
            not Json.object?(instance) ->
              "type"

            map_size(instance) > @max_keys ->
              "max"

            true ->
              Enum.find_value(instance, fn {key, v} ->
                case Map.get(known, key) do
                  nil ->
                    "options"

                  child ->
                    case validate_value(child, v) do
                      nil -> nil
                      reason -> "#{if child.label == "", do: key, else: child.label}: #{reason}"
                    end
                end
              end)
          end
        end)
    end
  end

  defp validate("date_range", _field, value) do
    if Json.object?(value) and only_bounded_primitives?(value, @max_date_len), do: nil, else: "type"
  end

  defp validate("time_picker", field, value) do
    cond do
      Field.time_mode(field) == "simple" and not is_binary(value) -> "type"
      Field.time_mode(field) == "simple" -> if len(value) > @max_date_len, do: "max"
      not Json.object?(value) -> "type"
      only_bounded_primitives?(value, @max_date_len) -> nil
      true -> "type"
    end
  end

  defp validate("address", _field, value) do
    zip = Json.get(value, "zip")

    cond do
      not Json.object?(value) -> "type"
      not only_bounded_primitives?(value, @max_address_field_len) -> "type"
      is_binary(zip) and not valid_us_zip?(zip) -> "format"
      true -> nil
    end
  end

  defp validate("name", _field, value) do
    if not Json.object?(value) do
      "type"
    else
      parts =
        Enum.find_value(value, fn {key, v} ->
          cond do
            key not in @name_value_keys -> "options"
            key == "nicknames" or v == nil -> nil
            not is_binary(v) -> "type"
            len(v) > if(key in ["full", "short"], do: @max_name_string_len, else: @max_name_part_len) -> "max"
            true -> nil
          end
        end)

      parts || nicknames_problem(Json.get(value, "nicknames"))
    end
  end

  defp validate("schedule", _field, value) do
    if not Json.object?(value) do
      "type"
    else
      slot = value["slotStartAt"]

      cond do
        Map.has_key?(value, "slotStartAt") and not is_binary(slot) -> "type"
        Map.has_key?(value, "slotStartAt") and len(slot) > @max_date_len -> "max"
        Map.has_key?(value, "slotStartAt") and Dates.parse_instant(slot) == nil -> "format"
        Map.has_key?(value, "asap") and not is_boolean(value["asap"]) -> "type"
        true ->
          Enum.find_value(["days", "times"], fn key ->
            if Map.has_key?(value, key),
              do: string_list(value[key], fn s -> if len(s) > @max_date_len, do: "max" end)
          end) ||
            cond do
              not Map.has_key?(value, "notes") -> nil
              not is_binary(value["notes"]) -> "type"
              len(value["notes"]) > @max_string_len -> "max"
              true -> nil
            end
      end
    end
  end

  defp validate(type, field, value) do
    # text / textarea / date / any plain-text input.
    cond do
      Json.number?(value) or is_boolean(value) -> nil
      not is_binary(value) -> "type"
      len(value) > if(type == "textarea", do: @max_textarea_len, else: @max_string_len) -> "max"
      true -> regex_fail(field, value)
    end
  end

  defp nicknames_problem(nil), do: nil
  defp nicknames_problem(s) when is_binary(s), do: if(len(s) > @max_name_string_len, do: "max")

  defp nicknames_problem(list) when is_list(list) do
    if length(list) > @max_nicknames do
      "max"
    else
      Enum.find_value(list, fn item ->
        cond do
          not is_binary(item) -> "type"
          len(item) > @max_name_part_len -> "max"
          true -> nil
        end
      end)
    end
  end

  defp nicknames_problem(_), do: "type"

  # A list of strings, each passing `check`: the first reason, else nil.
  defp string_list(value, check) do
    cond do
      not is_list(value) -> "type"
      length(value) > @max_array_len -> "max"
      true -> Enum.find_value(value, fn item -> if is_binary(item), do: check.(item), else: "type" end)
    end
  end

  def regex_fail(field, value) do
    pattern = Field.str(field, "regexPattern")

    with p when p not in [nil, ""] <- pattern,
         regex when regex != nil <- compile_field_regex(p) do
      if regex_test(regex, value), do: nil, else: "regex"
    else
      _ -> nil
    end
  end

  defp only_bounded_primitives?(obj, max_len) do
    Enum.all?(obj, fn {_, v} ->
      cond do
        v == nil or Json.number?(v) or is_boolean(v) -> true
        not is_binary(v) -> false
        true -> len(v) <= max_len
      end
    end)
  end

  @doc "Value-bearing fields inside a repeater, keyed by id and output key."
  def instance_value_fields(children) do
    Enum.reduce(children, %{}, fn f, acc ->
      acc =
        if f.type in @layout_only do
          acc
        else
          acc = Map.put(acc, f.id, f)
          if Field.key(f) != nil, do: Map.put(acc, Field.key(f), f), else: acc
        end

      if f.type != "multi_populator" and f.children != nil,
        do: Map.merge(acc, instance_value_fields(f.children)),
        else: acc
    end)
  end

  @doc "A US ZIP (5 digits or ZIP+4), or nothing: a blank address has no ZIP to check."
  def valid_us_zip?(zip) do
    z = Js.trim(zip)
    z == "" or Regex.match?(~r/^\d{5}(-\d{4})?\z/, z)
  end

  def email_domain(email) do
    case :binary.matches(email, "@") do
      [] ->
        nil

      matches ->
        {at, _} = List.last(matches)
        if at == byte_size(email) - 1, do: nil, else: email |> binary_part(at + 1, byte_size(email) - at - 1) |> Js.trim() |> Js.lower()
    end
  end

  def consumer_email_domain?(host) do
    h = host |> Js.trim() |> Js.lower()
    MapSet.member?(FormsData.consumer_email_domains(), h) or String.ends_with?(h, ".gmail.com") or String.ends_with?(h, ".googlemail.com")
  end

  # ── Required walk (server findMissingRequiredFields) ──────────────────────

  @doc """
  Every required field with no answer under the current conditions: hidden
  blocks and pages enforce nothing, an either/or needs one side, a required
  repeater needs an entry and each filled entry its own required fields, and
  consent must be true. `[%{id:, label:, path:}]`
  """
  def find_missing_required(fields, data, resolve_match \\ nil) do
    derived = with_derived_field_values(fields, derive_reference_values(fields, data))
    fields |> walk_required(derived, "", resolve_match) |> Enum.reverse()
  end

  @doc "What a condition compares, in this scope (a collection column via `resolve_match`)."
  def resolver(scope, resolve_match) do
    fn rule ->
      raw = Map.get(scope, Json.str(rule["fieldId"]) || "", :undefined)
      if not is_binary(rule["matchField"]) or resolve_match == nil, do: raw, else: resolve_match.(rule, raw)
    end
  end

  defp walk_required(nodes, scope, prefix, resolve_match, acc \\ []) do
    resolve = resolver(scope, resolve_match)

    Enum.reduce(nodes, acc, fn f, acc ->
      case f.type do
        "condition_block" ->
          if eval_condition(Field.rule(f), resolve),
            do: walk_required(f.children || [], scope, prefix, resolve_match, acc),
            else: acc

        "or_condition" ->
          children = f.children || []
          filled = Enum.map(children, &subtree_has_value?([&1], scope, resolve_match))

          if children != [] and true not in filled do
            [%{id: f.id, label: if(f.label == "", do: "Either side required", else: f.label), path: prefix <> f.id} | acc]
          else
            children
            |> Enum.zip(filled)
            |> Enum.reduce(acc, fn {child, has}, acc ->
              if has, do: walk_required([child], scope, prefix, resolve_match, acc), else: acc
            end)
          end

        t when t in ["input_group", "flex_row"] ->
          if node_visible?(f, resolve),
            do: walk_required(f.children || [], scope, prefix, resolve_match, acc),
            else: acc

        "multi_populator" ->
          filled =
            (Json.list(Map.get(scope, f.id)) || [])
            |> Enum.with_index()
            |> Enum.filter(fn {instance, _} -> Json.object?(instance) and instance_has_value?(instance) end)

          if f.required and filled == [] do
            [%{id: f.id, label: if(f.label == "", do: "At least one entry required", else: f.label), path: prefix <> f.id} | acc]
          else
            Enum.reduce(filled, acc, fn {instance, index}, acc ->
              walk_required(f.children || [], instance, "#{prefix}#{f.id}[#{index}].", resolve_match, acc)
            end)
          end

        t ->
          cond do
            t in @static_or_layout -> acc
            (f.required or Field.must_be_true?(f)) and empty?(f, Map.get(scope, f.id)) ->
              [%{id: f.id, label: if(f.label == "", do: "Untitled", else: f.label), path: prefix <> f.id} | acc]

            true -> acc
          end
      end
    end)
  end

  @doc "Does any value-bearing leaf under these nodes hold an answer? (Which side of an either/or.)"
  def subtree_has_value?(nodes, data, resolve_match \\ nil) do
    resolve = resolver(data, resolve_match)

    Enum.any?(nodes, fn f ->
      case f.type do
        "condition_block" ->
          eval_condition(Field.rule(f), resolve) and subtree_has_value?(f.children || [], data, resolve_match)

        t when t in ["or_condition", "input_group", "flex_row"] ->
          node_visible?(f, resolve) and subtree_has_value?(f.children || [], data, resolve_match)

        t ->
          t not in @static_or_layout and not empty?(f, Map.get(data, f.id))
      end
    end)
  end

  @doc "Concurrent reveal: children up to and including the first still missing an answer."
  def concurrent_reveal_count(children, data) do
    case Enum.find_index(children, fn child -> find_missing_required([child], data) != [] end) do
      nil -> length(children)
      i -> i + 1
    end
  end

  # ── Derived values ────────────────────────────────────────────────────────

  @doc "Hidden `reference_value` elements mirror their source once it's complete (else nil)."
  def derive_reference_values(fields, data) do
    by_id = fields_by_id(fields)

    fields
    |> fields_in_order()
    |> Enum.filter(&(&1.type == "reference_value"))
    |> Enum.reduce(data, fn f, out ->
      source_id = Field.str(f, "referenceFieldId")
      source = source_id && Map.get(by_id, source_id)

      derived =
        if source != nil and not empty?(source, Map.get(data, source_id)) do
          val = Map.get(data, source_id)
          pattern = Field.str(source, "regexPattern")
          regex = if pattern not in [nil, ""], do: compile_field_regex(pattern)
          if regex == nil or regex_test(regex, Js.string(val)), do: val
        end

      Map.put(out, f.id, derived)
    end)
  end

  @doc """
  One derived value per exploded checkbox option (`id::optionKey`),
  month/year part (`id::year`) and name part (`id::first`), so a condition
  can point at any of them.
  """
  def with_derived_field_values(fields, data) do
    fields
    |> fields_in_order()
    |> Enum.reduce(data, fn field, out ->
      options = Field.options(field)
      raw = Map.get(data, field.id)

      out =
        if field.type == "checkbox" and Field.bool(field, "explodeOptions") == true and options not in [nil, []] do
          picked = Json.strings(raw)

          field
          |> key_base()
          |> checkbox_option_keys(options)
          |> Enum.reduce(out, fn {key, option}, out -> Map.put(out, "#{field.id}::#{key}", option in picked) end)
        else
          out
        end

      out =
        if field.type == "month_year" and Field.bool(field, "explodeMonthYear") == true do
          parts = month_year_parts(raw)

          out
          |> Map.put("#{field.id}::year", parts && elem(parts, 0) * 1.0)
          |> Map.put("#{field.id}::month", parts && elem(parts, 1) * 1.0)
        else
          out
        end

      if field.type == "name" do
        optional = Enum.filter(~w(prefix middle suffix nicknames), &(Field.config(field, "nameConfig", &1) == true))

        Enum.reduce(~w(first last full short) ++ optional, out, fn part, out ->
          Map.put(out, "#{field.id}::#{part}", name_part_value(raw, part))
        end)
      else
        out
      end
    end)
  end

  defp key_base(field), do: Field.str(field, "outputKey") || to_output_key(field.label)

  defp month_year_parts(raw) when is_binary(raw) do
    case Regex.run(~r/^(\d{4})-(\d{1,2})\z/, Js.trim(raw)) do
      [_, y, m] -> {String.to_integer(y), String.to_integer(m)}
      nil -> nil
    end
  end

  defp month_year_parts(_), do: nil

  defp name_part_value(raw, part) do
    if not Json.object?(raw) do
      nil
    else
      own = Json.str(raw[part])

      case part do
        p when p in ~w(prefix first middle last suffix) ->
          if own not in [nil, ""], do: own

        p when p in ["full", "short"] ->
          if own not in [nil, ""] do
            own
          else
            composed = if p == "full", do: compose_full_name(raw), else: compose_short_name(raw)
            if composed == "", do: nil, else: composed
          end

        "nicknames" ->
          case Json.list(raw["nicknames"]) do
            [_ | _] = list -> Enum.map_join(list, ", ", &Js.string/1)
            _ -> nil
          end

        _ ->
          nil
      end
    end
  end

  @doc "Every node by id, containers and repeaters' children included."
  def fields_by_id(fields), do: fields |> fields_in_order() |> Map.new(&{&1.id, &1})

  @doc "Every node, containers and repeaters' children included, in form order."
  def fields_in_order(fields) do
    Enum.flat_map(fields, fn f -> [f | if(f.children != nil, do: fields_in_order(f.children), else: [])] end)
  end

  # ── Output keys ───────────────────────────────────────────────────────────

  @doc "\"Best time to reach:\" → \"bestTimeToReach\"; \"\" when the label has nothing usable."
  def to_output_key(raw) do
    words = raw |> String.replace(~r/[^a-zA-Z0-9]+/, " ") |> String.split(" ", trim: true)

    case words do
      [] ->
        ""

      [first | rest] ->
        key =
          String.downcase(first, :ascii) <>
            Enum.map_join(rest, "", fn <<c::binary-size(1), tail::binary>> ->
              String.upcase(c, :ascii) <> String.downcase(tail, :ascii)
            end)

        if key =~ ~r/^[0-9]/, do: "_" <> key, else: key
    end
  end

  defp checkbox_option_keys(field_key, options) do
    {pairs, _} =
      Enum.map_reduce(options, MapSet.new(), fn option, used ->
        opt_key = if to_output_key(option) == "", do: "option", else: to_output_key(option)
        <<c::binary-size(1), tail::binary>> = opt_key
        key = field_key <> String.upcase(c, :ascii) <> tail

        key =
          if MapSet.member?(used, key) do
            n = Enum.find(Stream.iterate(2, &(&1 + 1)), fn n -> not MapSet.member?(used, "#{key}#{n}") end)
            "#{key}#{n}"
          else
            key
          end

        {{key, option}, MapSet.put(used, key)}
      end)

    pairs
  end

  # ── Names ─────────────────────────────────────────────────────────────────

  @name_part_order ~w(prefix first middle last suffix)

  defp compose_name(v, parts) do
    parts
    |> Enum.map(fn part -> Json.str(v[part]) end)
    |> Enum.reject(&is_nil/1)
    |> Enum.map(&Js.trim/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.join(" ")
  end

  defp compose_full_name(v), do: compose_name(v, @name_part_order)
  defp compose_short_name(v), do: compose_name(v, ["first", "last"])

  @doc "Trimmed parts, nicknames split into a list, `full`/`short` recomputed."
  def normalize_name_value(raw) do
    if not Json.object?(raw) do
      raw
    else
      out =
        Enum.reduce(@name_part_order, %{}, fn key, out ->
          case Json.str(raw[key]) do
            nil -> out
            s -> if Js.trim(s) != "", do: Map.put(out, key, Js.trim(s)), else: out
          end
        end)

      list =
        case raw["nicknames"] do
          s when is_binary(s) -> String.split(s, ",")
          l when is_list(l) -> Json.strings(l)
          _ -> []
        end
        |> Enum.map(&Js.trim/1)
        |> Enum.reject(&(&1 == ""))

      out = if list != [], do: Map.put(out, "nicknames", list), else: out
      out |> Map.put("full", compose_full_name(out)) |> Map.put("short", compose_short_name(out))
    end
  end

  # ── Seed + payload ────────────────────────────────────────────────────────

  @no_seed_static ~w(title subtitle separator image richtext body_text bullet_list table calculation reference_value)
  @step_containers ~w(input_group condition_block or_condition)

  @doc "Starting values: what each element shows before the visitor touches it."
  def seed_initial_data(fields) do
    Enum.reduce(fields, %{}, fn f, out ->
      cond do
        f.type == "multi_populator" ->
          Map.put(out, f.id, default_value(f))

        true ->
          value =
            if f.type not in @no_seed_static and f.type not in @step_containers and f.type != "flex_row",
              do: default_value(f)

          out = if value != nil, do: Map.put(out, f.id, value), else: out
          if f.children != nil, do: Map.merge(out, seed_initial_data(f.children)), else: out
      end
    end)
  end

  @doc "A field's starting value, or nil for one that starts unanswered."
  def default_value(field) do
    case field.type do
      t when t in ["checkbox", "tags"] ->
        []

      "choice_cards" ->
        if Field.multi?(field), do: [], else: ""

      "multi_populator" ->
        [%{}]

      "measurement" ->
        category = Units.category_of(field)
        first = case category.units do
          [{symbol, _} | _] -> symbol
          [] -> ""
        end

        %{
          "value" => "",
          "unit" => Json.str(Field.config(field, "unitConfig", "defaultUnit")) || first,
          "baseUnit" => category.base_unit
        }

      "boolean" ->
        Field.default_value(field) == true

      t when t in ["number", "stepper", "star_rating"] ->
        0.0

      "slider" ->
        # Start where the thumb is drawn.
        Json.num(Field.config(field, "sliderConfig", "min")) || 0.0

      "happiness_rating" ->
        # 0 is a real answer (😞): an unanswered rating stays unset.
        nil

      "date_range" ->
        %{"start" => "", "end" => ""}

      "time_picker" ->
        case Field.time_mode(field) do
          "time_block" -> %{"start" => "", "end" => ""}
          "appointment" -> %{"date" => "", "time" => ""}
          _ -> ""
        end

      "collection_select" ->
        if Field.multi?(field), do: [], else: text_default(field)

      _ ->
        text_default(field)
    end
  end

  defp text_default(field) do
    default = Field.default_value(field)
    if is_binary(default), do: default, else: ""
  end

  @doc """
  The wire payload: values under each field's published key, repeaters
  remapped entry by entry, names normalized. Hidden references never travel
  (the server would reject them as unknown keys).
  """
  def to_submission_payload(fields, data), do: remap(fields, data, fields_by_id(fields))

  defp remap(scope_fields, scope_data, all) do
    by_id = flatten_value_fields(scope_fields)

    Enum.reduce(scope_data, %{}, fn {id, input}, out ->
      id = to_string(id)
      known = Map.get(all, id)

      cond do
        known != nil and known.type in @layout_only ->
          out

        Map.get(by_id, id) == nil ->
          Map.put(out, id, input)

        true ->
          field = Map.fetch!(by_id, id)

          value =
            cond do
              field.type == "multi_populator" and is_list(input) ->
                Enum.map(input, fn inst ->
                  if Json.object?(inst), do: remap(field.children || [], inst, all), else: inst
                end)

              field.type == "name" and Json.object?(input) ->
                normalize_name_value(input)

              true ->
                input
            end

          Map.put(out, Field.key(field) || id, value)
      end
    end)
  end

  defp flatten_value_fields(fields) do
    Enum.reduce(fields, %{}, fn f, out ->
      if f.type == "multi_populator" do
        Map.put(out, f.id, f)
      else
        out = if f.type not in @static_or_layout or f.type == "stepper", do: Map.put(out, f.id, f), else: out
        if f.children != nil, do: Map.merge(out, flatten_value_fields(f.children)), else: out
      end
    end)
  end

  # ── Whole-tree value validation ───────────────────────────────────────────

  @doc """
  Every visible, answered field whose value doesn't fit, walked like the
  required walk (each repeater entry field by field, so the error lands on the
  entry's own field). `[%{id:, label:, path:, reason:}]`
  """
  def find_invalid_values(fields, data, resolve_match \\ nil) do
    derived = with_derived_field_values(fields, derive_reference_values(fields, data))
    fields |> walk_values(derived, "", resolve_match, []) |> Enum.reverse()
  end

  defp walk_values(nodes, scope, prefix, resolve_match, acc) do
    resolve = resolver(scope, resolve_match)

    Enum.reduce(nodes, acc, fn f, acc ->
      case f.type do
        t when t in ["condition_block", "input_group", "flex_row", "or_condition"] ->
          visible = if t == "condition_block", do: eval_condition(Field.rule(f), resolve), else: node_visible?(f, resolve)
          if visible, do: walk_values(f.children || [], scope, prefix, resolve_match, acc), else: acc

        "multi_populator" ->
          instances = Json.list(Map.get(scope, f.id)) || []
          max = min(Kernel.trunc(Json.num(Field.config(f, "populatorConfig", "maxInstances")) || 10.0), @max_array_len)

          acc =
            if length(instances) > max,
              do: [%{id: f.id, label: f.label, path: prefix <> f.id, reason: "max"} | acc],
              else: acc

          instances
          |> Enum.with_index()
          |> Enum.reduce(acc, fn {instance, index}, acc ->
            if Json.object?(instance),
              do: walk_values(f.children || [], instance, "#{prefix}#{f.id}[#{index}].", resolve_match, acc),
              else: acc
          end)

        t ->
          value = Map.get(scope, f.id)

          cond do
            t in @layout_only or t == "calculation" -> acc
            pending_upload?(value) -> acc
            reason = validate_value(f, value) || client_only_rule(f, value) ->
              [%{id: f.id, label: f.label, path: prefix <> f.id, reason: reason} | acc]

            true -> acc
          end
      end
    end)
  end

  @doc "Checks the server doesn't make but a visitor should hear about: a range ending before it starts."
  def client_only_rule(field, value) do
    time_block = field.type == "time_picker" and Field.config(field, "timeConfig", "mode") == "time_block"
    s = Json.str(Json.get(value, "start"))
    e = Json.str(Json.get(value, "end"))

    cond do
      field.type != "date_range" and not time_block -> nil
      s in [nil, ""] or e in [nil, ""] -> nil
      time_block -> if e <= s, do: "range_order"
      e < s -> "range_order"
      e == s and Field.config(field, "dateRangeConfig", "allowSameDay") == false -> "range_same_day"
      true -> nil
    end
  end

  # ── Uploads ───────────────────────────────────────────────────────────────

  @doc """
  A picked file waiting for submit: a placeholder in the value tree, so
  required checks and file counts see it, swapped for the stored file on submit.
  """
  def pending_upload?(value), do: Json.get(value, "pending") == true and is_binary(Json.get(value, "localId"))

  @doc "The author's allowed types, plus the formats phones produce for them (HEIC, QuickTime)."
  def expand_allowed_types(allowed) do
    image = Enum.any?(allowed, &(&1 == "image/*" or (String.starts_with?(&1, "image/") and not String.contains?(&1, "heic"))))
    video = Enum.any?(allowed, &(&1 == "video/*" or String.starts_with?(&1, "video/")))

    extra =
      if(image, do: ["image/heic", "image/heif", ".heic", ".heif"], else: []) ++
        if(video, do: ["video/quicktime", ".mov"], else: [])

    Enum.reduce(extra, allowed, fn t, out -> if t in out, do: out, else: out ++ [t] end)
  end

  def file_type_allowed?(_name, _mime_type, allowed) when allowed in [nil, []], do: true

  def file_type_allowed?(name, mime_type, allowed) do
    type = String.downcase(mime_type, :ascii)

    ext =
      case :binary.matches(name, ".") do
        [] -> ""
        matches -> {at, _} = List.last(matches); name |> binary_part(at, byte_size(name) - at) |> String.downcase(:ascii)
      end

    allowed
    |> expand_allowed_types()
    |> Enum.any?(fn raw ->
      a = raw |> String.downcase(:ascii) |> String.trim()

      cond do
        a == "" -> false
        String.starts_with?(a, ".") -> ext == a
        String.ends_with?(a, "/*") -> String.starts_with?(type, String.trim_trailing(a, "*"))
        true -> type != "" and type == a
      end
    end)
  end

  @doc "Why a picked file is refused, or nil. Same wording as the web renderer."
  def file_problem(name, mime_type, size, allowed, max_mb) do
    cond do
      not file_type_allowed?(name, mime_type, allowed) ->
        "File type not allowed: " <> if(mime_type == "", do: name, else: mime_type)

      max_mb != nil and max_mb > 0 and size > max_mb * 1024 * 1024 ->
        "\"#{name}\" exceeds the #{Js.number_string(max_mb)} MB limit."

      true ->
        nil
    end
  end

  # ── Display helpers ───────────────────────────────────────────────────────

  @doc "Long option lists get a search box (a combobox); short ones a plain select."
  def searchable_threshold, do: 10

  def should_search?(option_count, display), do: display == "combobox" or option_count > 10

  @doc "\"5551234567\" → \"(555) 123-4567\"; international numbers in groups of three after a \"+\"."
  def format_phone(input, international) do
    digits = Regex.replace(~r/[^0-9]/, input, "")

    if international do
      plus = if input |> String.trim_leading(" ") |> String.starts_with?("+"), do: "+", else: ""
      groups = digits |> String.slice(0, 15) |> chunks(3) |> Enum.join(" ")
      String.trim(plus <> groups, " ")
    else
      n = byte_size(digits)

      cond do
        n <= 3 -> digits
        n <= 6 -> "(#{binary_part(digits, 0, 3)}) #{binary_part(digits, 3, n - 3)}"
        true -> "(#{binary_part(digits, 0, 3)}) #{binary_part(digits, 3, 3)}-#{String.slice(digits, 6, 4)}"
      end
    end
  end

  defp chunks("", _), do: []
  defp chunks(s, n) when byte_size(s) <= n, do: [s]
  defp chunks(s, n), do: [binary_part(s, 0, n) | chunks(binary_part(s, n, byte_size(s) - n), n)]

  @doc "A table cell in a `check` column: \"yes\" (✓), \"no\" (–), or \"text\" (its own text)."
  def table_check_state(cell) do
    v = cell |> String.trim(" ") |> Js.lower()

    cond do
      v in ["yes", "y", "true", "1", "x", "✓", "✔", "check"] -> "yes"
      v in ["no", "n", "false", "0", "-", "–", "—", ""] -> "no"
      true -> "text"
    end
  end

  @doc "Only http(s) links leave the form."
  def safe_http_url(raw) do
    url = String.trim(to_string(raw || ""), " ")

    case url != "" and URI.parse(url).scheme do
      scheme when is_binary(scheme) -> if String.downcase(scheme) in ["http", "https"], do: url
      _ -> nil
    end
  end

  # ── Autofill ──────────────────────────────────────────────────────────────

  @autofill [
    {"first[\\s_-]?name|given[\\s_-]?name", "given-name"},
    {"last[\\s_-]?name|family[\\s_-]?name|surname", "family-name"},
    {"full[\\s_-]?name|your[\\s_-]?name|^name$|contact[\\s_-]?name", "name"},
    {"company|organi[sz]ation|business[\\s_-]?name|employer", "organization"},
    {"job[\\s_-]?title|position|occupation", "organization-title"},
    {"web[\\s_-]?site|homepage|\\burl\\b", "url"},
    {"address[\\s_-]?line[\\s_-]?2|apartment|\\bapt\\b|\\bsuite\\b|\\bunit\\b", "address-line2"},
    {"street|address[\\s_-]?line[\\s_-]?1|^address1?$|street[\\s_-]?address", "street-address"},
    {"\\bcity\\b|\\btown\\b", "address-level2"},
    {"\\bstate\\b|province|region", "address-level1"},
    {"\\bzip\\b|postal|post[\\s_-]?code", "postal-code"},
    {"\\bcountry\\b", "country-name"},
    {"birth|\\bdob\\b", "bday"},
    {"work[\\s_-]?phone|office[\\s_-]?phone|company[\\s_-]?phone|mobile|cell", "tel"}
  ]

  @doc "The autofill token a field advertises: the author's, else one read from its type, key and label."
  def autocomplete_token(field) do
    own = Field.str(field, "autocomplete")

    cond do
      own not in [nil, ""] ->
        own

      Map.has_key?(%{"email" => 1, "phone" => 1, "url" => 1}, field.type) ->
        %{"email" => "email", "phone" => "tel", "url" => "url"}[field.type]

      true ->
        haystack = (Field.key(field) || "") <> " " <> field.label
        Enum.find_value(@autofill, fn {pattern, token} -> if Regex.match?(Re.get(pattern, "i"), haystack), do: token end)
    end
  end
end
