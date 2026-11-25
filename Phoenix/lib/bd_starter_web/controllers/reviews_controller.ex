defmodule BdStarterWeb.ReviewsController do
  @moduledoc """
  The business's reviews: the rating over all of them with a bar per star, a
  platform filter, each review with its photos and a link to it on Google or
  Yelp, more on demand, and writing one.

      GET  /reviews?source=yelp&shown=20   the page; the filter and "Show more" are links
      POST /reviews/write                  JSON from <bd-review-writer> (priv/static/shop/reviews-elements.js)

  The rules are `BdStarter.Reviews`, the same as every BD starter's.
  """
  use BdStarterWeb, :controller

  alias BdStarter.Bd
  alias BdStarter.Bd.Auth
  alias BdStarter.Reviews

  # The most a "Show more" link asks for.
  @most_shown 200

  def index(conn, params) do
    source = Reviews.source_param(params["source"])
    shown = params |> Map.get("shown") |> shown()
    page = Bd.reviews_page(shown, source)
    next = page["nextOffset"]

    render(conn, :index,
      page_title: "Reviews",
      main_class: "bd-page",
      reviews_page: true,
      configured: Bd.configured?(),
      summary: Reviews.summarize(Bd.page_bundle("home")["reviews"], page["totalCount"] || 0),
      # The platforms for the filter, from the newest 50.
      sources: Reviews.sources_in(Bd.review_sources() || page["items"]),
      source: source,
      reviews: page["items"] || [],
      more_href:
        if(is_integer(next) and shown < @most_shown,
          do: more_href(source, shown + Reviews.page_size()),
          else: nil
        ),
      signed_in: not is_nil(session(conn))
    )
  end

  @doc "`%{rating, title?, body}` from <bd-review-writer>, for the signed-in customer."
  def write(conn, params) do
    with :ok <- configured(),
         {:ok, token, session} <- signed_in(conn),
         {:ok, review} <- checked(params) do
      case Bd.portal_review(token, Map.get(session, "organizationId"), review) do
        nil -> reply(conn, 502, %{ok: false, error: "Couldn't send your review. Try again."})
        _ -> reply(conn, 200, %{ok: true})
      end
    else
      {:error, status, message} -> reply(conn, status, %{ok: false, error: message})
    end
  end

  defp configured do
    if Bd.configured?(), do: :ok, else: {:error, 503, "Reviews aren't connected yet."}
  end

  defp signed_in(conn) do
    token = session_token(conn)

    case token && session(conn) do
      %{} = session -> {:ok, token, session}
      _ -> {:error, 401, "Sign in to write a review."}
    end
  end

  defp checked(params) do
    case Reviews.check(params) do
      {:ok, review} -> {:ok, review}
      {:error, message} -> {:error, 400, message}
    end
  end

  defp shown(value) do
    n =
      case Integer.parse(to_string(value || "")) do
        {n, _} -> n
        :error -> Reviews.page_size()
      end

    n = n |> max(Reviews.page_size()) |> min(@most_shown)
    n - rem(n, Reviews.page_size())
  end

  defp more_href(source, shown) do
    query = if source, do: [source: source, shown: shown], else: [shown: shown]
    "/reviews?" <> URI.encode_query(query) <> "#review-#{shown - Reviews.page_size()}"
  end

  defp session(conn) do
    case {Bd.client(), session_token(conn)} do
      {nil, _} -> nil
      {_, nil} -> nil
      {client, token} -> Auth.session(client, token)
    end
  end

  defp session_token(conn) do
    conn = fetch_cookies(conn)

    case conn.cookies[Application.get_env(:bd_starter, :bd_session_cookie, "bd_session")] do
      value when is_binary(value) and value != "" -> value
      _ -> nil
    end
  end

  defp reply(conn, status, body) do
    conn |> put_resp_header("cache-control", "no-store") |> put_status(status) |> json(body)
  end
end
