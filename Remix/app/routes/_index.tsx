import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import { ContactForm } from "~/components/ContactForm";
import { NewsBanner, type BannerMessage } from "~/components/NewsBanner";
import { Subscribe } from "~/components/Subscribe";
import {
	getBannerFromBundle,
	getMarketingBundle,
} from "~/lib/bd-bundle.server";
import { buildHomeJsonLd } from "~/lib/bd-seo.server";
import { isServiceSuspended } from "~/lib/bd.server";
import {
	loadAbout,
	loadBlog,
	loadGallery,
	loadHero,
	loadServices,
} from "~/lib/sdk-sections.server";

export const meta: MetaFunction = () => [
	{ title: "Your Business — built on BD" },
	{
		name: "description",
		content:
			"Remix starter showing how to consume the BD SDK in server loader functions with Form-driven actions.",
	},
];

export async function loader(_: LoaderFunctionArgs) {
	// The bundle carries the banner + the company data for JSON-LD. Catch a
	// suspension here so the home page can render a minimal unavailable state.
	let suspended = false;
	let bundle = null;
	try {
		bundle = await getMarketingBundle();
	} catch (err) {
		if (isServiceSuspended(err)) suspended = true;
		else throw err;
	}

	const [hero, about, services, blog, gallery] = await Promise.all([
		loadHero(),
		loadAbout(),
		loadServices(),
		loadBlog(),
		loadGallery(),
	]);

	const banner = getBannerFromBundle(bundle);
	const activeMessage =
		banner?.enabled && banner.messages.length > 0
			? (banner.messages.find((x) => x.enabled) ?? banner.messages[0])
			: undefined;
	const bannerMessage: BannerMessage | null = activeMessage
		? {
				id: activeMessage.id,
				text: activeMessage.text,
				linkUrl: activeMessage.linkUrl,
				buttonText: activeMessage.buttonText,
				openInNewTab: activeMessage.openInNewTab,
				urgent: activeMessage.urgent,
			}
		: null;

	return {
		suspended,
		hero,
		about,
		services,
		blog,
		gallery,
		bannerMessage,
		jsonLd: buildHomeJsonLd(bundle),
	};
}

export default function Index() {
	const { suspended, hero, about, services, blog, gallery, bannerMessage, jsonLd } =
		useLoaderData<typeof loader>();

	if (suspended) {
		return (
			<main>
				<section className="section" style={{ textAlign: "center" }}>
					<h1 className="hero__title">We'll be right back</h1>
					<p className="muted">
						This site is temporarily unavailable. Please check back soon.
					</p>
				</section>
			</main>
		);
	}

	return (
		<>
			{/* Server-rendered JSON-LD (localBusiness + website) for crawlers. */}
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: jsonLd }}
			/>
			<NewsBanner message={bannerMessage} />
			<header className="header">
				<a className="brand" href="#hero">
					Your Business
				</a>
				<nav>
					<a href="#about">About</a>
					<a href="#services">Services</a>
					<a href="#gallery">Gallery</a>
					<a href="#blog">Blog</a>
					<Link to="/store">Store</Link>
					<Link to="/reviews">Reviews</Link>
					<Link to="/book">Book</Link>
					<Link to="/my-account">Account</Link>
				</nav>
			</header>
			<main>
				<section className="hero" id="hero">
					<span className="bd-badge">Open · Mon–Sat</span>
					<h1 className="hero__title">{hero.title}</h1>
					<p className="hero__sub">{hero.tagline}</p>
					<a className="bd-btn" href={hero.ctaHref}>
						{hero.ctaLabel}
					</a>
				</section>
				<section className="section" id="about">
					<h2 className="section__title">About</h2>
					{about.map((block) => (
						<article className="card" key={block.heading}>
							<h3>{block.heading}</h3>
							<p>{block.body}</p>
						</article>
					))}
					{/* Followers-backed signup — same component as the footer. */}
					<Subscribe
						source="about"
						label="Get news and offers"
						buttonLabel="Subscribe"
					/>
				</section>
				<section className="section" id="services">
					<h2 className="section__title">Services</h2>
					<div className="grid">
						{services.map((s) => (
							<article className="card" key={s.id}>
								<h3>{s.name}</h3>
								<p>{s.description}</p>
								<span className="price">{s.priceLabel}</span>
							</article>
						))}
					</div>
				</section>
				<section className="section" id="gallery">
					<h2 className="section__title">Recent work</h2>
					{gallery.length === 0 ? (
						<p className="muted">
							Tag media items "Show in public gallery" in BD and they appear
							here.
						</p>
					) : (
						<div className="gallery-grid">
							{gallery.map((g) => (
								<figure className="gallery-tile" key={g.id}>
									<img src={g.src} alt={g.alt} loading="lazy" />
									{g.title ? <figcaption>{g.title}</figcaption> : null}
								</figure>
							))}
						</div>
					)}
				</section>
				<section className="section" id="blog">
					<h2 className="section__title">From the blog</h2>
					{blog.length === 0 ? (
						<p className="muted">
							No posts yet — author them in BD and they appear here.
						</p>
					) : (
						<ul className="post-list">
							{blog.map((post) => (
								<li key={post.slug}>
									<a href={`/blog/${post.slug}`}>
										<strong>{post.title}</strong>
										<span className="muted">{post.publishedAt}</span>
									</a>
									<p>{post.excerpt}</p>
								</li>
							))}
						</ul>
					)}
				</section>
				{/* Schema-driven drop-in. `<BdForm>` (the contact island) fetches
				    the schema and submits through the same-origin /api/bd/forms
				    resource route, so the bearer key stays server-side. */}
				<ContactForm />
			</main>
			<footer className="footer">
				<Subscribe source="footer" label="Subscribe to our newsletter" />
				<p>© {new Date().getFullYear()} Your Business — built on BD.</p>
			</footer>
		</>
	);
}
