/* eslint-disable no-console */
/* Copyright 2012-2020 Jared M. Scott */
/**
 * This work is licensed under the Creative Commons Attribution 3.0 Un-ported License.
 *  To view a copy of this license, visit http://creativecommons.org/licenses/by/3.0/
 *  or send a letter to
 *      Creative Commons,
 *      444 Castro Street, Suite 900,
 *      Mountain View, California, 94041, USA.
 */
const WEDDING_PLAYLIST_ID = 'PL4Q6BZ1bLklGRTJj3WaTQkCKLg26elqCy';

function addClass(el, cls) {
  return el.classList.add(cls);
}

function removeClass(el, cls) {
  return el.classList.remove(cls);
}

function getKindOfRandomNum(upperBound = 50) {
  if (upperBound < 0 || upperBound > 100) {
    throw new RangeError(
      `upperBound: '${upperBound}' needs to be between 0 and 100`
    );
  }
  const randomNum = Math.random() * 100;
  return randomNum > upperBound
    ? Math.floor(randomNum % upperBound)
    : Math.floor(randomNum);
}

/* global chrome:readonly, _:readonly */
((chrome, gapi) => {
  const KEY_MUSIC = 'music',
    KEY_WEDDING = 'wedding',
    KEY_TOP10 = 'top10',
    YOUTUBE_API_KEY = '***REMOVED***',
    CLIENT_ID =
      '900938017335-jpaqa4r02mjulqk40dcsa7ejak7fbk8v.apps.googleusercontent.com',
    loginContainer = document.getElementById('login-container'),
    btnLogin = document.getElementById('login'),
    btnWedding = document.getElementById('wedding-music'),
    btnEl = document.getElementById('find-music'),
    resultsEl = document.getElementById('results'),
    storage = chrome.storage,
    // TODO use storage instead, this is for testing
    simpleCache = {};

  function isSignedIn() {
    return gapi.auth2.getAuthInstance().isSignedIn.get();
  }

  function authenticate() {
    if (isSignedIn()) {
      console.log('User is already signed in');
      return gapi.auth2.getAuthInstance();
    }
    return gapi.auth2
      .getAuthInstance()
      .signIn({ scope: 'https://www.googleapis.com/auth/youtube.readonly' })
      .then(
        function () {
          console.log('Sign-in successful');
        },
        function (err) {
          console.error('Error signing in', err);
        }
      );
  }
  function loadClient() {
    gapi.client.setApiKey(YOUTUBE_API_KEY);
    return gapi.client
      .load('https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest')
      .then(
        function () {
          console.log('GAPI client loaded for API');
        },
        function (err) {
          console.error('Error loading GAPI client for API', err);
        }
      );
  }

  function handleResponse(response, cacheKey) {
    // cache the response
    simpleCache[cacheKey] = response;

    const result = response.result;
    // Handle the results here (response.result has the parsed body).
    let itemsHtml = '';
    // Show some of the basic attributes of each video
    if (result.items && result.items instanceof Array) {
      // pick a random item
      let item = result.items[getKindOfRandomNum()];
      // Check if snippet.resourceId.videoId is used
      if (item.snippet?.resourceId?.videoId) {
        // set the value to item.id
        item.id = item.snippet.resourceId.videoId;
      }
      itemsHtml = createItemHtml(item);
    }
    resultsEl.innerHTML = itemsHtml;
  }

  function createItemsHtml(items) {
    let itemsHtml = '';
    items.forEach((item) => {
      itemsHtml += createItemHtml(item);
    });
    return itemsHtml;
  }

  function createItemHtml(item) {
    return `
                <p><a href="https://www.youtube.com/watch?v=${item.id}">${item.snippet.title}</a></p>
                <iframe class="media-container" src="https://www.youtube.com/embed/${item.id}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
              `;
  }

  function getPlaylist(playlistId) {
    if (simpleCache[KEY_WEDDING] != null) {
      // TODO begin using Chrome Storage, use CryptoJS.MD5
      //  to create a hash that can be authenticated against
      // use what is in the cache
      return handleResponse(simpleCache[KEY_WEDDING], KEY_WEDDING);
    }

    return gapi.client.youtube.playlistItems
      .list({
        part: ['id,snippet,contentDetails'],
        maxResults: 50,
        playlistId: playlistId,
      })
      .then(
        (response) => handleResponse(response, KEY_WEDDING),
        (err) => console.error(err)
      );
  }

  // Make sure the client is loaded and sign-in is complete before calling this method.
  function getTop10() {
    if (simpleCache[KEY_TOP10] != null) {
      return handleResponse(simpleCache[KEY_TOP10], KEY_TOP10);
    }
    return gapi.client.youtube.videos
      .list({
        part: ['snippet,contentDetails,statistics'],
        chart: 'mostPopular',
        maxResults: 50,
        hl: 'en_US',
        regionCode: 'TW',
        videoCategoryId: '10', // music category
      })
      .then(
        (response) => handleResponse(response, KEY_TOP10),
        (err) => console.error(err)
      );
  }

  gapi.load('client:auth2', function () {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (token) {
        console.log(`token received: ${token}`);
        loadClient();
      } else {
        console.error('No authorization. Error: ' + chrome.runtime.lastError);
      }
    });
    // gapi.auth2
    //   .init({
    //     client_id: CLIENT_ID,
    //     scope: 'https://www.googleapis.com/auth/youtube.readonly',
    //   })
    //   .then(() => {
    //     if (!isSignedIn()) {
    //       console.log('not logged in, show the button');
    //       removeClass(loginContainer, 'hidden');
    //     } else {
    //       // logged in, load the client only
    //       console.log('logged in, load the client only');
    //       gapi.auth2.getAuthInstance().then(loadClient);
    //     }
    //   });
  });
  btnLogin.addEventListener('click', () => {
    authenticate()
      .then(loadClient)
      .then(() => {
        addClass(loginContainer, 'hidden');
      });
  });
  btnEl.addEventListener('click', () => {
    // Authenticate, call YouTube API and populate results div
    getTop10();
  });
  btnWedding.addEventListener('click', () => {
    getPlaylist(WEDDING_PLAYLIST_ID);
  });

  // get or create key to store data
  // storage.sync.get(STORAGE_KEY_MUSIC, (items) => {
  //   if (items[STORAGE_KEY_MUSIC] != null) {
  //     // Value defaults to an empty string if there is no stored value
  //     resultsEl.innerText = JSON.stringify(items[STORAGE_KEY_MUSIC]);
  //   }
  // });
})(chrome, gapi);
