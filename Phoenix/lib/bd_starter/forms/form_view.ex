defmodule BdStarter.Forms.FormView do
  @moduledoc """
  What the form's HEEx (`BdStarterWeb.FormComponents`) draws with, and the
  two directions between the page's boxes and the engine's values.

  A value's KEY is where it sits in the page's `input`: a field's id, or
  `<repeater key>.<row>.<child id>` inside a repeater. A composite field's
  parts sit under it (`input[<key>][first]`).
  """

  alias BdStarter.Forms.{Field, FieldPath, FormController, Js, Json, Rules, Units}

  @layout_types ~w(input_group condition_block or_condition flex_row)

  # Every type the views draw (anything else is a plain text box).
  @known_types ~w(title subtitle separator richtext body_text image textarea rich_text_input select radio checkbox boolean date email phone number currency stepper slider star_rating happiness_rating color_picker choice_cards date_range time_picker name address url tags measurement calculation collection_select multi_populator file_upload)

  @no_label_types ~w(title subtitle separator richtext body_text image boolean)

  # Fields drawn as one control, which a `<label for>` can name. The rest are groups.
  @single_control_types ~w(text textarea rich_text_input select date email phone number currency stepper slider url tags measurement)

  @unsupported_types ~w(schedule signature payment credit_card icon_picker image_input month_year)

  def faces,
    do: [
      {"😞", "Very unhappy"},
      {"😕", "Unhappy"},
      {"😐", "Neutral"},
      {"🙂", "Happy"},
      {"😄", "Very happy"}
    ]

  def unsupported?(field), do: field.type in @unsupported_types

  @doc "The fields that hold a value, through layout nodes but not into repeaters."
  def value_fields(fields) do
    Enum.flat_map(fields, fn field ->
      cond do
        field.type in @layout_types ->
          value_fields(field.children || [])

        field.type in Rules.static_types() or field.type in ["calculation", "reference_value"] ->
          []

        true ->
          [field]
      end
    end)
  end

  @doc "A box's `name`: `input[a][0][b]`, with a part as `[first]`."
  def input_name(key, part \\ nil) do
    "input" <>
      Enum.map_join(String.split(key, "."), "", &"[#{&1}]") <> if(part, do: "[#{part}]", else: "")
  end

  def dom_id(form_id, key, part \\ nil),
    do:
      Regex.replace(
        ~r/[^\p{L}\p{N}_-]/u,
        "bd-#{form_id}-#{key}" <> if(part, do: "-#{part}", else: ""),
        "-"
      )

  @doc "The upload a file field's picker uses: its path key, hex, so nothing in it splits."
  def upload_name(%FieldPath{} = path),
    do: "k" <> Base.encode16(FieldPath.key(path), case: :lower)

  def single_control?(%Field{type: "time_picker"} = f), do: Field.time_mode(f) == "simple"
  def single_control?(f), do: f.type in @single_control_types or f.type not in @known_types

  def shows_label?(f), do: f.type not in @no_label_types and f.label != ""

  @doc "What the field's wrapper is known by in CSS: its output key, else its id."
  def css_key(field) do
    Enum.find_value(
      [Field.str(field, "outputKey"), Field.str(field, "key")],
      field.id,
      fn explicit ->
        if explicit != nil and Js.trim(explicit) != "", do: Js.trim(explicit)
      end
    )
  end

  @doc "A value as a box shows it."
  def str(v) when is_binary(v), do: v
  def str(v) when is_float(v) or is_integer(v), do: Js.number_string(v)
  def str(_), do: ""

  def part(value, part), do: str(Json.get(value, part))
  def number(n), do: Js.number_string(n)

  # ── The whole form ────────────────────────────────────────────────────────

  def stepped?(c), do: FormController.consecutive?(c) and FormController.step_count(c) > 1

  @doc "The labels of the fields with problems, in form order."
  def summary_labels(c, errors) do
    %{c | errors: errors}
    |> FormController.ordered_error_keys()
    |> Enum.map(fn key ->
      case FormController.field(c, key |> String.split(".") |> List.last()) do
        nil -> ""
        f -> f.label
      end
    end)
    |> Enum.reject(&(&1 == ""))
  end

  def progress_bar?(c), do: Json.str(c.schema.settings["progressStyle"]) == "bar"
  def shows_progress?(c), do: c.schema.settings["showProgress"] == true

  # ── Controls ──────────────────────────────────────────────────────────────

  def autocomplete(field) do
    case Field.str(field, "autocomplete") do
      own when own not in [nil, ""] ->
        own

      _ ->
        %{"email" => "email", "phone" => "tel", "url" => "url"}[field.type] ||
          Rules.autocomplete_token(field)
    end
  end

  def slider(field, value) do
    lo = Json.num(Field.config(field, "sliderConfig", "min")) || 0.0
    unit = Json.str(Field.config(field, "sliderConfig", "unit"))

    %{
      lo: lo,
      hi: Json.num(Field.config(field, "sliderConfig", "max")) || 100.0,
      step: Json.num(Field.config(field, "sliderConfig", "step")) || 1.0,
      current: if(Json.number?(value), do: Js.f(value), else: lo),
      fmt: fn x ->
        case unit do
          "currency" -> "$" <> Js.number_string(x)
          "percent" -> Js.number_string(x) <> "%"
          _ -> Js.number_string(x)
        end
      end
    }
  end

  @doc "`[{value, label}]` for a simple time picker."
  def times(field) do
    h24 = Field.config(field, "timeConfig", "format") == "24h"

    step =
      max(Kernel.trunc(Json.num(Field.config(field, "timeConfig", "stepMinutes")) || 30.0), 1)

    pad = &String.pad_leading(Integer.to_string(&1), 2, "0")

    for hour <- 0..23, minute <- 0..59//step do
      t = "#{pad.(hour)}:#{pad.(minute)}"
      h12 = if rem(hour, 12) == 0, do: 12, else: rem(hour, 12)
      {t, if(h24, do: t, else: "#{h12}:#{pad.(minute)} #{if hour < 12, do: "AM", else: "PM"}")}
    end
  end

  @doc "A name's boxes: `{part, label, autofill token, hint, full width}`."
  def name_parts(field) do
    middle = Field.config(field, "nameConfig", "middle") == true
    suffix = Field.config(field, "nameConfig", "suffix") == true

    [
      if(Field.config(field, "nameConfig", "prefix") == true,
        do: {"prefix", "Title", "honorific-prefix", "Dr.", true}
      ),
      {"first", "First name", "given-name", "Jane", false},
      if(middle, do: {"middle", "Middle name", "additional-name", "Quinn", false}),
      {"last", "Last name", "family-name", "Doe", middle and not suffix},
      if(suffix, do: {"suffix", "Suffix", "honorific-suffix", "Jr.", not middle})
    ]
    |> Enum.reject(&is_nil/1)
  end

  def measurement(field, value) do
    category = Units.category_of(field)
    listed = Json.strings(Field.config(field, "unitConfig", "units"))
    units = if listed != [], do: listed, else: Units.symbols(category)

    unit =
      Json.str(Json.get(value, "unit")) ||
        Json.str(Field.config(field, "unitConfig", "defaultUnit")) || List.first(units) ||
        category.base_unit

    %{
      units: units,
      unit: unit,
      fixed: Field.config(field, "unitConfig", "mode") == "fixed" or length(units) <= 1
    }
  end

  @doc """
  A collection_select's state: `:loading | :error | :empty` (with a message),
  or `:select` / `:list` with the options.
  """
  def collection(c, field) do
    multi = Field.multi?(field)

    case Map.get(c.collection_options, field.id) do
      nil ->
        %{status: "loading", message: "Loading the choices…", options: [], multi: multi}

      {:failed, message} ->
        %{status: "error", message: message, options: [], multi: multi}

      {:loaded, []} ->
        %{status: "empty", message: "Nothing to choose from yet.", options: [], multi: multi}

      {:loaded, options} ->
        searchable = Rules.should_search?(length(options), Field.str(field, "display"))
        images = Enum.any?(options, &(Js.trim(&1.image || "") != ""))

        %{
          status: if(not multi and not searchable and not images, do: "select", else: "list"),
          message: nil,
          options: options,
          multi: multi
        }
    end
  end

  def repeater(field, value) do
    least =
      max(
        Kernel.trunc(Json.num(Field.config(field, "populatorConfig", "minInstances")) || 1.0),
        1
      )

    item = Json.str(Field.config(field, "populatorConfig", "itemLabel")) || "Item"

    %{
      least: least,
      most:
        Kernel.trunc(Json.num(Field.config(field, "populatorConfig", "maxInstances")) || 10.0),
      count: max(length(Json.list(value) || []), least),
      item: item,
      add:
        Json.str(Field.config(field, "populatorConfig", "addButtonLabel")) ||
          "Add " <> Js.lower(item)
    }
  end

  def kilobytes(file), do: max(1, round((Json.num(Json.get(file, "size")) || 0.0) / 1024))

  # ── Boxes → values ────────────────────────────────────────────────────────

  defp num(raw) do
    t = String.trim(if is_binary(raw), do: raw, else: "")

    case Float.parse(t) do
      {n, ""} -> n
      _ -> if t != "" and Regex.match?(~r/^[+-]?\d+$/, t), do: String.to_integer(t) * 1.0
    end
  end

  defp text(raw) when is_binary(raw), do: raw
  defp text(_), do: ""

  # A checkbox list: the hidden "" that keeps an empty list in the params dropped.
  defp texts(raw) when is_list(raw),
    do: raw |> Enum.filter(&is_binary/1) |> Enum.reject(&(&1 == ""))

  defp texts(_), do: []

  @doc "Repeater rows as the params carry them (`%{\"0\" => …}`), in order."
  def rows(raw) when is_map(raw) do
    raw
    |> Enum.flat_map(fn {k, v} ->
      case Integer.parse(k) do
        {i, ""} -> [{i, v}]
        _ -> []
      end
    end)
    |> Enum.sort()
    |> Enum.map(&elem(&1, 1))
  end

  def rows(raw) when is_list(raw), do: raw
  def rows(_), do: []

  @doc """
  One field's value from the boxes: `{:ok, value}`, or `:absent` when the
  page didn't send it (or sent nothing usable). File fields aren't boxes:
  their lists stay as the engine has them.
  """
  def read(%Field{type: "file_upload"}, _in), do: :absent

  def read(f, input) do
    if not Map.has_key?(input, f.id) do
      :absent
    else
      raw = input[f.id]
      part = fn p -> text(if is_map(raw), do: raw[p], else: nil) end
      object = fn parts -> Map.new(parts, &{&1, part.(&1)}) end

      case f.type do
        "checkbox" ->
          {:ok, texts(raw)}

        "boolean" ->
          {:ok, raw in ["true", "on", "1"]}

        t when t in ["number", "currency", "stepper"] ->
          {:ok, num(raw)}

        t when t in ["slider", "star_rating", "happiness_rating"] ->
          case num(raw) do
            nil -> :absent
            n -> {:ok, n}
          end

        t when t in ["choice_cards", "collection_select"] ->
          {:ok, if(Field.multi?(f), do: texts(raw), else: text(raw))}

        "tags" ->
          {:ok,
           text(raw) |> String.split(",") |> Enum.map(&String.trim/1) |> Enum.reject(&(&1 == ""))}

        "url" ->
          {:ok, %{"url" => text(raw)}}

        "measurement" ->
          case num(part.("value")) do
            nil ->
              :absent

            value ->
              category = Units.category_of(f)
              unit = part.("unit")
              o = %{"unit" => unit, "baseUnit" => category.base_unit, "value" => value}

              case Units.to_base(value, unit, category) do
                nil -> {:ok, o}
                base -> {:ok, Map.put(o, "base", base)}
              end
          end

        "name" ->
          {:ok,
           object.(
             Enum.filter(
               ~w(prefix first middle last suffix nicknames),
               &(is_map(raw) and Map.has_key?(raw, &1))
             )
           )}

        "address" ->
          {:ok, object.(~w(line1 line2 city state zip))}

        "date_range" ->
          {:ok, object.(~w(start end))}

        "time_picker" ->
          case Field.time_mode(f) do
            "time_block" -> {:ok, object.(~w(start end))}
            "appointment" -> {:ok, object.(~w(date time))}
            _ -> {:ok, text(raw)}
          end

        "multi_populator" ->
          {:ok, :rows}

        _ ->
          {:ok, text(raw)}
      end
    end
  end

  @doc """
  Apply the page's boxes to the controller: each field whose value changed
  is set, repeater rows field by field (so a row's files stay as they are).
  """
  def apply_input(c, input, fields \\ nil, entries \\ []) do
    fields = fields || value_fields(FormController.fields(c))

    Enum.reduce(fields, c, fn f, c ->
      path = FieldPath.new(f.id, entries)

      case read(f, input) do
        :absent ->
          c

        {:ok, :rows} ->
          input[f.id]
          |> rows()
          |> Enum.with_index()
          |> Enum.reduce(c, fn {row_input, row}, c ->
            apply_input(
              c,
              if(is_map(row_input), do: row_input, else: %{}),
              value_fields(f.children || []),
              FieldPath.entry(path, row)
            )
          end)

        {:ok, value} ->
          if Json.equal?(value, FormController.value(c, path)),
            do: c,
            else: FormController.set_value(c, value, path)
      end
    end)
  end
end
