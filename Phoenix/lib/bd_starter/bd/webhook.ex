defmodule BdStarter.Bd.Webhook do
  @moduledoc """
  Verifies the BD → this-app revalidation webhook.

  BD fires `content.published` with a Stripe-shaped signature header:

      X-BD-Signature: t=<unix seconds>,v1=<hex hmac-sha256>

  signed over `"{t}.{raw_body}"`.

  Three rules, each silent when broken:

    1. Verify against the **raw** body, byte for byte. `Jason.decode` then
       `Jason.encode` changes key order and whitespace and the HMAC stops
       matching. Phoenix's `Plug.Parsers` consumes the body before your
       controller sees it, so the raw bytes have to be stashed on the way past
       — see `BdStarterWeb.Plugs.CacheBodyReader`. This is the single most
       common way a Phoenix webhook integration fails.
    2. Compare in constant time (`Plug.Crypto.secure_compare/2`), never `==`.
    3. Enforce the replay window — 5 minutes, matching the platform.
  """

  @replay_window_seconds 300

  @spec verify(String.t(), String.t() | nil, String.t() | nil) ::
          {:ok, map()} | {:error, atom()}
  def verify(raw_body, signature_header, secret \\ nil) do
    secret = secret || Application.get_env(:bd_starter, :bd_revalidation_secret)

    with {:secret, s} when is_binary(s) and s != "" <- {:secret, secret},
         {:sig, {:ok, t, v1}} <- {:sig, parse_signature(signature_header)},
         {:fresh, true} <- {:fresh, abs(System.system_time(:second) - t) <= @replay_window_seconds},
         {:match, true} <- {:match, matches?(t, raw_body, v1, s)},
         {:json, {:ok, payload}} <- {:json, Jason.decode(raw_body)},
         {:shape, true} <- {:shape, valid_shape?(payload)} do
      {:ok, payload}
    else
      {:secret, _} -> {:error, :no_secret_configured}
      {:sig, _} -> {:error, :missing_or_malformed_signature}
      {:fresh, _} -> {:error, :replay_window_expired}
      {:match, _} -> {:error, :signature_mismatch}
      {:json, _} -> {:error, :body_not_json}
      {:shape, _} -> {:error, :body_shape_invalid}
    end
  end

  @doc "The cache tags a verified payload names."
  def tags(%{"tags" => tags}) when is_list(tags), do: Enum.filter(tags, &(is_binary(&1) and &1 != ""))
  def tags(_), do: []

  defp matches?(t, raw_body, v1, secret) do
    expected =
      :hmac
      |> :crypto.mac(:sha256, secret, "#{t}.#{raw_body}")
      |> Base.encode16(case: :lower)

    Plug.Crypto.secure_compare(expected, String.downcase(v1))
  end

  defp parse_signature(nil), do: :error

  defp parse_signature(header) do
    parsed =
      header
      |> String.split(",")
      |> Enum.map(&String.trim/1)
      |> Enum.reduce(%{}, fn part, acc ->
        case String.split(part, "=", parts: 2) do
          [k, v] -> Map.put(acc, k, v)
          _ -> acc
        end
      end)

    with {:ok, t_raw} <- Map.fetch(parsed, "t"),
         {t, ""} <- Integer.parse(t_raw),
         {:ok, v1} <- Map.fetch(parsed, "v1"),
         true <- v1 != "" do
      {:ok, t, v1}
    else
      _ -> :error
    end
  end

  defp valid_shape?(%{"event" => "content.published", "tags" => tags, "orgId" => org_id})
       when is_list(tags) and is_binary(org_id),
       do: true

  defp valid_shape?(_), do: false
end
