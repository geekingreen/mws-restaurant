let restaurants, neighborhoods, cuisines;
var map;
var markers = [];

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', event => {
  fetchNeighborhoods();
  fetchCuisines();
});

/**
 * Fetch all neighborhoods and set their HTML.
 */
fetchNeighborhoods = () => {
  DBHelper.fetchNeighborhoods()
    .then(neighborhoods => {
      self.neighborhoods = neighborhoods;
      fillNeighborhoodsHTML();
    })
    .catch(err => console.error(err));
};

/**
 * Set neighborhoods HTML.
 */
fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
  const select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
};

/**
 * Fetch all cuisines and set their HTML.
 */
fetchCuisines = () => {
  DBHelper.fetchCuisines()
    .then(cuisines => {
      self.cuisines = cuisines;
      fillCuisinesHTML();
    })
    .catch(err => console.error(err));
};

/**
 * Set cuisines HTML.
 */
fillCuisinesHTML = (cuisines = self.cuisines) => {
  const select = document.getElementById('cuisines-select');

  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
};

/**
 * Initialize Google map, called from HTML.
 */
window.onload = () => {
  updateRestaurants();
  setTimeout(() => {
    const mapsScript = document.createElement('script');

    mapsScript.src =
      'https://maps.googleapis.com/maps/api/js?key=AIzaSyA1e64IZL8X_1_I0kg4D0v1zWydW3eXkOc&libraries=places&callback=initMap';

    document.querySelector('body').appendChild(mapsScript);
  }, 1000);
};

window.initMap = () => {
  let loc = {
    lat: 40.722216,
    lng: -73.987501
  };
  self.map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: loc,
    scrollwheel: false
  });
  addMarkersToMap();
};

/**
 * Update page and map for current restaurants.
 */
updateRestaurants = () => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood)
    .then(restaurants => {
      resetRestaurants(restaurants);
      fillRestaurantsHTML();
    })
    .catch(err => console.error(err));
};

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
resetRestaurants = restaurants => {
  // Remove all restaurants
  self.restaurants = [];
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  self.markers.forEach(m => m.setMap(null));
  self.markers = [];
  self.restaurants = restaurants;
};

/**
 * Create all restaurants HTML and add them to the webpage.
 */
fillRestaurantsHTML = (restaurants = self.restaurants) => {
  const ul = document.getElementById('restaurants-list');
  restaurants.forEach(restaurant => {
    ul.append(createRestaurantHTML(restaurant));
  });
  if (window.google) {
    addMarkersToMap();
  }
};

createFavoriteHTML = restaurant => {
  const favoriteLabel = document.createElement('label');
  const favoriteText = document.createTextNode('Favorite');
  const favoriteInput = document.createElement('input');
  favoriteInput.type = 'checkbox';
  favoriteInput.checked =
    restaurant.is_favorite === 'true' ? 'checked' : undefined;
  favoriteInput.onchange = () => {
    if (!favoriteInput.getAttribute('data-in-flight')) {
      favoriteInput.setAttribute('data-in-flight', 'true');
      DBHelper.toggleRestaurantFavorite(restaurant, !!favoriteInput.checked)
        .then(restaurant => {
          favoriteInput.checked =
            restaurant.is_favorite === 'true' ? 'checked' : undefined;
          favoriteInput.removeAttribute('data-in-flight');
        })
        .catch(() => {
          favoriteInput.removeAttribute('data-in-flight');
        });
    }
  };
  favoriteLabel.append(favoriteInput);
  favoriteLabel.append(favoriteText);
  return favoriteLabel;
};

/**
 * Create restaurant HTML.
 */
createRestaurantHTML = restaurant => {
  const li = document.createElement('li');
  li.className = 'restaurant-card';

  const imageContainer = document.createElement('div');
  imageContainer.className = 'restaurant-img-container';

  const imgUrl = DBHelper.imageUrlForRestaurant(restaurant);
  const image = document.createElement('picture');
  const source1 = document.createElement('source');
  source1.srcset = `${imgUrl}.webp`;
  const source2 = document.createElement('source');
  source2.srcset = `${imgUrl}.jpg`;
  const img = document.createElement('img');
  img.className = 'restaurant-img';
  img.src = `${imgUrl}.jpg`;
  img.alt = restaurant.name;
  image.appendChild(source1);
  image.appendChild(source2);
  image.appendChild(img);
  imageContainer.append(image);
  li.append(imageContainer);

  const name = document.createElement('h2');
  name.className = 'restaurant-title';
  name.innerHTML = restaurant.name;
  li.append(name);

  const neighborhood = document.createElement('p');
  neighborhood.className = 'restaurant-location';
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);

  const address = document.createElement('p');
  address.className = 'restaurant-address';
  address.innerHTML = restaurant.address;
  li.append(address);

  const actionContainer = document.createElement('div');
  actionContainer.className = 'restaurant-actions';
  const more = document.createElement('a');
  more.className = 'restaurant-link';
  more.innerHTML = 'View Details';
  more.href = DBHelper.urlForRestaurant(restaurant);
  actionContainer.append(more);
  actionContainer.append(createFavoriteHTML(restaurant));
  li.append(actionContainer);

  return li;
};

/**
 * Add markers for current restaurants to the map.
 */
addMarkersToMap = (restaurants = self.restaurants) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, 'click', () => {
      window.location.href = marker.url;
    });
    self.markers.push(marker);
  });
};
