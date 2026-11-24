<?php

use App\Http\Controllers\BdAuthController;
use App\Http\Controllers\BdCustomerAuthController;
use App\Http\Controllers\BlogController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\FormPageController;
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
 * forms and quizzes, SEO/AEO files, and the publish webhook.
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
// Customer sign-in as JSON, for apps and pages that bring their own screen,
// and the "Continue with Google / Apple / GitHub / Discord" links the screen
// on /my-account (App\Livewire\SignIn) uses. Before {action} below.
Route::match(['get', 'post'], '/api/bd-auth/customer/{path}', BdCustomerAuthController::class)
    ->where('path', 'options|sign-in|sign-up|forgot-password|verify|id-token|oauth/[a-z]+')
    ->name('bd.auth.customer');

Route::match(['get', 'post'], '/api/bd-auth/{action}', BdAuthController::class)
    ->where('action', 'sign-in|sign-up|callback|sign-out|delete-account')
    ->name('bd.auth');

Route::get('/my-account', [PortalController::class, 'index'])->name('portal');
Route::post('/my-account/review', [PortalController::class, 'submitReview'])->name('portal.review');

// ── Forms and quizzes, drawn here by the forms engine (app/Bd/Forms) ──────
// Any form from your dashboard; the home page's contact section is one. A
// practice quiz or the sample at /quiz (BD_QUIZ), any practice quiz at
// /quiz/{slug}, an invitation at /quiz-invite/{token}: the link BD's invite
// emails carry when this site is the quiz's invite domain.
Route::get('/forms/{slug}', [FormPageController::class, 'form'])->name('forms.show');
Route::get('/quiz', [FormPageController::class, 'quiz'])->name('quiz');
Route::get('/quiz/{slug}', [FormPageController::class, 'quiz'])->name('quiz.practice');
Route::get('/quiz-invite/{token}', [FormPageController::class, 'invitation'])->name('quiz.invitation');

// ── Newsletter ─────────────────────────────────────────────────────────────
Route::post('/subscribe', [HomeController::class, 'subscribe'])->name('subscribe');

// ── SEO / AEO ──────────────────────────────────────────────────────────────
// Proxied from BD so the org edits them in the dashboard, but they are
// served from THIS domain — the only place crawlers look.
Route::get('/sitemap.xml', [SeoController::class, 'sitemap']);
Route::get('/robots.txt', [SeoController::class, 'robots']);
Route::get('/llms.txt', [SeoController::class, 'llmsTxt']);

// ── Machine endpoints ──────────────────────────────────────────────────────
// Publish webhook. CSRF is exempted in bootstrap/app.php — this is a
// server-to-server call authenticated by HMAC, not by session.
Route::post('/api/bd/revalidate', WebhookController::class);
