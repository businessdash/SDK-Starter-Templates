import { createQuery } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/demo/tanstack-query")({
	component: App,
});

function App() {
	const peopleQuery = createQuery(() => ({
		queryKey: ["people"],
		queryFn: () =>
			Promise.resolve([{ name: "John Doe" }, { name: "Jane Doe" }]),
		initialData: [],
	}));

	return (
		<div class="demo-page">
			<h1 class="demo-title">People list from Swapi</h1>
			<ul>
				{peopleQuery.data?.map((person) => (
					<li>{person.name}</li>
				))}
			</ul>
		</div>
	);
}

export default App;
