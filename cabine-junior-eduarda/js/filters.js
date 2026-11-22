/*
 * Sem filtros/efeitos de cor — só a moldura é aplicada à foto/vídeo.
 * Este módulo fica só para o resto do código (frames.js/app.js) não precisar
 * de um caminho especial: ele sempre recebe o filtro "natural" (sem mudança).
 */
(function () {
  const LIST = [{ id: 'natural', name: 'Natural', ops: [] }];

  function css() {
    return 'none';
  }

  function apply() {
    // nada a fazer — a imagem/vídeo fica exatamente como veio da câmera.
  }

  window.Filters = { list: LIST, css, apply };
})();
