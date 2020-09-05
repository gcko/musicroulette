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

/* global chrome:readonly, _:readonly */
((chrome, gapi) => {
  const KEY_WEDDING = 'wedding',
    KEY_TOP10 = 'top10',
    YOUTUBE_API_KEY = Config.YOUTUBE_API_KEY,
    loginContainer = document.getElementById('login-container'),
    btnLogin = document.getElementById('login'),
    btnWedding = document.getElementById('wedding-music'),
    btnEl = document.getElementById('find-music'),
    btnSpinWheel = document.getElementById('spin'),
    resultsEl = document.getElementById('results'),
    spinSectionEl = document.getElementById('spinner-container'),
    wheelWedgeEls = spinSectionEl.getElementsByTagName('strong'),
    storage = chrome.storage,
    // TODO use storage instead, this is for testing
    simpleCache = {};

  // Store the winning element after each spin
  let winningEl;

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

  function handleComplexResponse(response, cacheKey) {
    // cache the response
    simpleCache[cacheKey] = response;

    const result = response.result;
    // Show some of the basic attributes of each video
    if (result.items && result.items instanceof Array) {
      // populate the wheel with 8 items from the response
      for (let i = 0; i < 8; i += 1) {
        wheelWedgeEls[i].innerText = result.items[i].snippet.title;
        wheelWedgeEls[i].dataset.item = JSON.stringify(result.items[i]);
      }
      // show the spinner if it wasn't shown already
      removeClass(spinSectionEl, 'hidden');
    }
  }

  function createItemHtml(item) {
    return `
        <iframe 
          class="media-container" 
          src="https://www.youtube.com/embed/${item.id}" 
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen></iframe>
        `;
  }

  function getPlaylist(playlistId) {
    if (simpleCache[KEY_WEDDING] != null) {
      // TODO begin using Chrome Storage, use CryptoJS.MD5
      //  to create a hash that can be authenticated against
      // use what is in the cache
      return handleComplexResponse(simpleCache[KEY_WEDDING], KEY_WEDDING);
    }

    return gapi.client.youtube.playlistItems
      .list({
        part: ['id,snippet,contentDetails'],
        maxResults: 50,
        playlistId: playlistId,
      })
      .then(
        (response) => handleComplexResponse(response, KEY_WEDDING),
        (err) => console.error(err)
      );
  }

  // Make sure the client is loaded and sign-in is complete before calling this method.
  function getTop10() {
    if (simpleCache[KEY_TOP10] != null) {
      return handleComplexResponse(simpleCache[KEY_TOP10], KEY_TOP10);
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
        (response) => handleComplexResponse(response, KEY_TOP10),
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

  function handleSpinClick() {
    if (winningEl) {
      // remove the link from the soon to be previous winning element
      winningEl.classList.remove('up-z-index');
      // Clicking on a 'roulette' button on the top would remove the a tag, so need to check for existence
      if (winningEl.getElementsByTagName('a').length > 0) {
        winningEl.getElementsByTagName(
          'strong'
        )[0].innerHTML = winningEl.getElementsByTagName('a')[0].innerText;
      }
    }
    const min = 1024; //min value
    const max = 9999; // max value
    const deg = Math.floor(Math.random() * (min - max)) + max;

    // rotate the wheel
    document.getElementById('boxes').style.transform = `rotate(${deg}deg)`;

    const mainSpinBoxEl = document.getElementById('spin-main-box');

    function setWinner() {
      // Get the height of the main spin box, divide by 2 to get the approximate location of the item to activate
      const boundingBox = mainSpinBoxEl.getBoundingClientRect();
      const targetX = boundingBox.right - 20;
      const targetY = boundingBox.top + boundingBox.height / 2;
      const elements = document.elementsFromPoint(targetX, targetY);
      winningEl = elements.find((el) => el.tagName === 'SPAN');
      winningEl.classList.add('up-z-index');
      const winningElText = winningEl.getElementsByTagName('strong')[0];
      const item = JSON.parse(winningElText.dataset.item);
      winningEl.innerHTML = `
        <strong>
          <a href="https://www.youtube.com/watch?v=${item.id}" target="_blank" title="${winningElText.innerText}">${winningElText.innerText}</a>
        </strong>
        `;
      resultsEl.innerHTML = createItemHtml(item);
    }

    mainSpinBoxEl.classList.remove('animate');
    setTimeout(() => {
      mainSpinBoxEl.classList.add('animate');
      setWinner();
    }, 5000);
  }

  btnSpinWheel.addEventListener('click', handleSpinClick);

  // get or create key to store data
  // storage.sync.get(STORAGE_KEY_MUSIC, (items) => {
  //   if (items[STORAGE_KEY_MUSIC] != null) {
  //     // Value defaults to an empty string if there is no stored value
  //     resultsEl.innerText = JSON.stringify(items[STORAGE_KEY_MUSIC]);
  //   }
  // });
})(chrome, gapi);
