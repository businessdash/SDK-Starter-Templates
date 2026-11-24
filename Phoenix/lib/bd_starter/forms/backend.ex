defmodule BdStarter.Forms.FormsError do
  @moduledoc "A form couldn't load, or a file couldn't upload: the message is for the visitor."
  defexception message: "Something went wrong.", status: 0
end

defmodule BdStarter.Forms.PickedFile do
  @moduledoc """
  A file a visitor picked. It waits (copied out of LiveView's upload into a
  temporary file) until Submit uploads it, so an abandoned form never leaves a
  file on BD.
  """
  defstruct [:name, :mime_type, :size, :path]

  def data(%__MODULE__{path: path}), do: File.read!(path)

  @doc "Drop the waiting copy."
  def discard(%__MODULE__{path: path}), do: File.rm(path)
end

defmodule BdStarter.Forms.Submission do
  @moduledoc "A form submission as the Package API takes it."
  defstruct [:data, :submitter_email, :submitter_name, :dry_run, :source, :referrer, :metadata]

  @doc "The request body: unset members left out."
  def body(%__MODULE__{} = s) do
    [
      {"submitterEmail", s.submitter_email},
      {"submitterName", s.submitter_name},
      {"dryRun", s.dry_run},
      {"source", s.source},
      {"referrer", s.referrer},
      {"metadata", s.metadata}
    ]
    |> Enum.reject(fn {_, v} -> v == nil end)
    |> Map.new()
    |> Map.put("data", s.data)
  end
end

defmodule BdStarter.Forms.SubmitOptions do
  @moduledoc "Sent with every submit."
  defstruct submitter_email: nil,
            submitter_name: nil,
            dry_run: false,
            # Where the submission came from.
            source: "phoenix-starter",
            referrer: nil,
            metadata: nil
end

defmodule BdStarter.Forms.Backend do
  @moduledoc """
  Where a form loads from and submits to: BD's Package API with this server's
  secret key (`PackageBackend`), or the bundled sample's stand-in
  (`SampleBackend`). A backend is a struct; these dispatch on its module.
  """

  @doc "Raises `FormsError`."
  @callback schema(struct(), String.t()) :: struct()

  @doc "Never raises: every outcome, a network failure included, is a result."
  @callback submit(struct(), String.t(), struct()) :: struct()

  @doc "Store a picked file: `%{\"storageId\", \"url\", \"name\", \"mimeType\", \"size\"}`. Raises `FormsError`."
  @callback upload(struct(), String.t(), String.t(), struct()) :: map()

  @doc "The options a `collection_select` offers: `[%{value:, label:, image:, match:}]`. Raises `FormsError`."
  @callback collection_options(struct(), String.t(), String.t()) :: [map()]

  def schema(backend, form), do: backend.__struct__.schema(backend, form)
  def submit(backend, form, submission), do: backend.__struct__.submit(backend, form, submission)
  def upload(backend, form, field_id, file), do: backend.__struct__.upload(backend, form, field_id, file)
  def collection_options(backend, form, field_id), do: backend.__struct__.collection_options(backend, form, field_id)
end
