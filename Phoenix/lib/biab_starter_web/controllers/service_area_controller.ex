defmodule BiabStarterWeb.ServiceAreaController do
  use BiabStarterWeb, :controller

  alias BiabStarter.Biab

  def index(conn, _params), do: render(conn, :index, variants: Biab.service_area_variants())

  def show(conn, %{"service" => service, "area" => area}) do
    case Biab.service_area(service, area) do
      nil -> conn |> put_status(:not_found) |> text("Page not found")
      page -> render(conn, :show, page: page, service: service, area: area)
    end
  end
end
