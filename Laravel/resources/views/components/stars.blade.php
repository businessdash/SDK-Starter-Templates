{{-- Stars for a rating, the same markup the shop elements draw. --}}
@props(['rating' => 0])
<span aria-label="{{ number_format((float) $rating, 1) }} out of 5" class="stars" role="img">@foreach ([1, 2, 3, 4, 5] as $i)<span @class(['stars__star', 'stars__star--on' => $rating >= $i, 'stars__star--half' => $rating < $i && $rating >= $i - 0.5])>★</span>@endforeach</span>
