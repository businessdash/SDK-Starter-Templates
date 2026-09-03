defmodule BdStarterWeb.TodosController do
  use BdStarterWeb, :controller

  alias BdStarter.Bd

  @form_slug "todo-form"

  @doc """
  The relational custom-database demo.

  Read path: `dataModel.listRecords` — relations come back as links, joined
  here server-side. Write path: `forms.submit` against the generated form,
  which is the documented create path (there is no direct row-insert API, so
  validation stays on the platform).
  """
  def index(conn, _params) do
    todos = Bd.todos()

    images_by_todo =
      Bd.todo_images()
      |> Enum.group_by(fn image ->
        case get_in(image, ["fields", "todo"]) do
          %{"id" => id} -> id
          id when is_binary(id) -> id
          _ -> nil
        end
      end)

    render(conn, :index,
      todos: todos,
      images_by_todo: images_by_todo,
      configured: Bd.configured?()
    )
  end

  def create(conn, params) do
    title = params |> Map.get("title", "") |> String.trim()

    if title == "" do
      conn |> put_flash(:error, "A title is required.") |> redirect(to: ~p"/todos")
    else
      data = %{"title" => title, "done" => false}
      data = if params["notes"], do: Map.put(data, "notes", params["notes"]), else: data

      case Bd.form_submit(@form_slug, data, source: "phoenix-starter") do
        nil ->
          conn
          |> put_flash(:error, ~s(Could not add that todo — is the "Todo Form" set Live?))
          |> redirect(to: ~p"/todos")

        _ ->
          Bd.purge(["bd:data-model"])

          conn |> put_flash(:info, "Added.") |> redirect(to: ~p"/todos")
      end
    end
  end
end
