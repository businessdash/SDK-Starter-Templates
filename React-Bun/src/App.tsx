import "./App.css";
import { BDAnalytics } from "@businessdash/sdk/react-analytics";
import { About } from "./components/About";
import { Banner } from "./components/Banner";
import { Blog } from "./components/Blog";
import { Booking } from "./components/Booking";
import { ContactForm } from "./components/ContactForm";
import { Footer } from "./components/Footer";
import { Gallery } from "./components/Gallery";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { SdkSetupBanner } from "./components/SdkSetupBanner";
import { Services } from "./components/Services";
import { RouterProvider, useRoute } from "./lib/router";
import { Cart } from "./pages/Cart";
import { MyAccount } from "./pages/MyAccount";
import { Product } from "./pages/Product";
import { Reviews } from "./pages/Reviews";
import { ServiceArea } from "./pages/ServiceArea";
import { ServiceAreas } from "./pages/ServiceAreas";
import { Store } from "./pages/Store";
import { Subscriptions } from "./pages/Subscriptions";
import { Todos } from "./pages/Todos";
import { Updates } from "./pages/Updates";

/**
 * Generic business website wired against the BD SDK, now at full feature
 * parity with the production reference consumer. The home page composes the
 * marketing sections; a tiny client router (src/lib/router) switches in the
 * feature pages (store, cart, subscriptions, reviews, updates, my-account,
 * programmatic-SEO service pages).
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
			<Booking />
			<Blog />
			<ContactForm />
		</main>
	);
}

function Routed() {
	const { path } = useRoute();
	if (path === "/store") return <Store />;
	if (/^\/store\/[^/]+$/.test(path)) return <Product />;
	if (path === "/cart") return <Cart />;
	if (path === "/subscriptions") return <Subscriptions />;
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
