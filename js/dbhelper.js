/**
 * Common database helper functions.
 */
class DBHelper {
  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337; // Change this to your server port
    return `http://localhost:${port}`;
  }

  static fetch(uri, options = {}) {
    return fetch(uri, options).then(res => res.json());
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants() {
    return this.restaurantPromise
      ? this.restaurantPromise
      : (this.restaurantPromise = DBHelper.fetch(
          `${DBHelper.DATABASE_URL}/restaurants`
        ));
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static async fetchRestaurantById(id) {
    const restaurant = await DBHelper.fetch(
      `${DBHelper.DATABASE_URL}/restaurants/${id}`
    );
    const reviews = await DBHelper.fetchRestaurantReviewsById(id);
    return {
      ...restaurant,
      reviews
    };
  }

  static fetchRestaurantReviewsById(id) {
    return DBHelper.fetch(
      `${DBHelper.DATABASE_URL}/reviews/?restaurant_id=${id}`
    );
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static async fetchRestaurantByCuisine(cuisine) {
    const restaurants = await DBHelper.fetchRestaurants();
    return restaurants.filter(r => r.cuisine_type == cuisine);
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static async fetchRestaurantByNeighborhood(neighborhood) {
    const restaurants = await DBHelper.fetchRestaurants();
    return restaurants.filter(r => r.neighborhood == neighborhood);
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static async fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood) {
    let restaurants = await DBHelper.fetchRestaurants();
    if (cuisine != 'all') {
      // filter by cuisine
      restaurants = restaurants.filter(r => r.cuisine_type == cuisine);
    }
    if (neighborhood != 'all') {
      // filter by neighborhood
      restaurants = restaurants.filter(r => r.neighborhood == neighborhood);
    }
    return restaurants;
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static async fetchNeighborhoods() {
    const restaurants = await DBHelper.fetchRestaurants();
    const neighborhoods = restaurants.map(
      (v, i) => restaurants[i].neighborhood
    );
    // Remove duplicates from neighborhoods
    const uniqueNeighborhoods = neighborhoods.filter(
      (v, i) => neighborhoods.indexOf(v) == i
    );
    return uniqueNeighborhoods;
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static async fetchCuisines() {
    const restaurants = await DBHelper.fetchRestaurants();
    const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
    // Remove duplicates from cuisines
    const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i);
    return uniqueCuisines;
  }

  static toggleRestaurantFavorite(restaurant, isFavorite) {
    return DBHelper.fetch(
      `${DBHelper.DATABASE_URL}/restaurants/${
        restaurant.id
      }?is_favorite=${isFavorite}`,
      { method: 'PUT' }
    );
  }

  static submitRestaurantReview(e, restaurant) {
    const jsonData = {
      restaurant_id: restaurant.id
    };
    e.target
      .querySelectorAll('input,textarea')
      .forEach(input => (jsonData[input.name] = input.value));
    return DBHelper.fetch(`${DBHelper.DATABASE_URL}/reviews`, {
      method: 'POST',
      body: JSON.stringify(jsonData)
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return `./restaurant.html?id=${restaurant.id}`;
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    return restaurant.photograph
      ? `/img/${restaurant.photograph}`
      : '/img/not-found';
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP
    });
    return marker;
  }
}
