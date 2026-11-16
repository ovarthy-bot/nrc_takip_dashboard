/* Ortak giriş kontrolü. Her uygulamanın <head> bölümünde en başta yüklenir. */
(function () {
  var HASH = 'ee0a5555ea6bc4b1d794b496a3167fe3c3822ca214f04cfb6a776d2e0024c31d';
  var PORTAL = 'https://ovarthy-bot.github.io/navigasyon/';
  var STORE = 'nav_gate_v1';

  // Sayfa içeriğini doğrulama bitene kadar gizle
  var style = document.createElement('style');
  style.textContent = 'html{visibility:hidden}';
  document.head.appendChild(style);
  function reveal() { style.remove(); }
  function deny() { location.replace(PORTAL); }

  function toBytes(b64) {
    var s = atob(b64), a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }
  function check(b64) {
    var data;
    try { data = toBytes(b64); } catch (e) { return Promise.resolve(false); }
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      var hex = Array.prototype.map.call(new Uint8Array(buf), function (x) {
        return ('0' + x.toString(16)).slice(-2);
      }).join('');
      return hex === HASH;
    }).catch(function () { return false; });
  }
  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; }
  }
  // Sunucu tarafı (ör. PDF) kontrolü için aynı bileti çerez olarak da yaz
  function setCookie(k) {
    try { document.cookie = 'nav_k=' + encodeURIComponent(k) + '; Path=/; Max-Age=34560000; SameSite=Strict' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (e) {}
  }
  function clearStore() { try { localStorage.removeItem(STORE); } catch (e) {} }

  var m = location.hash.match(/[#&]k=([^&]+)/);
  if (m) {
    // Portaldan gelen bilet
    var k = decodeURIComponent(m[1]);
    check(k).then(function (ok) {
      if (!ok) return deny();
      try { localStorage.setItem(STORE, JSON.stringify({ k: k })); } catch (e) {}
      setCookie(k);
      history.replaceState(null, '', location.pathname + location.search);
      reveal();
    });
  } else {
    // Daha önce girilmiş ve oturumu geçerli olan tarayıcı
    var s = readStore();
    if (s && s.k) {
      check(s.k).then(function (ok) {
        if (ok) { setCookie(s.k); reveal(); } else { clearStore(); deny(); }
      });
    } else {
      clearStore();
      deny();
    }
  }
})();
