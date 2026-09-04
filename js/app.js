document.addEventListener('DOMContentLoaded', function () {
  var animatedHeadline = document.querySelector('.hero-script-headline-animated');
  if (animatedHeadline) {
    var characterIndex = 0;
    animatedHeadline.querySelectorAll('.headline-line').forEach(function (line) {
      var text = line.textContent;
      line.textContent = '';
      Array.from(text).forEach(function (character) {
        var characterEl = document.createElement('span');
        characterEl.className = 'headline-character';
        characterEl.textContent = character === ' ' ? '\u00A0' : character;
        characterEl.style.setProperty('--character-index', characterIndex++);
        line.appendChild(characterEl);
      });
    });
  }

  var widget = document.getElementById('weather-widget');
  if (!widget) return;
  var content = widget.querySelector('.weather-content');
  var toggleEl = widget.querySelector('.weather-toggle');
  var unitBtns = widget.querySelectorAll('.unit-btn');
  var indicator = widget.querySelector('.unit-indicator');
  var currentWeather = null;
  var unit = localStorage.getItem('weather-unit') || 'F';

  function setContent(emoji, tempDisplay, desc) {
    content.innerHTML = '' +
      '<div class="weather-emoji" aria-hidden="true">' + emoji + '</div>' +
      '<div class="weather-temp">' + tempDisplay + '\u00B0' + unit + '</div>' +
      '<div class="weather-desc">' + desc + '</div>';
  }

  function setNote(msg) {
    content.innerHTML = '<div class="weather-desc">' + msg + '</div>';
  }

  function requestLocation(attempt) {
    attempt = typeof attempt === 'number' ? attempt : 1;
    setNote('Just figuring out where you are. For weather purposes. Obviously.');
    navigator.geolocation.getCurrentPosition(function (pos) {
      fetchWeather(pos.coords.latitude, pos.coords.longitude);
    }, function (err) {
      console.warn('Geolocation error', err);
      if (attempt < 3) {
        setTimeout(function () { requestLocation(attempt + 1); }, 350);
      } else {
        setPermissionDisclaimer();
      }
    }, {timeout: 10000});
  }

  function setPermissionDisclaimer() {
    content.innerHTML = '' +
      '<div class="weather-permission">' +
      '<div class="weather-desc">Location is off.</div>' +
      '<div class="weather-permission-note">Enable it to see today\'s weather — I won\'t set you up, just the forecast.</div>' +
      '<div class="weather-permission-actions">' +
      '<button class="btn" id="retry-location">Retry</button>' +
      '<button class="btn weather-manual-btn" id="use-manual">Enter City</button>' +
      '</div>' +
      '</div>';
    var retry = content.querySelector('#retry-location');
    if (retry) retry.addEventListener('click', function () { requestLocation(); });
    var manual = content.querySelector('#use-manual');
    if (manual) manual.addEventListener('click', function () {
      var city = prompt('Enter city or coordinates (lat,lon)');
      if (!city) return;
      var parts = city.split(',');
      if (parts.length === 2) {
        var lat = parseFloat(parts[0].trim());
        var lon = parseFloat(parts[1].trim());
        if (!isNaN(lat) && !isNaN(lon)) {
          fetchWeather(lat, lon);
          return;
        }
      }
      alert('Please enter coordinates as "lat,lon" (e.g. 40.71,-74.01)');
    });
  }

  function updateToggleUI() {
    unitBtns.forEach(function (b) {
      var isActive = b.getAttribute('data-unit') === unit;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    if (indicator) {
      var vertical = window.getComputedStyle(toggleEl).flexDirection === 'column' || toggleEl.offsetHeight > toggleEl.offsetWidth;
      indicator.style.transform = vertical
        ? (unit === 'F' ? 'translateY(0)' : 'translateY(100%)')
        : (unit === 'F' ? 'translateX(0)' : 'translateX(100%)');
    }
  }

  function codeToEmoji(code) {
    if (code === 0) return {emoji: '☀️', desc: 'Clear'};
    if (code === 1 || code === 2) return {emoji: '🌤️', desc: 'Partly cloudy'};
    if (code === 3) return {emoji: '☁️', desc: 'Overcast'};
    if ((code >= 45 && code <= 48) || (code >= 56 && code <= 57)) return {emoji: '🌫️', desc: 'Fog'};
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 86)) return {emoji: '🌧️', desc: 'Rain'};
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return {emoji: '❄️', desc: 'Snow'};
    if (code >= 95) return {emoji: '⛈️', desc: 'Thunderstorms'};
    return {emoji: '🌤️', desc: 'Mixed'};
  }

  function fetchWeather(lat, lon) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(lat) + '&longitude=' + encodeURIComponent(lon) + '&current_weather=true&timezone=auto';
    fetch(url).then(function (res) {
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    }).then(function (data) {
      if (!data || !data.current_weather) {
        setNote('Weather unavailable');
        return;
      }
      currentWeather = { tempC: data.current_weather.temperature, code: data.current_weather.weathercode };
      renderFromCurrent();
    }).catch(function (err) {
      setNote('Unable to load weather');
      console.error(err);
    });
  }

  function renderFromCurrent() {
    if (!currentWeather) return;
    var info = codeToEmoji(currentWeather.code);
    var temperature = unit === 'F'
      ? Math.round((currentWeather.tempC * 9/5) + 32)
      : Math.round(currentWeather.tempC);
    setContent(info.emoji, temperature, info.desc);
  }

  if (!('geolocation' in navigator)) {
    setPermissionDisclaimer();
  } else if (navigator.permissions && navigator.permissions.query) {
    try {
      navigator.permissions.query({ name: 'geolocation' }).then(function (perm) {
        if (perm.state === 'granted' || perm.state === 'prompt') requestLocation();
        else setPermissionDisclaimer();
        perm.onchange = function () { if (perm.state === 'granted') requestLocation(); };
      }).catch(function () { requestLocation(); });
    } catch (e) {
      requestLocation();
    }
  } else {
    requestLocation();
  }

  updateToggleUI();
  if (toggleEl) {
    toggleEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.unit-btn');
      if (!btn) return;
      var selected = btn.getAttribute('data-unit');
      if (selected === unit) return;
      unit = selected;
      localStorage.setItem('weather-unit', unit);
      updateToggleUI();
      renderFromCurrent();
    });
  }
  window.addEventListener('resize', updateToggleUI);
});