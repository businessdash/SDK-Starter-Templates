defmodule BdStarterWeb.WebhookController do
  use BdStarterWeb, :controller

  alias BdStarter.Bd
  alias BdStarter.Bd.Webhook

  @doc """
  `POST /api/bd/revalidate` — BD says content changed, the site drops
  exactly the named cache tags. No polling, and edits go live immediately.

  `conn.assigns.raw_body` is stashed by `Plugs.CacheBodyReader`; the parsed
  params are useless here because re-encoding them changes the bytes the HMAC
  was computed over.
  """
  def handle(conn, _params) do
    raw = Map.get(conn.assigns, :raw_body, "")

    case Webhook.verify(raw, get_req_header(conn, "x-bd-signature") |> List.first()) do
      {:ok, payload} ->
        tags = Webhook.tags(payload)
        Bd.purge(tags)
        json(conn, %{ok: true, purged: length(tags)})

      {:error, reason} ->
        # 400, not 500 — a bad signature is the caller's problem, and a 5xx
        # would make BD retry a request that can never succeed.
        conn |> put_status(:bad_request) |> json(%{error: to_string(reason)})
    end
  end
end
