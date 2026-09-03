<?php

use App\Http\Controllers\BdAuthController;
use App\Http\Controllers\BlogController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\FormProxyController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\PortalController;
use App\Http\Controllers\SeoController;
use App\Http\Controllers\ServiceAreaController;
use App\Http\Controllers\StoreController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\TodosController;
use App\Http\Controllers\WebhookController;
use Illuminate\Support\Facades\Route;

/*
 * BD Laravel starter — the same generic business site the other starters
 * render, server-side in Blade.
 *
 * Route groups, top to bottom: pages, store + cart, portal, custom data,
 * SEO/AEO files, and the two machine endpoints (forms proxy, webhook).
 */

// ── Pages ──────────────────────────────────────────────────────────────────
Route::get('/', [HomeController::class, 'index'])->name('home');
Route::get('/blog', [BlogController::class, 'index'])->name('blog');
Route::get('/blog/{slug}', [BlogController::class, 'show'])->name('blog.show');
Route::get('/reviews', [HomeController::class, 'reviews'])->name('reviews');
Route::get('/updates', [HomeController::class, 'updates'])->name('updates');

// Programmatic SEO — one template, N variants, copy owned by the dashboard.
Route::get('/services', [ServiceAreaController::class, 'index'])->name('services');
Route::get('/services/{service}/{area}', [ServiceAreaController::class, 'show'])
    ->name('services.area');

// ── Store ──────────────────────────────────────────────────────────────────
Route::get('/store', [StoreController::class, 'index'])->name('store');
Route::get('/store/{id}', [StoreController::class, 'show'])->name('store.product');

Route::get('/cart', [CartController::class, 'show'])->name('cart');
Route::post('/cart/items', [CartController::class, 'addItem'])->name('cart.add');
Route::patch('/cart/items/{itemId}', [CartController::class, 'updateItem'])->name('cart.update');
Route::delete('/cart/items/{itemId}', [CartController::class, 'removeItem'])->name('cart.remove');
Route::post('/cart/coupon', [CartController::class, 'applyCoupon'])->name('cart.coupon');
Route::delete('/cart/coupon', [CartController::class, 'removeCoupon'])->name('cart.coupon.remove');
Route::post('/cart/clear', [CartController::class, 'clear'])->name('cart.clear');
Route::post('/cart/checkout', [CartController::class, 'checkout'])->name('cart.checkout');

Route::get('/subscriptions', [SubscriptionController::class, 'index'])->name('subscriptions');
Route::post('/subscriptions/{id}/checkout', [SubscriptionController::class, 'checkout'])
    ->name('subscriptions.checkout');

// ── Custom database demo ───────────────────────────────────────────────────
Route::get('/todos', [TodosController::class, 'index'])->name('todos');
Route::post('/todos', [TodosController::class, 'store'])->name('todos.store');

// ── Auth + customer portal ─────────────────────────────────────────────────
Route::match(['get', 'post'], '/api/bd-auth/{action}', BdAuthController::class)
    ->where('action', 'sign-in|sign-up|callback|sign-out')
    ->name('bd.auth');

Route::get('/my-account', [PortalController::class, 'index'])->name('portal');
Route::post('/my-account/review', [PortalController::class, 'submitReview'])->name('portal.review');

// ── Newsletter ─────────────────────────────────────────────────────────────
Route::post('/subscribe', [HomeController::class, 'subscribe'])->name('subscribe');

// ── SEO / AEO ──────────────────────────────────────────────────────────────
// Proxied from BD so the org edits them in the dashboard, but they are
// served from THIS domain — the only place crawlers look.
Route::get('/sitemap.xml', [SeoController::class, 'sitemap']);
Route::get('/robots.txt', [SeoController::class, 'robots']);
Route::get('/llms.txt', [SeoController::class, 'llmsTxt']);

// ── Machine endpoints ──────────────────────────────────────────────────────
// Same-origin proxy for the <bd-form> web component: the browser gets the
// schema and posts submissions without ever seeing the bearer key.
Route::get('/api/bd/forms/{slug}', [FormProxyController::class, 'schema']);
Route::post('/api/bd/forms/{slug}', [FormProxyController::class, 'submit']);

// Publish webhook. CSRF is exempted in bootstrap/app.php — this is a
// server-to-server call authenticated by HMAC, not by session.
Route::post('/api/bd/revalidate', WebhookController::class);
