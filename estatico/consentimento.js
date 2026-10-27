/* consentimento.js: aviso de cookies do site da Silva Prado Advocacia (27/10/2026).
   O Google Analytics e o Microsoft Clarity só carregam depois do "Aceitar"; "Recusar" ou nenhuma resposta não carregam nada.
   A escolha fica no armazenamento local deste site ("sp-consentimento": "aceito" ou "recusado") e se muda pelo link
   "Preferências de cookies" do rodapé. Os identificadores vêm da configuração pública da página (#sp-config), que o
   gerar.py preenche a partir do config.py; sem identificador, não há aviso nem medição. */
(function () {
  "use strict";
  var CHAVE = "sp-consentimento";
  var cfg = {};
  try { cfg = JSON.parse(document.getElementById("sp-config").textContent); } catch (e) { return; }
  var ga = cfg.analyticsGA || "", clarity = cfg.analyticsClarity || "";
  if (!ga && !clarity) { return; }

  function ler() { try { return window.localStorage.getItem(CHAVE); } catch (e) { return null; } }
  function gravar(valor) { try { window.localStorage.setItem(CHAVE, valor); } catch (e) { /* sem armazenamento */ } }

  function carregar() {
    if (window.spMedicaoCarregada) { return; }
    window.spMedicaoCarregada = true;
    if (ga) {
      var s = document.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ga);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", ga);
    }
    if (clarity) {
      window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
      var c = document.createElement("script");
      c.async = true;
      c.src = "https://www.clarity.ms/tag/" + encodeURIComponent(clarity);
      document.head.appendChild(c);
    }
  }

  function fecharAviso() {
    var a = document.getElementById("sp-aviso-cookies");
    if (a) { a.parentNode.removeChild(a); }
  }

  function mostrarAviso() {
    if (document.getElementById("sp-aviso-cookies")) { return; }
    var politica = (document.querySelector('a[href$="politica-de-privacidade/"]') || {}).href || "/politica-de-privacidade/";
    var aviso = document.createElement("div");
    aviso.id = "sp-aviso-cookies";
    aviso.className = "aviso-cookies";
    aviso.setAttribute("role", "region");
    aviso.setAttribute("aria-label", "Aviso de cookies");
    aviso.innerHTML =
      '<p>Com a sua permissão, o site usa o Google Analytics e o Microsoft Clarity para medir as visitas e melhorar as ' +
      'páginas. Sem ela, nada disso é carregado. <a href="' + politica + '">Política de privacidade</a>.</p>' +
      '<div class="aviso-cookies-botoes">' +
      '<button type="button" class="botao botao-secundario" data-sp-recusar>Recusar</button>' +
      '<button type="button" class="botao" data-sp-aceitar>Aceitar</button></div>';
    document.body.appendChild(aviso);
    aviso.querySelector("[data-sp-aceitar]").addEventListener("click", function () {
      gravar("aceito"); fecharAviso(); carregar();
    });
    aviso.querySelector("[data-sp-recusar]").addEventListener("click", function () {
      var antes = ler();
      gravar("recusado"); fecharAviso();
      if (antes === "aceito") { window.location.reload(); } // descarrega o que já tinha sido carregado
    });
  }

  function iniciar() {
    var escolha = ler();
    if (escolha === "aceito") { carregar(); } else if (escolha !== "recusado") { mostrarAviso(); }
    var links = document.querySelectorAll("[data-sp-cookies]");
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener("click", function (ev) { ev.preventDefault(); mostrarAviso(); });
    }
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", iniciar); } else { iniciar(); }
})();
