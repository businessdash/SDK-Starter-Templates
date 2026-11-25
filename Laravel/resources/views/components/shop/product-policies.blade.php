{{-- Secure checkout, and a link to ask before buying. --}}
@props(['contactHref' => '/#contact'])
<ul class="policies">
    <li>Secure checkout with Stripe</li>
    <li>Questions? <a href="{{ $contactHref }}">Ask us</a> before you buy</li>
</ul>
