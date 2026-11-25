defmodule BdStarterWeb.ReviewComponents do
  @moduledoc """
  The business reviews' parts, one function component each: the rating
  summary with "Write a review", the platform filter and a card per review.
  The rules are `BdStarter.Reviews`.
  """
  use Phoenix.Component

  use Phoenix.VerifiedRoutes,
    endpoint: BdStarterWeb.Endpoint,
    router: BdStarterWeb.Router,
    statics: BdStarterWeb.static_paths()

  import BdStarterWeb.ShopComponents, only: [element_data: 1]

  alias BdStarter.Reviews

  @doc """
  The average with its stars and the number of reviews, a bar per star, and
  "Write a review" (`<bd-review-writer>`, priv/static/shop/reviews-elements.js,
  which posts to /reviews/write; signed out, it's a link to sign in). Before
  there are any reviews, just the writer.
  """
  attr :summary, :map, required: true
  attr :signed_in, :boolean, default: false

  def rating_summary(assigns) do
    ~H"""
    <section class="reviews-summary" aria-label={if @summary.average, do: "Rating", else: "Write a review"}>
      <%= if @summary.average do %>
        <div class="reviews-summary__score">
          <span class="reviews-summary__average">{average(@summary)}</span>
          <span class="review-stars" role="img" aria-label={"#{average(@summary)} out of 5"}>
            {Reviews.stars(@summary.average)}
          </span>
          <span class="reviews-summary__count">
            {@summary.total} {if @summary.total == 1, do: "review", else: "reviews"}
          </span>
        </div>
        <ul class="reviews-bars">
          <li :for={row <- @summary.histogram} aria-label={"#{row.stars} stars: #{row.count}"}>
            <span>{row.stars} ★</span>
            <span class="reviews-bars__track"><span class="reviews-bars__fill" style={"width: #{round(row.share * 100)}%"}></span></span>
            <span>{row.count}</span>
          </li>
        </ul>
      <% end %>
      <div class="reviews-summary__write">
        <bd-review-writer data-write-url={~p"/reviews/write"} data-sign-in-href="/my-account?next=%2Freviews">
          <.element_data value={%{signedIn: @signed_in}} />
        </bd-review-writer>
      </div>
    </section>
    """
  end

  @doc "All, then a link per platform (Google, Yelp…), when reviews come from more than one."
  attr :sources, :list, default: []
  attr :source, :string, default: nil

  def review_filter(assigns) do
    ~H"""
    <nav :if={length(@sources) > 1} aria-label="Platform">
      <ul class="reviews-filter">
        <li><a href={~p"/reviews"} aria-current={to_string(is_nil(@source))}>All</a></li>
        <li :for={s <- @sources}>
          <a href={~p"/reviews?#{[source: s]}"} aria-current={to_string(@source == s)}>
            {Reviews.source_label(s)}
          </a>
        </li>
      </ul>
    </nav>
    """
  end

  @doc "One review: photo or initial, name, stars, date, text, photos, and where it came from."
  attr :review, :map, required: true
  attr :index, :integer, default: 0

  def review_card(assigns) do
    review = assigns.review

    assigns =
      assign(assigns,
        avatar: Reviews.web_url(review["reviewerImageUrl"]),
        platform: Reviews.platform_name(review["source"]),
        link: Reviews.link(review),
        pictures: review["photos"] |> List.wrap() |> Enum.map(&Reviews.web_url/1) |> Enum.reject(&is_nil/1)
      )

    ~H"""
    <li class="review-card" id={"review-#{@index}"}>
      <div class="review-card__head">
        <img :if={@avatar} class="review-card__avatar" src={@avatar} alt="" loading="lazy" />
        <span :if={!@avatar} class="review-card__avatar" aria-hidden="true">{Reviews.initial(@review)}</span>
        <div>
          <p class="review-card__name">{Reviews.reviewer_name(@review)}</p>
          <p class="review-card__meta">
            <span class="review-stars" role="img" aria-label={"#{@review["rating"] || 0} out of 5"}>
              {Reviews.stars(@review["rating"])}
            </span>
            · {Reviews.date(@review["timeCreated"])}
          </p>
        </div>
      </div>
      <p class="review-card__text">{@review["text"]}</p>
      <ul :if={@pictures != []} class="review-card__photos" aria-label="Photos from the reviewer">
        <li :for={photo <- @pictures}><img src={photo} alt="" loading="lazy" /></li>
      </ul>
      <p :if={@platform || @review["verified"] == true} class="review-card__foot">
        <span :if={@platform} class="review-card__platform">{@platform}</span>
        <span :if={@review["verified"] == true} class="review-card__verified">✓ Verified</span>
        <a :if={@link && @platform} class="review-card__link" href={@link} target="_blank" rel="noopener noreferrer">
          Read on {@platform}
        </a>
      </p>
    </li>
    """
  end

  defp average(%{average: average}), do: :erlang.float_to_binary(average, decimals: 1)
end
