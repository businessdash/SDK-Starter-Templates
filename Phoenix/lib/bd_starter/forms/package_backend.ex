defmodule BdStarter.Forms.PackageBackend do
  @moduledoc """
  BD's Package API (`/api/package/v1/forms/…`) with this server's secret key.
  The key stays here: the browser only ever talks to this app.
  """
  @behaviour BdStarter.Forms.Backend

  alias BdStarter.Bd.Cache
  alias BdStarter.Forms.{FormsError, Json, PickedFile, Schema, SubmitResult}

  defstruct [:endpoint, :api_key, :origin]

  @doc "From config, or nil until BD_API_KEY and BD_SITE_ID are set."
  def from_config do
    host = Application.get_env(:bd_starter, :bd_host)
    key = Application.get_env(:bd_starter, :bd_api_key)

    if host not in [nil, ""] and key not in [nil, ""] and
         Application.get_env(:bd_starter, :bd_site_id) not in [nil, ""] do
      %__MODULE__{
        endpoint: String.trim_trailing(host, "/") <> "/api/package/v1",
        api_key: key,
        origin: String.trim_trailing(Application.get_env(:bd_starter, :bd_site_origin) || "", "/")
      }
    end
  end

  # `…/forms/<slug>[/<suffix>]`: the slug is one segment, even with a "/" in it.
  defp url(b, form, suffix \\ ""),
    do:
      b.endpoint <>
        "/forms/" <>
        URI.encode(form, &URI.char_unreserved?/1) <> if(suffix == "", do: "", else: "/" <> suffix)

  defp request(b, method, url, opts \\ []) do
    [
      method: method,
      url: url,
      auth: {:bearer, b.api_key},
      headers: [
        {"accept", "application/json"},
        # Server-to-server calls carry no browser Origin, but the platform
        # gates on it. Send the site's real public origin.
        {"origin", b.origin},
        {"x-bd-client", BdStarter.Bd.Client.client_header()}
      ],
      receive_timeout: 15_000,
      retry: false,
      decode_body: false
    ]
    |> Keyword.merge(opts)
    |> Req.request()
  end

  # A JSON body, encoded the way JavaScript would (5.0 is 5).
  defp post(b, url, body),
    do: request(b, :post, url, body: Json.encode!(body), headers: json_headers(b))

  defp json_headers(b),
    do: [
      {"accept", "application/json"},
      {"origin", b.origin},
      {"x-bd-client", BdStarter.Bd.Client.client_header()},
      {"content-type", "application/json"}
    ]

  defp decode(body) do
    Json.decode!(body)
  rescue
    _ -> nil
  end

  # The decoded body of a 2xx response; otherwise BD's message as an error.
  defp json!({:ok, %Req.Response{status: status, body: body}}) when status in 200..299,
    do: decode(body)

  defp json!({:ok, %Req.Response{status: status, body: body}}) do
    message = Json.str(Json.get(decode(body), "message"))
    raise FormsError, message: message || "BD returned #{status}.", status: status
  end

  defp json!({:error, _}), do: raise(FormsError, message: "Could not reach BD.")

  @impl true
  def schema(b, form) do
    # A minute's cache: a busy page doesn't fetch the form on every visit.
    fetched =
      Cache.remember("forms:schema:" <> form, ["bd:forms"], 60, fn ->
        case request(b, :get, url(b, form)) do
          {:ok, %Req.Response{status: s}} = ok when s in 200..299 -> {:ok, json!(ok)}
          {:ok, _} = failed -> {:error, failed}
          {:error, _} -> {:error, :unreachable}
        end
      end)

    case fetched do
      {:ok, json} -> Schema.from_json(json)
      {:error, :unreachable} -> raise FormsError, message: "Could not reach BD to load this form."
      {:error, failed} -> json!(failed)
    end
  end

  @impl true
  def submit(b, form, submission) do
    case post(b, url(b, form), BdStarter.Forms.Submission.body(submission)) do
      {:ok, %Req.Response{status: status, body: body}} when status in 200..299 ->
        json = decode(body)

        SubmitResult.success(
          status,
          Json.str(Json.get(json, "submissionId")),
          Json.get(json, "dryRun") == true
        )

      {:ok, %Req.Response{status: status, body: body}} ->
        SubmitResult.from_response(status, decode(body))

      {:error, e} ->
        SubmitResult.failure(0, "network_error", "Could not reach BD: " <> Exception.message(e))
    end
  end

  @impl true
  def upload(b, form, field_id, %PickedFile{} = file) do
    presign =
      json!(
        post(b, url(b, form, "upload-url"), %{
          "fieldId" => field_id,
          "filename" => file.name,
          "contentType" => file.mime_type,
          "sizeBytes" => file.size * 1.0
        })
      )

    target = Json.str(Json.get(presign, "uploadUrl"))
    storage_id = Json.str(Json.get(presign, "storageId"))

    if target == nil or storage_id == nil or URI.parse(target).scheme not in ["http", "https"],
      do: raise(FormsError, message: "BD returned an invalid upload URL.")

    case Req.request(
           method: :put,
           url: target,
           body: PickedFile.data(file),
           headers: [{"content-type", file.mime_type}],
           receive_timeout: 60_000,
           retry: false
         ) do
      {:ok, %Req.Response{status: s}} when s in 200..299 ->
        %{
          "storageId" => storage_id,
          "url" => Json.str(Json.get(presign, "publicUrl")) || "",
          "name" => file.name,
          "mimeType" => file.mime_type,
          "size" => file.size * 1.0
        }

      {:ok, %Req.Response{status: s}} ->
        raise FormsError, message: "Uploading #{file.name} failed (#{s}).", status: s

      {:error, _} ->
        raise FormsError, message: "Couldn't upload #{file.name}."
    end
  end

  @impl true
  def collection_options(b, form, field_id) do
    # A minute's cache, as for the schema.
    fetched =
      Cache.remember("forms:options:" <> form <> "\n" <> field_id, ["bd:forms"], 60, fn ->
        case request(b, :get, url(b, form, "collection-options"), params: [fieldId: field_id]) do
          {:ok, %Req.Response{status: s}} = ok when s in 200..299 -> {:ok, json!(ok)}
          {:ok, _} = failed -> {:error, failed}
          {:error, _} -> {:error, :unreachable}
        end
      end)

    json =
      case fetched do
        {:ok, json} -> json
        {:error, :unreachable} -> raise FormsError, message: "Couldn't load the options."
        {:error, failed} -> json!(failed)
      end

    for raw <- Json.list(Json.get(json, "options")) || [],
        value = Json.str(Json.get(raw, "value")),
        label = Json.str(Json.get(raw, "label")),
        value != nil and label != nil do
      match = Json.obj(Json.get(raw, "match"))

      %{
        value: value,
        label: label,
        image: Json.str(Json.get(raw, "image")),
        match: if(match, do: match |> Enum.filter(fn {_, v} -> is_binary(v) end) |> Map.new())
      }
    end
  end
end
