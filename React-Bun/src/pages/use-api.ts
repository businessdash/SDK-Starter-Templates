import { useEffect, useState } from "react";

type Result<T> = { key: string; data: T | null; error: unknown };

/**
 * Calls `fn` on arrival and again when `deps` change. While a new call runs,
 * `loading` is true and `data` is still the last answer.
 */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
	const key = JSON.stringify(deps);
	const [result, setResult] = useState<Result<T> | null>(null);
	useEffect(() => {
		let alive = true;
		fn().then(
			(data) => {
				if (alive) setResult({ key, data, error: null });
			},
			(error: unknown) => {
				if (alive) setResult({ key, data: null, error });
			},
		);
		return () => {
			alive = false;
		};
		// `fn` is a new function each render; `deps` say when to call it again.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);
	const current = result?.key === key ? result : null;
	return { data: result?.data ?? null, error: current?.error ?? null, loading: current === null };
}
