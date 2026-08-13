import { Routes } from "@angular/router";

/**
 * App routes. The home page keeps the original single-page marketing layout
 * at `/`; the BIAB commerce + portal + programmatic-SEO surfaces are lazy
 * routes so they don't weigh down the home bundle.
 */
export const routes: Routes = [
	{
		path: "",
		pathMatch: "full",
		loadComponent: () => import("./pages/home.page").then((m) => m.HomePage),
	},
	{
		path: "store",
		loadComponent: () => import("./pages/store.page").then((m) => m.StorePage),
	},
	{
		path: "store/:id",
		loadComponent: () =>
			import("./pages/product-detail.page").then((m) => m.ProductDetailPage),
	},
	{
		path: "cart",
		loadComponent: () => import("./pages/cart.page").then((m) => m.CartPage),
	},
	{
		path: "subscriptions",
		loadComponent: () =>
			import("./pages/subscriptions.page").then((m) => m.SubscriptionsPage),
	},
	{
		path: "my-account",
		loadComponent: () =>
			import("./pages/my-account.page").then((m) => m.MyAccountPage),
	},
	{
		path: "reviews",
		loadComponent: () => import("./pages/reviews.page").then((m) => m.ReviewsPage),
	},
	{
		path: "updates",
		loadComponent: () => import("./pages/updates.page").then((m) => m.UpdatesPage),
	},
	{
		path: "todos",
		loadComponent: () => import("./pages/todos.page").then((m) => m.TodosPage),
	},
	{
		path: "booking",
		loadComponent: () => import("./pages/booking.page").then((m) => m.BookingPage),
	},
	{
		path: "services",
		pathMatch: "full",
		loadComponent: () =>
			import("./pages/services-index.page").then((m) => m.ServicesIndexPage),
	},
	{
		path: "services/:service/:area",
		loadComponent: () =>
			import("./pages/service-area.page").then((m) => m.ServiceAreaPage),
	},
	{ path: "**", redirectTo: "" },
];
