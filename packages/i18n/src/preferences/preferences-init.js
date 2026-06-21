(function () {
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  try {
    var storedTheme = getCookie('vs_theme');
    var theme =
      storedTheme === 'dark' || storedTheme === 'light'
        ? storedTheme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    document.documentElement.setAttribute('data-theme', theme);

    var storedLocale = getCookie('vs_locale');
    var locale = storedLocale === 'en' || storedLocale === 'es' ? storedLocale : null;

    if (!locale) {
      var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'es'];
      for (var i = 0; i < langs.length; i++) {
        var code = (langs[i] || '').toLowerCase().split('-')[0];
        if (code === 'en') {
          locale = 'en';
          break;
        }
        if (code === 'es') {
          locale = 'es';
          break;
        }
      }
      if (!locale) locale = 'es';
    }

    document.documentElement.lang = locale;
  } catch (_e) {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.lang = 'es';
  }
})();
