/* Núcleo da calculadora de custos de cartório e ITCMD (São Paulo).
   Funções puras, sem acesso à página: a mesma conta roda no navegador (calculadora.js) e no teste (node).
   Todo valor em dinheiro circula em centavos inteiros, para não haver erro de arredondamento. */
(function (raiz) {
  "use strict";

  var DIA_MS = 86400000;

  function centavos(reais) {
    return Math.round(Number(reais) * 100);
  }

  /* Lê valor digitado no padrão brasileiro ("1.234.567,89", "250000", "250.000") e devolve centavos,
     ou NaN se não for número. */
  function lerValor(texto) {
    if (typeof texto === "number") return isFinite(texto) ? Math.round(texto * 100) : NaN;
    var t = String(texto == null ? "" : texto).replace(/R\$|\s/g, "");
    if (t === "") return NaN;
    if (t.indexOf(",") >= 0) {
      t = t.replace(/\./g, "").replace(",", ".");
    } else {
      var partes = t.split(".");
      if (partes.length > 2 || (partes.length === 2 && partes[1].length === 3)) t = partes.join("");
    }
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
    return Math.round(parseFloat(t) * 100);
  }

  function formatarReais(c) {
    var negativo = c < 0;
    c = Math.abs(Math.round(c));
    var inteiro = Math.floor(c / 100).toString();
    var resto = (c % 100).toString();
    if (resto.length < 2) resto = "0" + resto;
    inteiro = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (negativo ? "-" : "") + "R$ " + inteiro + "," + resto;
  }

  function lerData(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return null;
    var p = iso.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    if (d.getUTCFullYear() !== +p[0] || d.getUTCMonth() !== +p[1] - 1 || d.getUTCDate() !== +p[2]) return null;
    return d;
  }

  function isoDe(d) {
    return d.toISOString().slice(0, 10);
  }

  function somarDias(iso, dias) {
    var d = lerData(iso);
    return isoDe(new Date(d.getTime() + dias * DIA_MS));
  }

  function diasEntre(isoA, isoB) {
    return Math.round((lerData(isoB).getTime() - lerData(isoA).getTime()) / DIA_MS);
  }

  function formatarData(iso) {
    var p = iso.split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  /* Faixa da tabela de escritura com valor declarado em que o valor (em centavos) se encaixa. */
  function faixaDe(tabela, c) {
    var faixas = tabela.escritura_com_valor_declarado;
    for (var i = 0; i < faixas.length; i++) {
      var f = faixas[i];
      if (f.ate === null || c <= centavos(f.ate)) return f;
    }
    return null;
  }

  function percentualMulta(itcmd, dias) {
    var regras = itcmd.multa_abertura.regras;
    for (var i = 0; i < regras.length; i++) {
      if (regras[i].ate_dias === null || dias <= regras[i].ate_dias) return regras[i].percentual;
    }
    return regras[regras.length - 1].percentual;
  }

  /* Inventário em cartório.
     p = { tabela, itcmd, hoje: "aaaa-mm-dd", dataObito, dataAbertura (opcional, padrão hoje),
           total (bens do falecido e do casal, se havia bens comuns), meacao, isento } */
  function calcularInventario(p) {
    var erros = [];
    var hoje = p.hoje;
    var obito = lerData(p.dataObito);
    var abertura = p.dataAbertura ? lerData(p.dataAbertura) : lerData(hoje);
    var total = lerValor(p.total);
    var meacao = p.meacao === "" || p.meacao == null ? 0 : lerValor(p.meacao);
    var isento = p.isento === "" || p.isento == null ? 0 : lerValor(p.isento);

    var obitoOk = false;
    if (!obito) erros.push({ campo: "obito", texto: "Informe a data do óbito." });
    else if (obito.getTime() > lerData(hoje).getTime()) erros.push({ campo: "obito", texto: "A data do óbito está no futuro." });
    else if (p.dataObito < p.itcmd.aliquota_valida_para_obitos_desde) {
      erros.push({ campo: "obito", texto: "Para óbitos anteriores a 2002 a alíquota do ITCMD era outra. Esta calculadora cobre óbitos a partir de 01/01/2002." });
    } else obitoOk = true;
    if (!abertura) erros.push({ campo: "abertura", texto: "Informe uma data de abertura válida." });
    else if (obitoOk && abertura.getTime() < obito.getTime()) erros.push({ campo: "abertura", texto: "A abertura não pode ser anterior ao óbito." });
    if (isNaN(total) || total <= 0) erros.push({ campo: "total", texto: "Informe o valor dos bens, maior que zero." });
    if (isNaN(meacao) || meacao < 0) erros.push({ campo: "meacao", texto: "A meação precisa ser um valor em reais, ou zero." });
    else if (!isNaN(total) && meacao * 2 > total) erros.push({ campo: "meacao", texto: "A meação não passa da metade do valor total dos bens." });
    if (isNaN(isento) || isento < 0) erros.push({ campo: "isento", texto: "O valor isento precisa ser um valor em reais, ou zero." });
    else if (!isNaN(total) && !isNaN(meacao) && isento > total - meacao) erros.push({ campo: "isento", texto: "O valor isento não passa do valor da herança." });
    if (erros.length) return { ok: false, erros: erros };

    var dataObito = isoDe(obito);
    var dataAbertura = isoDe(abertura);
    var heranca = total - meacao;
    var faixa = faixaDe(p.tabela, heranca);
    var emolumentos = centavos(faixa.total);
    var baseItcmd = heranca - isento;
    var itcmd = Math.round(baseItcmd * p.itcmd.aliquota);
    var dias = diasEntre(dataObito, dataAbertura);
    var perc = percentualMulta(p.itcmd, dias);
    var multa = Math.round(itcmd * perc);
    var reducao = Math.round(itcmd * p.itcmd.reducao_pagamento_antecipado.percentual);

    return {
      ok: true,
      tipo: "inventario",
      heranca: heranca,
      faixa: faixa,
      emolumentos: emolumentos,
      baseItcmd: baseItcmd,
      itcmd: itcmd,
      dias: dias,
      percentualMulta: perc,
      multa: multa,
      total: emolumentos + itcmd + multa,
      prazoSemMulta: somarDias(dataObito, p.itcmd.multa_abertura.regras[0].ate_dias),
      prazoReducao: somarDias(dataObito, p.itcmd.reducao_pagamento_antecipado.dias),
      reducao: reducao,
      vencimento: somarDias(dataObito, p.itcmd.vencimento_dias),
      vencido: diasEntre(dataObito, hoje) > p.itcmd.vencimento_dias,
      reducaoAindaPossivel: diasEntre(dataObito, hoje) <= p.itcmd.reducao_pagamento_antecipado.dias
    };
  }

  /* Divórcio em cartório: sem bens, escritura sem valor declarado; com partilha, valor declarado sobre o total. */
  function calcularDivorcio(p) {
    var valor = p.partilha === "" || p.partilha == null ? 0 : lerValor(p.partilha);
    if (isNaN(valor) || valor < 0) {
      return { ok: false, erros: [{ campo: "partilha", texto: "Informe o valor dos bens a partilhar, ou deixe em branco se não houver." }] };
    }
    if (valor === 0) {
      return { ok: true, tipo: "divorcio", comPartilha: false, emolumentos: centavos(p.tabela.escritura_sem_valor_declarado.total) };
    }
    var faixa = faixaDe(p.tabela, valor);
    return { ok: true, tipo: "divorcio", comPartilha: true, valor: valor, faixa: faixa, emolumentos: centavos(faixa.total) };
  }

  var api = {
    lerValor: lerValor,
    formatarReais: formatarReais,
    formatarData: formatarData,
    somarDias: somarDias,
    diasEntre: diasEntre,
    faixaDe: faixaDe,
    percentualMulta: percentualMulta,
    calcularInventario: calcularInventario,
    calcularDivorcio: calcularDivorcio
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.CalcNucleo = api;
})(this);
