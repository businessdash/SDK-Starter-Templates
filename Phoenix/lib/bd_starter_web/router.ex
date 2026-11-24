defmodule BdStarterWeb.Router do
  use BdStarterWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {BdStarterWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  # A server-to-server call authenticated by HMAC over the raw body. There is
  # no session and no CSRF token to present, so it deliberately skips :browser.
  pipeline :webhook do
    plug :accepts, ["json"]
  end

  scope "/", BdStarterWeb do
    pipe_through :browser

    # ── Pages ──────────────────────────────────────────────────────────────
    get "/", PageController, :home
    get "/reviews", PageController, :reviews
    get "/updates", PageController, :updates

    get "/blog", BlogController, :index
    get "/blog/:slug", BlogController, :show

    # Programmatic SEO — one template, N variants, copy owned by the dashboard.
    get "/services", ServiceAreaController, :index
    get "/services/:service/:area", ServiceAreaController, :show

    # ── Store ──────────────────────────────────────────────────────────────
    get "/store", StoreController, :index
    get "/store/:id", StoreController, :show

    get "/cart", CartController, :show
    post "/cart/items", CartController, :add_item
    patch "/cart/items/:item_id", CartController, :update_item
    delete "/cart/items/:item_id", CartController, :remove_item
    post "/cart/coupon", CartController, :apply_coupon
    delete "/cart/coupon", CartController, :remove_coupon
    post "/cart/clear", CartController, :clear
    post "/cart/checkout", CartController, :checkout

    get "/subscriptions", SubscriptionController, :index
    post "/subscriptions/:id/checkout", SubscriptionController, :checkout

    # ── Custom database demo ───────────────────────────────────────────────
    get "/todos", TodosController, :index
    post "/todos", TodosController, :create

    # ── Auth + customer portal ─────────────────────────────────────────────
    get "/api/bd-auth/:action", BdAuthController, :handle
    post "/api/bd-auth/:action", BdAuthController, :handle

    get "/my-account", PortalController, :index
    # The sign-in screen (SignInLive) hands a finished sign-in here to set the cookie.
    post "/my-account/session", PortalController, :sign_in_handoff
    post "/my-account/review", PortalController, :submit_review

    post "/subscribe", PageController, :subscribe

    # ── Forms and quizzes, drawn here by the forms engine (BdStarter.Forms) ─
    # Any form at /forms/:slug (the home page's contact section is one), the
    # practice quiz or the sample at /quiz (BD_QUIZ), any practice quiz at
    # /quiz/:slug, an invitation at /quiz-invite/:token: the link BD's invite
    # emails carry when this site is the quiz's invite domain.
    get "/forms/:slug", FormPageController, :form
    get "/quiz", FormPageController, :quiz
    get "/quiz/:slug", FormPageController, :quiz
    get "/quiz-invite/:token", FormPageController, :invitation

    # ── The LiveView showcase ──────────────────────────────────────────────
    # Front Desk chat. The storefront and SEO pages are dead views on purpose —
    # tying them to a socket buys nothing and costs uptime. Chat is the one
    # surface where a shared server-side poller beats every browser polling
    # for itself. (Forms, quizzes and sign-in are LiveViews embedded in dead
    # pages: they hold a visitor's answers while they work.)
    live "/chat", ChatLive, :index
  end

  # Customer sign-in as JSON, for apps and pages that bring their own screen,
  # and the "Continue with Google / Apple / GitHub / Discord" links the screen
  # on /my-account uses. JSON-only POSTs and no session yet, so not through
  # :browser's CSRF check.
  scope "/api/bd-auth/customer", BdStarterWeb do
    get "/*path", BdCustomerAuthController, :handle
    post "/*path", BdCustomerAuthController, :handle
  end

  scope "/", BdStarterWeb do
    pipe_through :webhook
    post "/api/bd/revalidate", WebhookController, :handle
  end

  # ── SEO / AEO ────────────────────────────────────────────────────────────
  # Served from THIS domain: a sitemap on businessdash.us says nothing about your
  # site, and /llms.txt is the only path answer engines look at.
  scope "/", BdStarterWeb do
    get "/sitemap.xml", SeoController, :sitemap
    get "/robots.txt", SeoController, :robots
    get "/llms.txt", SeoController, :llms_txt
  end
end
