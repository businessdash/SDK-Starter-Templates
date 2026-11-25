import { Routes } from "@angular/router";

/**
 * App routes. The home page keeps the original single-page marketing layout
 * at `/`; the BD commerce + portal + programmatic-SEO surfaces are lazy
 * routes so they don't weigh down the home bundle.
 */
export const routes: Routes = [
	{
		path: "",
		pathMatch: "full",
		loadComponent: () => import("./pages/home.page").then((m) => m.HomePage),
	},
	// [bd:store]
	{
		path: "store",
		loadComponent: () => import("./pages/store.page").then((m) => m.StorePage),
	},
	{
		path: "store/wishlist",
		loadComponent: () => import("./pages/wishlist.page").then((m) => m.WishlistPage),
	},
	{
		path: "store/compare",
		loadComponent: () => import("./pages/compare.page").then((m) => m.ComparePage),
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
	// [/bd:store]
	// [bd:subscriptions]
	{
		path: "subscriptions",
		loadComponent: () =>
			import("./pages/subscriptions.page").then((m) => m.SubscriptionsPage),
	},
	// [/bd:subscriptions]
	// [bd:blog]
	{
		path: "blog",
		pathMatch: "full",
		loadComponent: () => import("./pages/blog.page").then((m) => m.BlogPage),
	},
	{
		path: "blog/:slug",
		loadComponent: () => import("./pages/blog-post.page").then((m) => m.BlogPostPage),
	},
	// [/bd:blog]
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
	// [bd:booking]
	{
		path: "booking",
		loadComponent: () => import("./pages/booking.page").then((m) => m.BookingPage),
	},
	// [/bd:booking]
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
