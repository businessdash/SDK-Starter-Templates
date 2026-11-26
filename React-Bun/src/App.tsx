import "./App.css";
import "./bd-reviews.css";
// [bd:store]
import "./bd-shop.css";
// [/bd:store]
// [bd:blog]
import "./bd-blog.css";
// [/bd:blog]
import { BDAnalytics } from "@businessdash/sdk/react-analytics";
import { About } from "./components/About";
import { Banner } from "./components/Banner";
// [bd:blog]
import { Blog } from "./components/Blog";
// [/bd:blog]
// [bd:booking]
import { Booking } from "./components/Booking";
// [/bd:booking]
import { ContactForm } from "./components/ContactForm";
import { Footer } from "./components/Footer";
import { Gallery } from "./components/Gallery";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { SdkSetupBanner } from "./components/SdkSetupBanner";
import { Services } from "./components/Services";
import { RouterProvider } from "./lib/router";
import { useRoute } from "./lib/route";
// [bd:blog]
import { BlogPage } from "./pages/BlogPage";
import { BlogPostPage } from "./pages/BlogPostPage";
// [/bd:blog]
// [bd:store]
import { Cart } from "./pages/Cart";
import { Compare } from "./pages/Compare";
// [/bd:store]
import { MyAccount } from "./pages/MyAccount";
// [bd:store]
import { Product } from "./pages/Product";
// [/bd:store]
import { Reviews } from "./pages/Reviews";
import { ServiceArea } from "./pages/ServiceArea";
import { ServiceAreas } from "./pages/ServiceAreas";
// [bd:store]
import { Store } from "./pages/Store";
import { Wishlist } from "./pages/Wishlist";
// [/bd:store]
// [bd:subscriptions]
import { Subscriptions } from "./pages/Subscriptions";
// [/bd:subscriptions]
import { Todos } from "./pages/Todos";
import { Updates } from "./pages/Updates";

/**
 * Generic business website wired against the BD SDK, now at full feature
 * parity with the production reference consumer. The home page composes the
 * marketing sections; a tiny client router (src/lib/router) switches in the
 * feature pages (store, wishlist, compare, cart, subscriptions, blog,
 * reviews, updates, my-account, programmatic-SEO service pages).
 *
 * The pattern is unchanged: browser → same-origin `/api/bd/*` proxy → BD
 * Package API. The Bun server (server.ts) holds the bearer key.
 */
function Home() {
	return (
		<main>
			<Hero />
			<About />
			<Services />
			<Gallery />
			{/* [bd:booking] */}
			<Booking />
			{/* [/bd:booking] */}
			{/* [bd:blog] */}
			<Blog />
			{/* [/bd:blog] */}
			<ContactForm />
		</main>
	);
}

function Routed() {
	const { path } = useRoute();
	// [bd:store]
	if (path === "/store") return <Store />;
	if (path === "/store/wishlist") return <Wishlist />;
	if (path === "/store/compare") return <Compare />;
	if (/^\/store\/[^/]+$/.test(path)) return <Product />;
	if (path === "/cart") return <Cart />;
	// [/bd:store]
	// [bd:blog]
	if (path === "/blog") return <BlogPage />;
	if (/^\/blog\/[^/]+$/.test(path)) return <BlogPostPage />;
	// [/bd:blog]
	// [bd:subscriptions]
	if (path === "/subscriptions") return <Subscriptions />;
	// [/bd:subscriptions]
	if (path === "/reviews") return <Reviews />;
	if (path === "/updates") return <Updates />;
	if (path === "/todos") return <Todos />;
	if (path === "/services") return <ServiceAreas />;
	if (/^\/services\/[^/]+\/[^/]+$/.test(path)) return <ServiceArea />;
	if (path === "/my-account") return <MyAccount />;
	return <Home />;
}

function App() {
	// Canonical VITE_ names (exposed to the browser via envPrefix in
	// vite.config.ts), falling back to the legacy VITE_ twins so existing
	// setups keep working.
	const bdSiteId =
		import.meta.env.VITE_BD_SITE_ID ??
		import.meta.env.VITE_BD_SITE_ID;
	const bdBaseUrl =
		import.meta.env.VITE_BD_PACKAGE_API_BASE_URL ??
		import.meta.env.VITE_BD_PACKAGE_API_BASE_URL;
	const bdPublicKey =
		import.meta.env.VITE_BD_PK ??
		import.meta.env.VITE_BD_PUBLIC_KEY;
	return (
		<RouterProvider>
			<Banner />
			<Header />
			<Routed />
			<Footer />
			<SdkSetupBanner />
			{bdSiteId && bdBaseUrl && bdPublicKey ? (
				<BDAnalytics siteId={bdSiteId} baseUrl={bdBaseUrl} apiKey={bdPublicKey} />
			) : null}
		</RouterProvider>
	);
}

export default App;
