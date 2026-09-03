defmodule BdStarter.Bd.Resources.Forms do
  @moduledoc """
  Org-defined forms — schema in, submission out.

  `submit/4` is also the documented CREATE path for a custom collection: point
  a form's output at the collection and POST here. There is deliberately no
  direct row-insert API for consumers, which keeps validation on the platform.
  """

  alias BdStarter.Bd.Client

  def schema(client, slug), do: Client.get(client, "forms/#{enc(slug)}")

  def submit(client, slug, data, opts \\ []) do
    body =
      %{data: data}
      |> put_if(:submitterEmail, opts[:submitter_email])
      |> put_if(:submitterName, opts[:submitter_name])
      |> put_if(:source, opts[:source])
      |> put_if(:referrer, opts[:referrer])
      |> put_if(:dryRun, opts[:dry_run])

    Client.post(client, "forms/#{enc(slug)}", body)
  end

  defp put_if(map, _key, nil), do: map
  defp put_if(map, key, value), do: Map.put(map, key, value)
  defp enc(v), do: URI.encode(to_string(v), &URI.char_unreserved?/1)
end
