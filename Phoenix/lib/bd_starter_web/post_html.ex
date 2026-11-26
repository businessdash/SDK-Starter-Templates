defmodule BdStarterWeb.PostHtml do
  @moduledoc """
  A blog post's HTML, made safe to put on the page, and the small things
  every post shows (reading time, date).

  Why the post body is rebuilt, not trusted: a post's `content` is HTML
  written in the BusinessDash editor, and the API returns it as it was saved.
  Anyone who can write a post could otherwise put a script on this site.
  `safe/1` reads the HTML and writes out only the tags and attributes on the
  lists below, with every value escaped again; everything else becomes text.
  Nothing from the input reaches the page without being rebuilt, so there is
  no pattern to slip past.

  The same rules as `safePostHtml` in the other BD starters, line for line.
  """

  @allowed_tags ~w(a abbr b blockquote br caption code del div em figcaption figure
                   h1 h2 h3 h4 h5 h6 hr i img ins kbd li mark ol p pre s small span
                   strong sub sup table tbody td tfoot th thead tr u ul)

  @void_tags ~w(br hr img)

  # Tags whose whole content goes, not only the tag.
  @dropped_with_content ~w(script style iframe object embed template noscript textarea select)

  @any_tag_attributes ~w(title id class)
  @tag_attributes %{
    "a" => ~w(href),
    "img" => ~w(src alt width height loading),
    "td" => ~w(colspan rowspan),
    "th" => ~w(colspan rowspan scope),
    "ol" => ~w(start)
  }

  @url_attributes ~w(href src)

  @months ~w(January February March April May June July August September October November December)

  defp tag_pattern, do: ~r/\G<\/?([a-zA-Z][a-zA-Z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*+)>/
  defp attribute_pattern, do: ~r/([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/

  @doc "Make a post's HTML safe to render (see the note at the top)."
  @spec safe(String.t() | nil) :: String.t()
  def safe(nil), do: ""

  def safe(html) when is_binary(html) do
    html |> walk(0, [], [], nil) |> IO.iodata_to_binary()
  end

  # out is iodata in reverse; open is the stack of open tags, innermost first.
  defp walk(html, i, out, open, dropping) do
    length = byte_size(html)

    case :binary.match(html, "<", scope: {i, length - i}) do
      :nomatch ->
        out = if dropping, do: out, else: [escape_text(binary_part(html, i, length - i)) | out]
        Enum.reverse(out, Enum.map(open, &["</", &1, ">"]))

      {lt, 1} ->
        out = if dropping, do: out, else: [escape_text(binary_part(html, i, lt - i)) | out]
        step(html, lt, out, open, dropping)
    end
  end

  defp step(html, lt, out, open, dropping) do
    length = byte_size(html)

    cond do
      binary_part(html, lt, min(4, length - lt)) == "<!--" ->
        next =
          case :binary.match(html, "-->", scope: {lt + 4, length - lt - 4}) do
            :nomatch -> length
            {at, 3} -> at + 3
          end

        walk(html, next, out, open, dropping)

      true ->
        case Regex.run(tag_pattern(), html, offset: lt, return: :index) do
          [{^lt, tag_length}, {name_at, name_length}, {attrs_at, attrs_length}] ->
            tag = binary_part(html, lt, tag_length)
            name = html |> binary_part(name_at, name_length) |> String.downcase()
            attrs = binary_part(html, attrs_at, attrs_length)
            {out, open, dropping} = tag(tag, name, attrs, out, open, dropping)
            walk(html, lt + tag_length, out, open, dropping)

          _ ->
            out = if dropping, do: out, else: ["&lt;" | out]
            walk(html, lt + 1, out, open, dropping)
        end
    end
  end

  defp tag(tag, name, attrs, out, open, dropping) do
    closing = String.starts_with?(tag, "</")

    cond do
      dropping != nil ->
        {out, open, if(closing and name == dropping, do: nil, else: dropping)}

      name in @dropped_with_content ->
        {out, open, if(not closing and not String.ends_with?(tag, "/>"), do: name, else: nil)}

      name not in @allowed_tags ->
        {out, open, nil}

      closing ->
        case Enum.find_index(open, &(&1 == name)) do
          nil ->
            {out, open, nil}

          # Close anything left open inside it, so the nesting stays whole.
          at ->
            {closed, rest} = Enum.split(open, at + 1)
            {Enum.reverse(Enum.map(closed, &["</", &1, ">"]), out), rest, nil}
        end

      true ->
        attributes = attributes(name, attrs)
        out = [["<", name, attributes, ">"] | out]
        {out, if(name in @void_tags, do: open, else: [name | open]), nil}
    end
  end

  defp attributes(name, attrs) do
    allowed = @any_tag_attributes ++ Map.get(@tag_attributes, name, [])

    {parts, external} =
      attribute_pattern()
      |> Regex.scan(attrs, return: :index)
      |> Enum.reduce({[], false}, fn [_whole, key | values], {parts, external} ->
        key = attrs |> slice(key) |> String.downcase()

        value =
          values
          |> Enum.find(fn {at, _} -> at >= 0 end)
          |> then(&if(&1, do: slice(attrs, &1), else: ""))

        cond do
          key not in allowed ->
            {parts, external}

          key in @url_attributes ->
            case safe_url(value) do
              nil ->
                {parts, external}

              url ->
                external = external or (key == "href" and Regex.match?(~r/^https?:/i, url))
                {[[" ", key, "=\"", escape_attribute(url), "\""] | parts], external}
            end

          true ->
            {[[" ", key, "=\"", escape_attribute(value), "\""] | parts], external}
        end
      end)

    attributes = parts |> Enum.reverse() |> IO.iodata_to_binary()

    attributes =
      if name == "a" and external,
        do: attributes <> ~s( target="_blank" rel="noopener noreferrer nofollow"),
        else: attributes

    if name == "img" and not Regex.match?(~r/\sloading=/, attributes),
      do: attributes <> ~s( loading="lazy"),
      else: attributes
  end

  defp slice(_string, {at, _length}) when at < 0, do: ""
  defp slice(string, {at, length}), do: binary_part(string, at, length)

  @doc "Minutes to read a post, at 230 words a minute; tags don't count."
  @spec reading_minutes(String.t() | nil) :: pos_integer()
  def reading_minutes(nil), do: 1

  def reading_minutes(html) do
    words =
      ~r/<[^>]*>/ |> Regex.replace(html, " ") |> String.split(~r/\s+/, trim: true) |> length()

    max(1, round(words / 230))
  end

  @doc ~s|"November 18, 2026", or "" without a date.|
  @spec date(String.t() | nil) :: String.t()
  def date(iso) when is_binary(iso) and iso != "" do
    parsed =
      case DateTime.from_iso8601(iso) do
        {:ok, datetime, _offset} -> DateTime.to_date(datetime)
        _ -> with {:ok, date} <- Date.from_iso8601(String.slice(iso, 0, 10)), do: date
      end

    case parsed do
      %Date{} = d -> "#{Enum.at(@months, d.month - 1)} #{d.day}, #{d.year}"
      _ -> ""
    end
  end

  def date(_), do: ""

  defp escape_text(value) do
    # An entity already in the text (&amp; &#8217;) stays one.
    ~r/&(?![a-zA-Z][a-zA-Z0-9]{1,31};|#[0-9]{1,7};|#x[0-9a-fA-F]{1,6};)/
    |> Regex.replace(value, "&amp;")
    |> String.replace("<", "&lt;")
    |> String.replace(">", "&gt;")
  end

  defp escape_attribute(value), do: value |> escape_text() |> String.replace("\"", "&quot;")

  defp decode_entities(value) do
    value =
      Regex.replace(~r/&#x([0-9a-f]+);?/i, value, fn _, digits -> code_point(digits, 16) end)

    value = Regex.replace(~r/&#([0-9]+);?/, value, fn _, digits -> code_point(digits, 10) end)

    Enum.reduce(
      [{"&colon;", ":"}, {"&tab;", "\t"}, {"&newline;", "\n"}, {"&amp;", "&"}],
      value,
      fn {entity, char}, acc -> Regex.replace(~r/#{entity}/i, acc, char) end
    )
  end

  # Leading zeros count for nothing (&#0000106; is "j"); a number too big to be
  # a character, a surrogate or zero becomes U+FFFD, as it does in a browser.
  defp code_point(digits, base) do
    digits = String.trim_leading(digits, "0")

    n =
      if byte_size(digits) > 8 or digits == "",
        do: 0,
        else: String.to_integer(digits, base)

    if n > 0 and n <= 0x10FFFF and n not in 0xD800..0xDFFF, do: <<n::utf8>>, else: "�"
  end

  # http(s), mailto, tel, a path on this site, or a #fragment.
  defp safe_url(raw) do
    decoded = decode_entities(raw)

    if String.valid?(decoded) do
      # Browsers ignore control characters and whitespace inside a scheme
      # ("java\nscript:"), so they are removed before the check.
      value = Regex.replace(~r/[\x{0000}-\x{0020}\x{007f}-\x{009f}]/u, decoded, "")

      cond do
        Regex.match?(~r/^(https?:|mailto:|tel:)/i, value) -> String.trim(raw)
        Regex.match?(~r/^[a-z][a-z0-9+.-]*:/i, value) -> nil
        String.starts_with?(value, "//") -> nil
        true -> String.trim(raw)
      end
    else
      # Not UTF-8: nothing to link to.
      nil
    end
  end
end
