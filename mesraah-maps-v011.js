import { setOptions, importLibrary } from 'https://cdn.jsdelivr.net/npm/@googlemaps/js-api-loader@2.0.2/+esm';

let configured = false;
let placesReady = null;

function key() {
  return String(window.MESRAAH_GOOGLE_MAPS_API_KEY || '').trim();
}

function hasKey() {
  return Boolean(key());
}

async function ensurePlaces() {
  if (!hasKey()) throw new Error('maps-key-missing');
  if (!configured) {
    setOptions({
      key: key(),
      v: 'weekly',
      language: 'ar',
      region: 'SA',
      authReferrerPolicy: 'origin'
    });
    configured = true;
  }
  if (!placesReady) placesReady = importLibrary('places');
  await placesReady;
  return google.maps.places;
}

async function mountAutocomplete(host, { onSelect, placeholder = 'ابحث عن مطعم، مكتب، متجر أو عنوان…' } = {}) {
  if (!host) throw new Error('maps-host-missing');
  const places = await ensurePlaces();
  host.replaceChildren();

  const autocomplete = new places.PlaceAutocompleteElement();
  autocomplete.placeholder = placeholder;
  autocomplete.setAttribute('aria-label', 'ابحث عن مكان في Google Maps');
  host.appendChild(autocomplete);

  autocomplete.addEventListener('gmp-select', async event => {
    const prediction = event.placePrediction;
    if (!prediction) return;
    const place = prediction.toPlace();
    await place.fetchFields({
      fields: ['id', 'displayName', 'formattedAddress', 'location']
    });
    const lat = typeof place.location?.lat === 'function' ? place.location.lat() : place.location?.lat;
    const lng = typeof place.location?.lng === 'function' ? place.location.lng() : place.location?.lng;
    const result = {
      placeId: place.id || '',
      name: place.displayName || '',
      address: place.formattedAddress || '',
      lat: Number.isFinite(Number(lat)) ? Number(lat) : null,
      lng: Number.isFinite(Number(lng)) ? Number(lng) : null
    };
    onSelect?.(result);
  });

  return autocomplete;
}

function googleMapsUrl(location = {}) {
  const query = [location.name, location.address].filter(Boolean).join('، ').trim();
  if (location.placeId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || location.placeId)}&query_place_id=${encodeURIComponent(location.placeId)}`;
  }
  if (Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.lat},${location.lng}`)}`;
  }
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : 'https://www.google.com/maps';
}

window.MesraahMaps = {
  hasKey,
  mountAutocomplete,
  googleMapsUrl
};

export { hasKey, mountAutocomplete, googleMapsUrl };
