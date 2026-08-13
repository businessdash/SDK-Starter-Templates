import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	MetaFunction,
} from "react-router";

import { SiteHeader } from "~/components/SiteHeader";
import { confirmBooking, listEventTypes, listSlots } from "~/lib/biab-booking.server";
import { isServiceSuspended } from "~/lib/biab.server";

export const meta: MetaFunction = () => [{ title: "Book — Your Business" }];

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		const url = new URL(request.url);
		const selected = url.searchParams.get("event");
		const eventTypes = await listEventTypes();
		const active = selected ?? eventTypes[0]?.slug ?? null;
		const slots = active ? await listSlots(active) : [];
		return {
			suspended: false,
			connected: eventTypes.length > 0,
			eventTypes,
			active,
			slots: slots.slice(0, 20).map((s) => s.startAt),
		};
	} catch (err) {
		if (isServiceSuspended(err)) {
			return { suspended: true, connected: false, eventTypes: [], active: null, slots: [] };
		}
		throw err;
	}
}

export async function action({ request }: ActionFunctionArgs) {
	const fd = await request.formData();
	const result = await confirmBooking({
		eventTypeSlug: String(fd.get("eventTypeSlug") ?? ""),
		startAtIso: String(fd.get("startAt") ?? ""),
		name: String(fd.get("name") ?? ""),
		email: String(fd.get("email") ?? ""),
		timezone:
			String(fd.get("timezone") ?? "") ||
			Intl.DateTimeFormat().resolvedOptions().timeZone ||
			"UTC",
		notes: String(fd.get("notes") ?? "") || null,
	});
	if (result.ok) {
		return { ok: true as const, status: result.status };
	}
	return { ok: false as const, error: result.error };
}

export default function BookPage() {
	const { suspended, connected, eventTypes, active, slots } =
		useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const nav = useNavigation();
	const submitting = nav.state === "submitting";

	if (suspended) {
		return (
			<>
				<SiteHeader />
				<main>
					<section className="section">
						<h1 className="section__title">Book</h1>
						<p className="muted">Temporarily unavailable. Please check back soon.</p>
					</section>
				</main>
			</>
		);
	}

	return (
		<>
			<SiteHeader />
			<main>
				<section className="section">
					<h1 className="section__title">Book an appointment</h1>
					{!connected ? (
						<p className="muted">
							Scheduling isn't connected yet. Create an event type in BIAB to
							take bookings here.
						</p>
					) : actionData?.ok ? (
						<p className="muted">
							Booking {actionData.status === "confirmed" ? "confirmed" : "received"}!
							We'll be in touch.
						</p>
					) : (
						<>
							<Form method="get" className="event-picker">
								<label>
									Service
									<select name="event" defaultValue={active ?? ""}>
										{eventTypes.map((e) => (
											<option value={e.slug} key={e.slug}>
												{e.name} ({e.durationMinutes} min)
											</option>
										))}
									</select>
								</label>
								<button className="link-btn" type="submit">
									Show times
								</button>
							</Form>

							<Form method="post">
								<input type="hidden" name="eventTypeSlug" value={active ?? ""} />
								<label>
									Time
									<select name="startAt" required>
										{slots.length === 0 ? (
											<option value="">No times available</option>
										) : (
											slots.map((s) => (
												<option value={s} key={s}>
													{new Date(s).toLocaleString()}
												</option>
											))
										)}
									</select>
								</label>
								<label>
									Name
									<input name="name" required autoComplete="name" />
								</label>
								<label>
									Email
									<input name="email" type="email" required autoComplete="email" />
								</label>
								<label>
									Notes (optional)
									<textarea name="notes" rows={2} />
								</label>
								<button
									className="biab-btn"
									type="submit"
									disabled={submitting || slots.length === 0}
								>
									{submitting ? "Booking…" : "Confirm booking"}
								</button>
								{actionData && actionData.ok === false ? (
									<p className="error">{actionData.error}</p>
								) : null}
							</Form>
						</>
					)}
				</section>
			</main>
		</>
	);
}
