/* Silva Prado Advocacia: comportamento comum a todas as páginas.
   1. Marcador de origem: lê ?via=canal (e gclid ou msclkid, quando a visita vem de anúncio) e guarda no próprio
      navegador (localStorage deste site). Sem cookie, sem pixel, sem script de terceiro.
   2. Botões de WhatsApp: só existem quando config.py tem o número; a mensagem leva o código de origem.
   3. Formulário de contato: monta os dados e mostra o aviso. O envio só acontece se config.py tiver
      FORMULARIO_DESTINO (ponto de encaixe descrito no LEIA.md). */
(function () {
  "use strict";

  var CHAVE = "sp_origem";

  function lerJSON(id) {
    var el = document.getElementById(id);
    if (!el) return {};
    try { return JSON.parse(el.textContent) || {}; } catch (e) { return {}; }
  }
  var cfg = lerJSON("sp-config");

  function abrirArmazenamento() {
    try {
      var s = window.localStorage;
      s.setItem("__sp", "1");
      s.removeItem("__sp");
      return s;
    } catch (e) {
      return null;
    }
  }
  var armazenamento = abrirArmazenamento();

  function limpar(valor, padrao, max) {
    if (!valor) return "";
    return String(valor).replace(padrao, "").slice(0, max);
  }

  function novoCodigo() {
    var letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var bytes = null;
    try { bytes = window.crypto.getRandomValues(new Uint8Array(6)); } catch (e) { bytes = null; }
    var s = "";
    for (var i = 0; i < 6; i++) {
      var n = bytes ? bytes[i] : Math.floor(Math.random() * 256);
      s += letras.charAt(n % letras.length);
    }
    return s;
  }

  function lerOrigem() {
    if (!armazenamento) return {};
    try { return JSON.parse(armazenamento.getItem(CHAVE) || "{}") || {}; } catch (e) { return {}; }
  }

  function gravarOrigem(o) {
    if (!armazenamento) return;
    try { armazenamento.setItem(CHAVE, JSON.stringify(o)); } catch (e) { /* sem espaço ou bloqueado: segue sem guardar */ }
  }

  // ------------------------------------------------------------------ 1. origem da visita
  var origem = lerOrigem();
  var params;
  try { params = new URLSearchParams(window.location.search); } catch (e) { params = null; }
  if (params) {
    var via = limpar((params.get("via") || "").toLowerCase(), /[^a-z0-9_-]/g, 40);
    var gclid = limpar(params.get("gclid"), /[^A-Za-z0-9_-]/g, 200);
    var msclkid = limpar(params.get("msclkid"), /[^A-Za-z0-9_-]/g, 200);
    var hoje = new Date().toISOString().slice(0, 10);
    if (via) {
      if (!origem.via_primeira) origem.via_primeira = via;
      origem.via = via;
      origem.via_em = hoje;
      origem.entrada = window.location.pathname;
    }
    if (gclid) { origem.gclid = gclid; origem.clique_em = hoje; }
    if (msclkid) { origem.msclkid = msclkid; origem.clique_em = hoje; }
  }
  if (!origem.codigo) origem.codigo = novoCodigo();
  gravarOrigem(origem);
  window.SPOrigem = function () { return JSON.parse(JSON.stringify(origem)); };

  function linhaCodigo() {
    return "Código do site: " + origem.codigo + (origem.via ? " (" + origem.via + ")" : "");
  }

  function registrarEvento(nome) {
    if (!cfg.eventosDestino) return;
    var dados = JSON.stringify({
      evento: nome,
      pagina: window.location.pathname,
      via: origem.via || "",
      via_primeira: origem.via_primeira || "",
      gclid: origem.gclid || "",
      msclkid: origem.msclkid || "",
      codigo: origem.codigo,
      momento: new Date().toISOString()
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(cfg.eventosDestino, new Blob([dados], { type: "text/plain;charset=utf-8" }));
      } else {
        fetch(cfg.eventosDestino, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: dados, keepalive: true });
      }
    } catch (e) { /* o registro nunca impede o contato */ }
  }

  function linkWhatsApp(texto) {
    return "https://wa.me/" + cfg.whatsapp + "?text=" + encodeURIComponent(texto);
  }

  // ------------------------------------------------------------------ 2. botões de WhatsApp
  var botoes = document.querySelectorAll("a[data-whatsapp]");
  for (var i = 0; i < botoes.length; i++) {
    (function (a) {
      var assunto = a.getAttribute("data-assunto") || "um atendimento";
      var texto = "Olá. Vim pelo site da Silva Prado Advocacia e quero informações sobre " + assunto + ".\n" + linhaCodigo();
      a.setAttribute("href", linkWhatsApp(texto));
      a.addEventListener("click", function () { registrarEvento("whatsapp"); });
    })(botoes[i]);
  }

  // menu do celular fecha ao escolher um destino
  var menuMovel = document.querySelector(".menu-movel");
  if (menuMovel) {
    menuMovel.addEventListener("click", function (ev) {
      if (ev.target && ev.target.tagName === "A") menuMovel.removeAttribute("open");
    });
  }

  // ------------------------------------------------------------------ 3. formulário de contato
  var form = document.getElementById("formulario-contato");
  if (!form) return;
  var retorno = form.querySelector(".formulario-retorno");

  function valor(nome) {
    var el = form.elements[nome];
    if (!el) return "";
    if (el.length && !el.tagName) { // grupo de rádios
      for (var j = 0; j < el.length; j++) if (el[j].checked) return el[j].value;
      return "";
    }
    return String(el.value || "").trim();
  }

  function marcarErro(nome, texto) {
    var el = form.elements[nome];
    if (!el || !el.tagName) return;
    el.setAttribute("aria-invalid", "true");
    var msg = document.createElement("p");
    msg.className = "erro-campo";
    msg.id = "erro-" + nome;
    msg.textContent = texto;
    el.setAttribute("aria-describedby", msg.id);
    el.parentNode.appendChild(msg);
  }

  function limparErros() {
    var antigos = form.querySelectorAll(".erro-campo");
    for (var j = 0; j < antigos.length; j++) antigos[j].parentNode.removeChild(antigos[j]);
    var invalidos = form.querySelectorAll("[aria-invalid]");
    for (var k = 0; k < invalidos.length; k++) {
      invalidos[k].removeAttribute("aria-invalid");
      if (invalidos[k].id === "f-mensagem") invalidos[k].setAttribute("aria-describedby", "f-mensagem-dica");
      else invalidos[k].removeAttribute("aria-describedby");
    }
  }

  var ROTULOS = { inventario: "inventário", divorcio: "divórcio ou fim de união estável", outro: "outro assunto" };
  function assuntoLegivel(dados) {
    return ROTULOS[dados.assunto] || dados.assunto_pagina || "um atendimento";
  }

  function el(tag, texto) {
    var e = document.createElement(tag);
    if (texto) e.textContent = texto;
    return e;
  }

  function resumo(dados) {
    var dl = el("dl");
    var campos = [["Nome", dados.nome], ["Contato", dados.contato + " (" + dados.preferencia + ")"],
      ["Cidade", dados.cidade || "não informada"], ["Assunto", assuntoLegivel(dados)],
      ["Mensagem", dados.mensagem || "sem mensagem"], ["Origem", (dados.origem.via || "direto") + ", código " + dados.origem.codigo]];
    for (var j = 0; j < campos.length; j++) {
      dl.appendChild(el("dt", campos[j][0]));
      dl.appendChild(el("dd", campos[j][1]));
    }
    return dl;
  }

  function alternativas(dados) {
    var p = el("p");
    var texto = "Olá, sou " + dados.nome + ". Quero informações sobre " + assuntoLegivel(dados) + "." +
      (dados.mensagem ? "\n" + dados.mensagem : "") + (dados.cidade ? "\nCidade: " + dados.cidade : "") + "\n" + linhaCodigo();
    if (cfg.whatsapp) {
      var a = el("a", "Mandar esta mensagem pelo WhatsApp");
      a.href = linkWhatsApp(texto);
      a.rel = "noopener";
      a.target = "_blank";
      a.addEventListener("click", function () { registrarEvento("whatsapp_formulario"); });
      p.appendChild(a);
    }
    if (cfg.email) {
      if (p.childNodes.length) p.appendChild(document.createTextNode(" ou "));
      var m = el("a", "mandar por e-mail");
      m.href = "mailto:" + cfg.email + "?subject=" + encodeURIComponent("Contato pelo site: " + assuntoLegivel(dados)) +
        "&body=" + encodeURIComponent(texto);
      p.appendChild(m);
    }
    return p.childNodes.length ? p : null;
  }

  function mostrar(nos) {
    retorno.innerHTML = "";
    for (var j = 0; j < nos.length; j++) if (nos[j]) retorno.appendChild(nos[j]);
    retorno.setAttribute("tabindex", "-1");
    retorno.focus();
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    limparErros();
    var dados = {
      nome: valor("nome"),
      preferencia: valor("preferencia"),
      contato: valor("contato"),
      cidade: valor("cidade"),
      assunto: valor("assunto"),
      mensagem: valor("mensagem"),
      assunto_pagina: form.getAttribute("data-assunto") || "",
      pagina: window.location.pathname,
      origem: window.SPOrigem(),
      enviado_em: new Date().toISOString()
    };
    if (valor("site")) { // armadilha preenchida: robô. Finge que foi e não manda nada.
      form.reset();
      mostrar([el("p", "Mensagem enviada. A resposta vem pelo canal que você indicou.")]);
      return;
    }
    var ok = true;
    if (!dados.nome) { marcarErro("nome", "Escreva seu nome."); ok = false; }
    if (!dados.contato) {
      marcarErro("contato", "Escreva um número com DDD ou um e-mail.");
      ok = false;
    } else if (dados.preferencia === "email" && dados.contato.indexOf("@") < 1) {
      marcarErro("contato", "Esse e-mail parece incompleto.");
      ok = false;
    } else if (dados.preferencia !== "email" && dados.contato.replace(/\D/g, "").length < 10) {
      marcarErro("contato", "Use o número com DDD, só algarismos ou com espaços.");
      ok = false;
    }
    if (!ok) {
      var primeiro = form.querySelector("[aria-invalid='true']");
      if (primeiro) primeiro.focus();
      return;
    }

    if (cfg.formularioDestino) {
      var botao = form.querySelector("button[type='submit']");
      botao.disabled = true;
      fetch(cfg.formularioDestino, {
        method: "POST",
        // text/plain evita a consulta prévia de CORS, que o script do Google (Apps Script) não responde
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(dados)
      }).then(function (r) {
        if (!r.ok) throw new Error("status " + r.status);
        registrarEvento("formulario");
        form.reset();
        mostrar([el("p", "Mensagem enviada. A resposta vem pelo canal que você indicou.")]);
      }).catch(function () {
        mostrar([el("p", "A mensagem não saiu agora. Tente de novo em alguns minutos ou use outro canal."), alternativas(dados)]);
      }).then(function () { botao.disabled = false; });
      return;
    }

    // Envio desligado (config.py sem FORMULARIO_DESTINO): só mostra o que seria enviado.
    mostrar([
      el("p", "O envio pelo site ainda não está ligado. Estes são os dados que iriam para o escritório:"),
      resumo(dados),
      alternativas(dados)
    ]);
  });
})();
