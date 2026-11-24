defmodule BdStarter.Forms.Schema do
  @moduledoc """
  A Live form as BD publishes it (`GET /api/package/v1/forms/{slug}`): the
  whole builder tree, not a flat field list — layout containers, condition
  blocks, either/or branches, repeaters and each field's own configuration.
  """

  alias BdStarter.Forms.{Field, Json}

  defstruct id: "",
            slug: "",
            title: nil,
            description: nil,
            fields: [],
            settings: %{},
            org_icon: nil,
            business_functions: []

  # A business function: {id, slug, inputs: [{key, type, …}], outputs: [{key, type, formula, …}]}.
  @function %{
    "id" => "s!",
    "slug" => "s!",
    "inputs" => {:list, %{"key" => "s!", "label" => "s", "type" => "s!", "required" => "b"}},
    "outputs" => {:list, %{"key" => "s!", "label" => "s", "type" => "s!", "formula" => "s!"}}
  }

  def function_spec, do: @function

  def from_json(json) do
    o = Json.obj(json) || %{}
    functions = o["businessFunctions"]

    %__MODULE__{
      id: Json.str(o["id"]) || "",
      slug: Json.str(o["slug"]) || "",
      # BD publishes `name`; older payloads used `title`.
      title: Json.str(o["name"]) || Json.str(o["title"]),
      description: Json.str(o["description"]),
      fields: Field.list(o["fields"]),
      settings: Json.obj(o["settings"]) || %{},
      org_icon: Json.str(o["orgIcon"]),
      business_functions: if(Field.fits?(functions, {:list, @function}), do: functions, else: [])
    }
  end

  @doc "A form setting that's a bool (`isConsecutive`, `showProgress`), else nil."
  def flag(%__MODULE__{settings: s}, name), do: Json.bool(s[name])

  def setting(%__MODULE__{settings: s}, name), do: Json.str(s[name])
end
