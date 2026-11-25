import { createFileRoute } from "@tanstack/solid-router";
import { useStore } from "@tanstack/solid-store";

import { fullName, store } from "../lib/demo-store";

export const Route = createFileRoute("/demo/store")({
	component: DemoStore,
});

function FirstName() {
	const firstName = useStore(store, (state) => state.firstName);
	return (
		<input
			type="text"
			value={firstName()}
			onInput={(e) =>
				store.setState((state) => ({ ...state, firstName: e.target.value }))
			}
			class="demo-store-input"
		/>
	);
}

function LastName() {
	const lastName = useStore(store, (state) => state.lastName);
	return (
		<input
			type="text"
			value={lastName()}
			onInput={(e) =>
				store.setState((state) => ({ ...state, lastName: e.target.value }))
			}
			class="demo-store-input"
		/>
	);
}

function FullName() {
	const fName = useStore(fullName);
	return (
		<div class="demo-store-value">{fName()}</div>
	);
}

function DemoStore() {
	return (
		<div
			class="demo-store-page"
			style={{
				"background-image":
					"radial-gradient(50% 50% at 80% 80%, #f4a460 0%, #8b4513 70%, #1a0f0a 100%)",
			}}
		>
			<div class="demo-store-card">
				<h1 class="demo-store-title">Store Example</h1>
				<FirstName />
				<LastName />
				<FullName />
			</div>
		</div>
	);
}
