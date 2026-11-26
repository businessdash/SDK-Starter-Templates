defmodule BdStarter.Forms.Dates do
  @moduledoc """
  Dates with the server's rules (`toUtcLegacyDate`): a bare `YYYY-MM-DD` is
  midnight UTC, an ISO instant with an offset is that instant, anything else
  falls back to the looser `Date.parse` shapes. A date is epoch milliseconds
  (a float, as in JavaScript).
  """

  alias BdStarter.Forms.{Js, Json}

  @months ~w(january february march april may june july august september october november december)

  @doc "Epoch ms from a number (ms) or a date string; nil when it isn't one."
  def parse(value) do
    if Json.number?(value) do
      if Js.finite?(value), do: value * 1.0, else: nil
    else
      parse_instant(Js.string(value))
    end
  end

  def parse_instant(raw) do
    s = Js.trim(raw)

    cond do
      m = Regex.run(~r/^(\d{4})-(\d{2})-(\d{2})\z/, s) ->
        [_, y, mo, d] = m
        utc(int(y), int(mo), int(d))

      # ISO 8601 with an explicit offset or Z (Temporal.Instant.from).
      m =
          Regex.run(
            ~r/^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?([Zz]|[+-]\d{2}:?\d{2})\z/,
            s
          ) ->
        [_, y, mo, d, h, mi, sec, frac, zone] = m
        ms = utc(int(y), int(mo), int(d), int(h), int(mi), int(sec))
        ms = if frac != "", do: ms + int(String.pad_trailing(frac, 9, "0")) / 1_000_000, else: ms

        if zone in ["Z", "z"] do
          ms
        else
          digits = String.replace(zone, ~r/\D/, "")
          offset = int(String.slice(digits, 0, 2)) * 3600 + int(String.slice(digits, -2, 2)) * 60
          ms - if(String.starts_with?(zone, "-"), do: -1, else: 1) * offset * 1000
        end

      # Date.parse fallbacks: a date-time without an offset is LOCAL time.
      m =
          Regex.run(
            ~r/^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?\z/,
            s
          ) ->
        [_, y, mo, d, h, mi | rest] = m ++ ["", ""]
        [sec, frac | _] = rest

        local(int(y), int(mo), int(d), int(h), int(mi), int(sec)) +
          if(frac != "", do: int(String.pad_trailing(frac, 3, "0")), else: 0)

      m = Regex.run(~r/^(\d{4})-(\d{2})\z/, s) ->
        [_, y, mo] = m
        utc(int(y), int(mo), 1)

      m = Regex.run(~r/^(\d{4})\z/, s) ->
        [_, y] = m
        utc(int(y), 1, 1)

      true ->
        loose(s)
    end
  end

  # "March 5, 2024", "Mar 5, 2024", "2024/03/05", "03/05/2024", and
  # "Tue, 05 Mar 2024 10:00:00 GMT" — strict: an impossible date is none.
  defp loose(s) do
    cond do
      m = Regex.run(~r/^([A-Za-z]+) (\d{1,2}), (\d{4})\z/, s) ->
        [_, name, d, y] = m

        case month(name) do
          nil -> nil
          mo -> strict(int(y), mo, int(d))
        end

      m = Regex.run(~r/^(\d{4})\/(\d{1,2})\/(\d{1,2})\z/, s) ->
        [_, y, mo, d] = m
        strict(int(y), int(mo), int(d))

      m = Regex.run(~r/^(\d{1,2})\/(\d{1,2})\/(\d{4})\z/, s) ->
        [_, mo, d, y] = m
        strict(int(y), int(mo), int(d))

      m =
          Regex.run(
            ~r/^[A-Za-z]{3}, (\d{2}) ([A-Za-z]{3}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) (?:GMT|UTC)\z/,
            s
          ) ->
        [_, d, name, y, h, mi, sec] = m

        with mo when mo != nil <- month(name),
             true <- valid?(int(y), mo, int(d)) and int(h) < 24 and int(mi) < 60 and int(sec) < 60 do
          utc(int(y), mo, int(d), int(h), int(mi), int(sec))
        else
          _ -> nil
        end

      true ->
        nil
    end
  end

  defp month(name) do
    lower = String.downcase(name)

    Enum.find_index(@months, fn full ->
      full == lower or (byte_size(lower) == 3 and String.starts_with?(full, lower))
    end)
    |> case do
      nil -> nil
      i -> i + 1
    end
  end

  defp strict(y, mo, d), do: if(valid?(y, mo, d), do: utc(y, mo, d), else: nil)

  defp valid?(y, mo, d),
    do: mo in 1..12 and d >= 1 and d <= :calendar.last_day_of_the_month(y, mo)

  defp int(""), do: 0
  defp int(s), do: String.to_integer(s)

  @doc "A UTC calendar time as epoch ms (out-of-range parts roll over)."
  def utc(year, month, day, hour \\ 0, minute \\ 0, second \\ 0) do
    y = year + Integer.floor_div(month - 1, 12)
    mo = Integer.mod(month - 1, 12) + 1

    days =
      :calendar.date_to_gregorian_days(y, mo, 1) - :calendar.date_to_gregorian_days(1970, 1, 1) +
        (day - 1)

    (days * 86_400 + hour * 3600 + minute * 60 + second) * 1000.0
  end

  # Local wall time on this server as epoch ms.
  defp local(y, mo, d, h, mi, sec) do
    base = utc(y, mo, d, h, mi, sec)
    seconds = Kernel.trunc(base / 1000)
    {{ly, lmo, ld}, {lh, lmi, ls}} = :calendar.universal_time_to_local_time(gregorian(seconds))
    offset = utc(ly, lmo, ld, lh, lmi, ls) - base
    base - offset
  end

  defp gregorian(seconds),
    do:
      :calendar.gregorian_seconds_to_datetime(
        seconds + :calendar.datetime_to_gregorian_seconds({{1970, 1, 1}, {0, 0, 0}})
      )

  @doc "Year, month, day in UTC."
  def utc_parts(ms) do
    {{y, m, d}, _} = gregorian(Kernel.trunc(Float.floor(ms / 1000)))
    {y, m, d}
  end

  @doc "`Date.toISOString()`: `2024-03-15T10:00:00.000Z`."
  def iso_string(ms) do
    seconds = Kernel.trunc(Float.floor(ms / 1000))
    {{y, mo, d}, {h, mi, s}} = gregorian(seconds)
    millis = Kernel.round(ms - seconds * 1000)

    :io_lib.format("~4..0B-~2..0B-~2..0BT~2..0B:~2..0B:~2..0B.~3..0BZ", [
      y,
      mo,
      d,
      h,
      mi,
      s,
      millis
    ])
    |> IO.iodata_to_binary()
  end
end
