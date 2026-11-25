defmodule BdStarterWeb.BlogHTML do
  @moduledoc false
  use BdStarterWeb, :html

  embed_templates "blog_html/*"

  def older_href(category, cursor) do
    ~p"/blog?#{Enum.reject([category: category, cursor: cursor], fn {_k, v} -> is_nil(v) end)}"
  end
end
