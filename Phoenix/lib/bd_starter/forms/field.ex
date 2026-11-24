defmodule BdStarter.Forms.Field do
  @moduledoc """
  One node of a form: an input, a static block, or a container.

  Read as BD publishes it and as leniently as the other ports read it: a
  member of the wrong type reads as absent, and a config with a mistyped
  member reads as absent as a whole, so one malformed element falls back to
  its defaults instead of taking the form down. `type` stays a string, so a
  form can use an element this code has never heard of (it renders as a text
  box and keeps its value).
  """

  alias BdStarter.Forms.Json

  defstruct [:id, :type, :label, :required, :children, :raw, configs: %{}]

  @display %{"show" => "b", "prefix" => "s", "suffix" => "s", "decimals" => "i"}

  @calculation %{
    "mode" => "s",
    "formula" => "s",
    "functionId" => "s",
    "outputKey" => "s",
    "inputMap" => {:list, %{"variable" => "s!", "fieldId" => "s!"}},
    "display" => @display,
    "sensitive" => "b"
  }

  # What each config holds: "s" string, "n" number, "i" whole number, "b"
  # bool, "s*" list of strings, a map for an object, {:list, map} for a list
  # of objects. "!" marks a member that must be there.
  @specs %{
    "conditionRule" => %{
      "fieldId" => "s",
      "operator" => "s",
      "value" => "s",
      "match" => "s",
      "matchField" => "s",
      "clauses" => {:list, %{"operator" => "s!", "value" => "s"}}
    },
    "validation" => %{"min" => "n", "max" => "n"},
    "emailConfig" => %{"businessOnly" => "b"},
    "nameConfig" => %{"prefix" => "b", "middle" => "b", "suffix" => "b", "nicknames" => "b"},
    "phoneConfig" => %{"format" => "s", "international" => "b", "showFlags" => "b"},
    "textareaConfig" => %{"rows" => "i", "resizable" => "b"},
    "richTextConfig" => %{"minHeight" => "n"},
    "sliderConfig" => %{"min" => "n", "max" => "n", "step" => "n", "unit" => "s"},
    "imageConfig" => %{"src" => "s", "alt" => "s", "width" => "n", "height" => "n"},
    "fileConfig" => %{"allowedTypes" => "s*", "maxFiles" => "i", "maxSize" => "n"},
    "iconConfig" => %{"set" => "s", "allowedIcons" => "s*", "columns" => "i"},
    "imageInputConfig" => %{"allowedTypes" => "s*", "maxSize" => "n", "showPreview" => "b", "sources" => "s"},
    "flexConfig" => %{"justify" => "s", "align" => "s", "gap" => "n"},
    "starRatingConfig" => %{"maxStars" => "i", "defaultValue" => "n"},
    "dateRangeConfig" => %{"allowSameDay" => "b"},
    "orConditionConfig" => %{"leftLabel" => "s", "rightLabel" => "s"},
    "timeConfig" => %{"mode" => "s", "format" => "s", "stepMinutes" => "i"},
    "choiceConfig" => %{
      "mode" => "s",
      "options" =>
        {:list,
         %{
           "label" => "s!",
           "icon" => "s",
           "imageUrl" => "s",
           "price" => "s",
           "description" => "s",
           "productId" => "s",
           "href" => "s"
         }}
    },
    "populatorConfig" => %{"maxInstances" => "i", "minInstances" => "i", "addButtonLabel" => "s", "itemLabel" => "s"},
    "unitConfig" => %{
      "category" => "s",
      "units" => "s*",
      "mode" => "s",
      "defaultUnit" => "s",
      "outputUnit" => "s",
      "allowDecimal" => "b"
    },
    "currencyConfig" => %{"currency" => "s", "symbol" => "s", "allowNegative" => "b", "allowDecimal" => "b"},
    "calculationConfig" => @calculation,
    "paymentConfig" => %{
      "mode" => "s",
      "amountCents" => "i",
      "currency" => "s",
      "buttonLabel" => "s",
      "description" => "s"
    },
    "serviceConfig" => %{
      "options" => {:list, %{"id" => "s!", "title" => "s!", "estimatedHours" => "n"}},
      "multi" => "b"
    },
    "scheduleConfig" => %{
      "mode" => "s",
      "allowAsap" => "b",
      "days" => "s*",
      "timeWindows" => "s*",
      "granularTimes" => "b",
      "allowNotes" => "b",
      "durationMinutes" => "n"
    },
    "collectionSelectConfig" => %{
      "collectionKey" => "s",
      "labelField" => "s",
      "imageField" => "s",
      "valueMode" => "s",
      "valueField" => "s",
      "multi" => "b"
    },
    "monthYearConfig" => %{"minYear" => "i", "maxYear" => "i"}
  }

  def calculation_spec, do: @calculation
  def display_spec, do: @display

  def new(json) do
    raw = Json.obj(json) || %{}
    kids = raw["children"]

    configs =
      for {name, spec} <- @specs, Map.has_key?(raw, name), into: %{} do
        value = raw[name]
        {name, if(fits?(value, spec), do: value, else: nil)}
      end

    %__MODULE__{
      raw: raw,
      id: Json.str(raw["id"]) || Ecto.UUID.generate(),
      type: Json.str(raw["type"]) || "text",
      label: Json.str(raw["label"]) || "",
      required: raw["required"] == true,
      children:
        if(is_list(kids) and Enum.all?(kids, &Json.object?/1), do: Enum.map(kids, &new/1), else: nil),
      configs: configs
    }
  end

  @doc "A JSON list of elements, objects only."
  def list(json), do: (Json.list(json) || []) |> Enum.filter(&Json.object?/1) |> Enum.map(&new/1)

  # ── Members ───────────────────────────────────────────────────────────────

  def str(%__MODULE__{raw: raw}, key), do: Json.str(raw[key])
  def bool(%__MODULE__{raw: raw}, key), do: Json.bool(raw[key])
  def num(%__MODULE__{raw: raw}, key), do: Json.num(raw[key])

  @doc "The published output key: what the submission sends this value under."
  def key(field), do: str(field, "key")

  @doc "The choices, strings only."
  def options(%__MODULE__{raw: raw}) do
    case raw["options"] do
      list when is_list(list) -> Json.strings(list)
      _ -> nil
    end
  end

  @doc "The author's default, or nil (a JSON null default is none)."
  def default_value(%__MODULE__{raw: raw}), do: raw["defaultValue"]

  def must_be_true?(field), do: bool(field, "mustBeTrue") == true

  @doc "The visibility rule on a condition block or a group."
  def rule(field), do: cfg(field, "conditionRule")

  @doc """
  A config object (`sliderConfig`, `fileConfig`, …), or nil when it's
  missing or any member has the wrong type.
  """
  def cfg(%__MODULE__{configs: configs}, name), do: Map.get(configs, name)

  @doc "One member of a config, or nil."
  def config(field, name, member) do
    case cfg(field, name) do
      nil -> nil
      c -> Map.get(c, member)
    end
  end

  @doc "The choice cards' options."
  def cards(field), do: Json.list(config(field, "choiceConfig", "options")) || []

  @doc "The checkbox group / choice cards / collection take several answers."
  def multi?(%__MODULE__{type: "choice_cards"} = f), do: config(f, "choiceConfig", "mode") == "multi"
  def multi?(%__MODULE__{type: "collection_select"} = f), do: config(f, "collectionSelectConfig", "multi") == true
  def multi?(_), do: false

  def time_mode(field), do: Json.str(config(field, "timeConfig", "mode")) || "simple"

  @doc "Whether a JSON value has the shape a spec describes."
  def fits?(value, {:list, item}), do: is_list(value) and Enum.all?(value, &fits?(&1, item))

  def fits?(value, spec) when is_map(spec) do
    Json.object?(value) and
      Enum.all?(spec, fn {key, member} ->
        required = is_binary(member) and String.ends_with?(member, "!")

        case Map.get(value, key) do
          nil -> not required
          item -> fits?(item, if(required, do: String.trim_trailing(member, "!"), else: member))
        end
      end)
  end

  def fits?(value, "s"), do: is_binary(value)
  def fits?(value, "n"), do: Json.number?(value)
  def fits?(value, "i"), do: (is_float(value) or is_integer(value)) and Float.floor(value * 1.0) == value * 1.0
  def fits?(value, "b"), do: is_boolean(value)
  def fits?(value, "s*"), do: is_list(value) and Enum.all?(value, &is_binary/1)
  def fits?(_, _), do: false
end
