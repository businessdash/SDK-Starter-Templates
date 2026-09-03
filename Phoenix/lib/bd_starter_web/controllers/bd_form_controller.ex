defmodule BdStarterWeb.BdFormController do
  use BdStarterWeb, :controller

  alias BdStarter.Bd

  @doc """
  Same-origin proxy for the `<bd-form>` web component.

  The component renders the full form schema client-side — conditional blocks,
  availability pickers, file uploads — which a hand-written HEEx fragment
  can't match. It needs to reach the API, but the bearer key must not go to
  the browser. So the browser talks to THIS route, and this route talks to
  BD with the key.

  That is the whole reason a Phoenix consumer never reimplements the form
  renderer.
  """
  def schema(conn, %{"slug" => slug}) do
    case Bd.form_schema(slug) do
      nil -> conn |> put_status(:bad_gateway) |> json(%{error: "form_unavailable"})
      schema -> json(conn, schema)
    end
  end

  def submit(conn, %{"slug" => slug} = params) do
    data = Map.get(params, "data", %{})

    opts = [
      submitter_email: params["submitterEmail"],
      submitter_name: params["submitterName"],
      source: "phoenix-starter",
      referrer: get_req_header(conn, "referer") |> List.first()
    ]

    case Bd.form_submit(slug, data, opts) do
      nil -> conn |> put_status(:bad_gateway) |> json(%{ok: false, reason: "transport_error"})
      result -> json(conn, result)
    end
  end
end
