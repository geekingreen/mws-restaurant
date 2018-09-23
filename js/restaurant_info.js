let restaurant;
var map;

window.onload = () => {
  fetchRestaurantFromURL().then(fillBreadcrumb);
  setTimeout(() => {
    const mapsScript = document.createElement('script');

    mapsScript.src =
      'https://maps.googleapis.com/maps/api/js?key=AIzaSyA1e64IZL8X_1_I0kg4D0v1zWydW3eXkOc&libraries=places&callback=initMap';

    document.querySelector('body').appendChild(mapsScript);
  }, 1000);
};

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  fetchRestaurantFromURL()
    .then(restaurant => {
      self.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 16,
        center: restaurant.latlng,
        scrollwheel: false
      });
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    })
    .catch(err => console.error(err));
};

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = () => {
  if (self.restaurant) {
    // restaurant already fetched!
    return Promise.resolve(self.restaurant);
  }
  const id = getParameterByName('id');
  if (!id) {
    // no id found in URL
    return Promise.reject('No restaurant id in URL');
  } else {
    return DBHelper.fetchRestaurantById(id)
      .then(restaurant => {
        self.restaurant = restaurant;
        fillRestaurantHTML();
        return restaurant;
      })
      .catch(err => console.error(err));
  }
};

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const imgUrl = DBHelper.imageUrlForRestaurant(restaurant);
  const image = document.getElementById('restaurant-img');
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

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  fillReviewsHTML();
};

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (
  operatingHours = self.restaurant.operating_hours
) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
};

createReviewForm = e => {
  const restaurant = self.restaurant;
  const form = document.createElement('form');
  form.className = 'review-form';

  const heading = document.createElement('h3');
  heading.innerText = 'Leave a review';

  const nameLabel = document.createElement('label');
  nameLabel.innerHTML = 'Name: ';
  const nameInput = document.createElement('input');
  nameInput.name = 'name';
  nameLabel.appendChild(nameInput);

  const ratingLabel = document.createElement('label');
  ratingLabel.innerHTML = 'Rating: ';
  const ratingInput = document.createElement('input');
  ratingInput.name = 'rating';
  ratingInput.type = 'number';
  ratingInput.min = 1;
  ratingInput.max = 5;
  ratingLabel.appendChild(ratingInput);

  const commentLabel = document.createElement('label');
  commentLabel.innerHTML = 'Comments: <br />';
  const commentInput = document.createElement('textarea');
  commentInput.name = 'comments';
  commentLabel.appendChild(commentInput);

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.innerHTML = 'Submit Comment';

  form.appendChild(heading);
  form.appendChild(nameLabel);
  form.appendChild(ratingLabel);
  form.appendChild(commentLabel);
  form.appendChild(submitButton);

  form.onsubmit = e => {
    e.preventDefault();
    DBHelper.submitRestaurantReview(e, restaurant)
      .then(review => {
        const reviewsList = document.getElementById('reviews-list');
        reviewsList.appendChild(createReviewHTML(review));
        form.reset();
      })
      .catch(err => console.error(err));
  };

  return form;
};

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews = self.restaurant.reviews) => {
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h2');
  title.innerHTML = 'Reviews';
  container.appendChild(title);

  if (!reviews || reviews.length === 0) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    container.appendChild(createReviewForm());
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
  container.appendChild(createReviewForm());
};

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = review => {
  const li = document.createElement('li');
  li.classList.add('reviews-list-item');
  const name = document.createElement('p');
  name.classList.add('reviews-list-item__name');
  name.innerHTML = review.name;
  li.appendChild(name);

  const date = document.createElement('p');
  const reviewDate = new Date(review.createdAt);
  date.classList.add('reviews-list-item__date');
  date.innerHTML = `${reviewDate.getMonth() +
    1}/${reviewDate.getDate()}/${reviewDate.getFullYear()}`;
  li.appendChild(date);

  const rating = document.createElement('p');
  rating.classList.add('reviews-list-item__rating');
  rating.innerHTML = `Rating: ${review.rating}`;
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.classList.add('reviews-list-item__comments');
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  return li;
};

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant = self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.className = 'breadcrumb-item';
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
};

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) =>
  new URL(url || window.location.href).searchParams.get(name);
