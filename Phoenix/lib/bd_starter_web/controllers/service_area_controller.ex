defmodule BdStarterWeb.ServiceAreaController do
  use BdStarterWeb, :controller

  alias BdStarter.Bd

  def index(conn, _params), do: render(conn, :index, variants: Bd.service_area_variants())

  def show(conn, %{"service" => service, "area" => area}) do
    case Bd.service_area(service, area) do
      nil -> conn |> put_status(:not_found) |> text("Page not found")
      page -> render(conn, :show, page: page, service: service, area: area)
    end
  end
end
