{{-- Details: the feature list, then a table per spec group. --}}
@props(['features', 'specs'])
@if ($features || $specs)
    <section class="product-section" id="specs">
        <h2 class="product-section__title">Details</h2>
        @if ($features)
            <ul class="features">
                @foreach ($features as $feature)
                    <li>{{ $feature }}</li>
                @endforeach
            </ul>
        @endif
        @foreach ($specs as $group)
            <table class="specs">
                <caption>{{ $group['name'] }}</caption>
                <tbody>
                    @foreach ($group['rows'] as $row)
                        <tr>
                            <th scope="row">{{ $row['label'] }}</th>
                            <td>{{ $row['value'] }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endforeach
    </section>
@endif
