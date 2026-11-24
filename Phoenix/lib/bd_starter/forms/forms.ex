defmodule BdStarter.Forms do
  @moduledoc """
  Forms and quizzes drawn on this server by the forms engine (`BdStarter.Forms.*`,
  a port of the SDK's forms-core): where each comes from, BD with this
  server's secret key or the bundled samples.
  """

  alias BdStarter.Forms.{Backend, FormsError, PackageBackend, Quizzes, SampleBackend}

  @doc "The sample quiz's slug: `/quiz/sample`, and `/quiz` until BD is connected."
  def sample_quiz, do: "sample"

  @doc "BD's Package API, or the sample's stand-in; nil for a BD form while BD isn't configured."
  def backend(slug) do
    if slug == SampleBackend.slug(), do: %SampleBackend{}, else: PackageBackend.from_config()
  end

  @doc "Raises `FormsError`."
  def schema!(slug) do
    case backend(slug) do
      nil -> raise FormsError, message: "BD isn't configured (BD_API_KEY / BD_SITE_ID)."
      backend -> Backend.schema(backend, slug)
    end
  end

  @doc "The home page's contact form: BD_CONTACT_FORM once BD is connected, else the sample."
  def contact_slug do
    slug = Application.get_env(:bd_starter, :bd_contact_form) || ""
    if PackageBackend.from_config() != nil and slug != "", do: slug, else: SampleBackend.slug()
  end

  @doc "The practice quiz /quiz shows: BD_QUIZ once BD is connected, else the sample."
  def quiz_slug do
    slug = Application.get_env(:bd_starter, :bd_quiz) || ""
    if Quizzes.from_config() != nil and slug != "", do: slug, else: sample_quiz()
  end
end
