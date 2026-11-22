# Junior ∞ Eduarda — Cabine de fotos

O convidado abre o link no celular, vê o farol se desenhando e acendendo, toca em
**Abrir câmera**, escolhe **Foto** ou **Vídeo** e a moldura (arrastando para os
lados), captura e salva — com a moldura já embutida. Sem filtros, sem efeitos de
cor: só a câmera e a moldura.

## Estrutura

```
index.html         abertura, câmera, resultado e galeria
css/style.css      visual: câmera estilo iPhone, com vidro (glass) e luz quente
js/config.js       ← NOMES, DATA E FRASE — edite aqui
js/frames.js       as 4 molduras (Elegante, Polaroid, Arco, Minimal)
js/filters.js      sem efeitos — só repassa a imagem como veio da câmera
js/gallery.js      galeria local (IndexedDB, só neste aparelho)
js/app.js          câmera, vídeo, temporizador, captura e galeria
assets/farol.svg   ilustração do farol, desenhada traço a traço na abertura
```

Depois de editar qualquer arquivo, aumente o número em `?v=10` (ex.: `?v=11`) no `index.html`
para os celulares não usarem a versão antiga guardada.

## O que tem

- **Abertura animada**: o farol é desenhado traço a traço como uma caneta, a aquarela
  entra, as estrelas e a lua aparecem e o farol acende com um feixe de luz girando,
  um brilho pulsante e um reflexo de lente — tudo em CSS, bem leve.
- **Foto ou vídeo**: um interruptor acima do obturador troca o modo. O vídeo grava até
  8 segundos com a moldura já desenhada quadro a quadro (sai pronto em .mp4 ou .webm,
  conforme o navegador).
- **4 molduras**, trocadas deslizando ou tocando na faixa — sem filtros de cor, só a
  câmera e a moldura escolhida.
- **Galeria local**: ícone no topo da câmera. Fotos e vídeos ficam só no aparelho de
  quem tirou (IndexedDB), com visualizar, salvar e apagar (apagar pede um segundo toque).

## Link fixo (GitHub Pages)

1. Em <https://github.com>, crie um repositório público (ex.: `cabine-junior-eduarda`).
2. **Add file › Upload files** e envie `index.html`, `css`, `js` e `assets`.
3. **Settings › Pages** → *Deploy from a branch* → `main` / `(root)` → **Save**.
4. O link fica `https://SEU-USUARIO.github.io/cabine-junior-eduarda/` e funciona 24h,
   sem depender de nenhum computador ligado.

## Salvar foto/vídeo

- **iPhone**: "Salvar" abre o compartilhar → **Salvar Imagem/Vídeo** (vai para Fotos).
- **Android**: o arquivo é baixado e aparece na galeria do aparelho.
- Pelo Instagram/WhatsApp a câmera pode ser bloqueada: abra o link no navegador.
- A gravação de vídeo depende do navegador ter o MediaRecorder (Safari 14.3+,
  Chrome e a maioria dos navegadores recentes têm).

Nada é enviado para a internet: cada convidado salva e guarda só o que tirou.
