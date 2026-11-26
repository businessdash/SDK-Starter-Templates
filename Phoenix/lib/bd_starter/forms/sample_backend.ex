defmodule BdStarter.Forms.SampleBackend do
  @moduledoc """
  The bundled sample form (priv/forms/demo-form.json), shown before BD is
  connected: everything is checked here and nothing is sent.
  """
  @behaviour BdStarter.Forms.Backend

  alias BdStarter.Forms.{Json, Schema, SubmitResult}

  defstruct []

  @doc "The sample's slug: `/forms/demo`, and the contact section until BD is connected."
  def slug, do: "demo"

  @impl true
  def schema(_b, _form) do
    schema =
      :bd_starter
      |> Application.app_dir("priv/forms/demo-form.json")
      |> File.read!()
      |> Json.decode!()
      |> Schema.from_json()

    %{
      schema
      | slug: slug(),
        description:
          "A sample form bundled with the starter, checked here and never sent. " <>
            "Set BD_CONTACT_FORM and your BD keys to show one of your own."
    }
  end

  @impl true
  def submit(_b, _form, _submission), do: SubmitResult.success(200, nil, true)

  @impl true
  def upload(_b, _form, _field_id, file) do
    %{
      "storageId" => "demo-" <> Ecto.UUID.generate(),
      "url" => "",
      "name" => file.name,
      "mimeType" => file.mime_type,
      "size" => file.size * 1.0
    }
  end

  @impl true
  def collection_options(_b, _form, _field_id), do: []
end
