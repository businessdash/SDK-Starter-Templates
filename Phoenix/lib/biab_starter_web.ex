defmodule BiabStarterWeb do
  @moduledoc """
  Entrypoint for the web layer — controllers, HTML views, LiveViews, router.

      use BiabStarterWeb, :controller
      use BiabStarterWeb, :html
  """

  def static_paths, do: ~w(assets fonts images favicon.ico)

  def router do
    quote do
      use Phoenix.Router, helpers: false

      import Plug.Conn
      import Phoenix.Controller
      import Phoenix.LiveView.Router
    end
  end

  def controller do
    quote do
      use Phoenix.Controller, formats: [:html, :json], layouts: [html: BiabStarterWeb.Layouts]

      import Plug.Conn

      unquote(verified_routes())
    end
  end

  def html do
    quote do
      use Phoenix.Component

      import Phoenix.Controller, only: [get_csrf_token: 0]

      unquote(html_helpers())
    end
  end

  def live_view do
    quote do
      use Phoenix.LiveView, layout: {BiabStarterWeb.Layouts, :app}

      unquote(html_helpers())
    end
  end

  defp html_helpers do
    quote do
      use Phoenix.HTML

      import BiabStarterWeb.Bundle
      import BiabStarterWeb.Money

      alias Phoenix.LiveView.JS

      unquote(verified_routes())
    end
  end

  def verified_routes do
    quote do
      use Phoenix.VerifiedRoutes,
        endpoint: BiabStarterWeb.Endpoint,
        router: BiabStarterWeb.Router,
        statics: BiabStarterWeb.static_paths()
    end
  end

  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
