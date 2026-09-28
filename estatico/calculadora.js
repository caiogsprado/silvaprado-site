/* Página da calculadora: liga o formulário ao núcleo (calc-nucleo.js) e escreve o resultado.
   As tabelas vêm embutidas na própria página (JSON gerado de dados/), então a conta funciona sem servidor. */
(function () {
  "use strict";

  var N = window.CalcNucleo;
  var form = document.getElementById("form-calculadora");
  var saida = document.getElementById("resultado");
  if (!N || !form || !saida) return;

  function lerJSON(id) {
    try { return JSON.parse(document.getElementById(id).textContent); } catch (e) { return null; }
  }
  var tabela = lerJSON("dados-emolumentos");
  var itcmd = lerJSON("dados-itcmd");
  if (!tabela || !itcmd) {
    saida.textContent = "A tabela de emolumentos não carregou. Recarregue a página.";
    return;
  }

  var R = N.formatarReais;
  var D = N.formatarData;

  function hoje() {
    var d = new Date();
    var m = String(d.getMonth() + 1);
    var dia = String(d.getDate());
    return d.getFullYear() + "-" + (m.length < 2 ? "0" + m : m) + "-" + (dia.length < 2 ? "0" + dia : dia);
  }

  var campoTotal = form.elements.total;
  var campoMeacao = form.elements.meacao;
  var metade = document.getElementById("c-metade");
  var grupos = {
    inventario: form.querySelector(".grupo-inventario"),
    divorcio: form.querySelector(".grupo-divorcio")
  };
  var mapaCampos = { obito: "obito", abertura: "abertura", total: "total", meacao: "meacao", isento: "isento", partilha: "partilha" };

  function tipo() {
    var r = form.elements.tipo;
    for (var i = 0; i < r.length; i++) if (r[i].checked) return r[i].value;
    return "inventario";
  }

  function trocarTipo() {
    var t = tipo();
    grupos.inventario.hidden = t !== "inventario";
    grupos.divorcio.hidden = t !== "divorcio";
    saida.innerHTML = "";
  }
  for (var i = 0; i < form.elements.tipo.length; i++) form.elements.tipo[i].addEventListener("change", trocarTipo);

  function preencherMetade() {
    if (!metade.checked) return;
    var total = N.lerValor(campoTotal.value);
    if (!isNaN(total) && total > 0) campoMeacao.value = R(Math.floor(total / 2)).replace("R$ ", "");
  }
  metade.addEventListener("change", function () {
    campoMeacao.readOnly = metade.checked;
    if (metade.checked) preencherMetade(); else campoMeacao.value = "";
  });
  campoTotal.addEventListener("input", preencherMetade);

  // formata o valor em reais quando o campo perde o foco
  var dinheiro = form.querySelectorAll(".dinheiro input");
  for (var j = 0; j < dinheiro.length; j++) {
    dinheiro[j].addEventListener("blur", function (ev) {
      var c = N.lerValor(ev.target.value);
      if (!isNaN(c)) ev.target.value = R(c).replace("R$ ", "");
    });
  }

  function limparErros() {
    var marcados = form.querySelectorAll("[aria-invalid]");
    for (var k = 0; k < marcados.length; k++) marcados[k].removeAttribute("aria-invalid");
  }

  function no(tag, attrs, filhos) {
    var e = document.createElement(tag);
    if (attrs) for (var a in attrs) if (Object.prototype.hasOwnProperty.call(attrs, a)) e.setAttribute(a, attrs[a]);
    (filhos || []).forEach(function (f) { if (f) e.appendChild(typeof f === "string" ? document.createTextNode(f) : f); });
    return e;
  }

  function linha(rotulo, valor, classe) {
    return no("tr", classe ? { "class": classe } : null, [no("td", null, [rotulo]), no("td", { "class": "valor" }, [valor])]);
  }

  function mostrarErros(erros) {
    var lista = no("ul", { "class": "erro" });
    erros.forEach(function (e) {
      lista.appendChild(no("li", null, [e.texto]));
      var campo = form.elements[mapaCampos[e.campo]];
      if (campo) campo.setAttribute("aria-invalid", "true");
    });
    saida.innerHTML = "";
    saida.appendChild(no("h2", null, ["Confira os dados"]));
    saida.appendChild(lista);
  }

  function fecho() {
    return no("p", { "class": "observacoes" }, [
      "Estimativa com a tabela de emolumentos de 2026 da capital (CNB/SP, ISS de 2% incluído) e a lei paulista do ITCMD. " +
      "Não inclui honorários do advogado e não substitui a análise do caso, que depende dos documentos."
    ]);
  }

  function inventario() {
    var r = N.calcularInventario({
      tabela: tabela,
      itcmd: itcmd,
      hoje: hoje(),
      dataObito: form.elements.obito.value,
      dataAbertura: form.elements.abertura.value,
      total: form.elements.total.value,
      meacao: form.elements.meacao.value,
      isento: form.elements.isento.value
    });
    if (!r.ok) return mostrarErros(r.erros);

    var faixaTexto = r.faixa.ate === null ? "acima de " + R(Math.round(r.faixa.de * 100))
      : "de " + R(Math.round(r.faixa.de * 100)) + " a " + R(Math.round(r.faixa.ate * 100));
    var multaRotulo = r.percentualMulta === 0
      ? "Multa por abrir o inventário depois de 60 dias: não há (abertura " + r.dias + " dias após o óbito)"
      : "Multa por abrir o inventário depois de 60 dias: " + Math.round(r.percentualMulta * 100) + "% do imposto (abertura " + r.dias + " dias após o óbito)";

    var tabelaRes = no("table", null, [no("tbody", null, [
      linha("Escritura de inventário (faixa " + r.faixa.faixa + " da tabela, herança " + faixaTexto + ")", R(r.emolumentos)),
      linha("ITCMD, 4% sobre " + R(r.baseItcmd), R(r.itcmd)),
      linha(multaRotulo, R(r.multa)),
      linha("Total estimado de cartório e imposto", R(r.total), "linha-total")
    ])]);

    var obs = no("ul", { "class": "observacoes" });
    obs.appendChild(no("li", null, ["Herança considerada: " + R(r.heranca) + ". A meação do cônjuge não é herança: fica fora do imposto e da base da escritura."]));
    obs.appendChild(no("li", null, ["Prazo para abrir o inventário sem multa: até " + D(r.prazoSemMulta) + " (60 dias do óbito). Conta a data da escritura de nomeação de inventariante ou a da declaração do ITCMD confirmada no sistema da Fazenda, a que vier primeiro."]));
    if (r.reducaoAindaPossivel) {
      obs.appendChild(no("li", null, ["Se o ITCMD for pago até " + D(r.prazoReducao) + " (90 dias do óbito), o imposto cai 5%, cerca de " + R(r.reducao) + " neste caso."]));
    }
    obs.appendChild(no("li", null, [r.vencido
      ? "O ITCMD venceu em " + D(r.vencimento) + " (180 dias do óbito). Pago agora, soma juros e multa de mora de até 20%, que esta conta não inclui."
      : "O ITCMD vence em " + D(r.vencimento) + " (180 dias do óbito). Depois disso correm juros e multa de mora."]));
    obs.appendChild(no("li", null, ["Não entram na conta: honorários do advogado, registro de cada imóvel no Registro de Imóveis, certidões e traslados extras."]));

    saida.innerHTML = "";
    saida.appendChild(no("h2", null, ["Estimativa do inventário"]));
    saida.appendChild(tabelaRes);
    saida.appendChild(obs);
    saida.appendChild(fecho());
  }

  function divorcio() {
    var r = N.calcularDivorcio({ tabela: tabela, partilha: form.elements.partilha.value });
    if (!r.ok) return mostrarErros(r.erros);
    var rotulo = r.comPartilha
      ? "Escritura de divórcio com partilha (faixa " + r.faixa.faixa + " da tabela, sobre " + R(r.valor) + ")"
      : "Escritura de divórcio sem partilha de bens (escritura sem valor declarado, item 6.2)";
    var tabelaRes = no("table", null, [no("tbody", null, [
      linha(rotulo, R(r.emolumentos)),
      linha("Total estimado de cartório", R(r.emolumentos), "linha-total")
    ])]);
    var obs = no("ul", { "class": "observacoes" });
    if (r.comPartilha) {
      obs.appendChild(no("li", null, ["Se um dos dois ficar com mais do que a metade que lhe cabe, a diferença paga imposto de transmissão antes da escritura. Esse imposto não entra aqui."]));
      obs.appendChild(no("li", null, ["O registro de cada imóvel no Registro de Imóveis tem tabela própria e também fica fora."]));
    } else {
      obs.appendChild(no("li", null, ["A partilha pode ficar para depois, em outra escritura. Nesse caso, ela terá custo próprio."]));
    }
    obs.appendChild(no("li", null, ["Não entram na conta: honorários do advogado, averbação no registro civil do casamento e traslados extras."]));
    saida.innerHTML = "";
    saida.appendChild(no("h2", null, ["Estimativa do divórcio"]));
    saida.appendChild(tabelaRes);
    saida.appendChild(obs);
    saida.appendChild(fecho());
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    limparErros();
    if (tipo() === "divorcio") divorcio(); else inventario();
    saida.setAttribute("tabindex", "-1");
    saida.focus();
  });

  trocarTipo();
})();
