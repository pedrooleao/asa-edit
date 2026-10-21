// Aba Inserts do painel: efeitos inseridos antes e depois da dinamica, e a
// ordem da cadeia (gate, EQ, dinamica, insert) arrastando os blocos.

import { useState } from 'react';
import { def, definir, useTexto, useValor } from '../store';
import { Botao, Deslizante, Lista } from '../comp/Parametro';
import { mudarUi } from '../ui';
import { Icone } from '../comp/Icones';

const BLOCOS: Record<string, string> = { G: 'Gate', E: 'EQ', D: 'Dinâmica', I: 'Insert' };

function NomeFx({ caminho }: { caminho: string }) {
  const ins = useTexto(caminho, 'NONE');
  const n = /^FX(\d+)$/.exec(ins)?.[1];
  const mdl = useTexto(n ? `/fx/${n}/mdl` : null);
  if (!n) return null;
  return (
    <button className="link" onClick={() => mudarUi({ tela: 'efeitos' })} title="Abrir na tela Efeitos">
      FX {n}: {mdl && mdl !== 'NONE' ? mdl : 'vazio'}
    </button>
  );
}

function Estado({ caminho }: { caminho: string }) {
  const s = useValor(caminho);
  if (s === 'N/A') return <span className="aviso-txt">Este FX não serve aqui (já está em uso ou não aceita insert)</span>;
  return null;
}

function Ordem({ prefixo }: { prefixo: string }) {
  const c = `${prefixo}/proc`;
  const d = def(c);
  const atual = useTexto(c, 'GEDI');
  const [arrastando, setArrastando] = useState<number | null>(null);
  if (!d?.itens) return null;
  const permitidas = new Set(d.itens.map((i) => String(i[0])));
  const letras = atual.split('');
  const trocar = (de: number, para: number) => {
    if (para < 0 || para >= letras.length || de === para) return;
    const l = [...letras];
    const [x] = l.splice(de, 1);
    l.splice(para, 0, x);
    const nova = l.join('');
    if (permitidas.has(nova)) definir(c, nova);
  };
  return (
    <div className="cartao">
      <div className="cartao-cab"><h3>Ordem do processamento</h3></div>
      <p className="dica">Arraste os blocos (ou use as setas). O sinal passa da esquerda para a direita.</p>
      <ol className="cadeia">
        {letras.map((l, i) => (
          <li
            key={l}
            draggable
            onDragStart={() => setArrastando(i)}
            onDragOver={(ev) => ev.preventDefault()}
            onDrop={() => { if (arrastando !== null) trocar(arrastando, i); setArrastando(null); }}
            className={arrastando === i ? 'arrastando' : ''}
          >
            <button className="icone-so" aria-label={`Mover ${BLOCOS[l]} para a esquerda`} disabled={i === 0} onClick={() => trocar(i, i - 1)}><Icone nome="voltar" tamanho={1} /></button>
            <span>{BLOCOS[l] || l}</span>
            <button className="icone-so" aria-label={`Mover ${BLOCOS[l]} para a direita`} disabled={i === letras.length - 1} onClick={() => trocar(i, i + 1)}><Icone nome="seta" tamanho={1} /></button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Inserts({ prefixo }: { prefixo: string }) {
  return (
    <div className="aba-inserts">
      {def(`${prefixo}/preins/on`) && (
        <div className="cartao">
          <div className="cartao-cab"><h3>Insert 1</h3><Botao caminho={`${prefixo}/preins/on`} rotulo="Ligado" /></div>
          <Lista caminho={`${prefixo}/preins/ins`} rotulo="Efeito" />
          <NomeFx caminho={`${prefixo}/preins/ins`} />
          <Estado caminho={`${prefixo}/preins/$stat`} />
        </div>
      )}
      {def(`${prefixo}/postins/on`) && (
        <div className="cartao">
          <div className="cartao-cab"><h3>Insert 2 (depois do fader)</h3><Botao caminho={`${prefixo}/postins/on`} rotulo="Ligado" /></div>
          {def(`${prefixo}/postins/mode`) && <Lista caminho={`${prefixo}/postins/mode`} rotulo="Modo" />}
          <Lista caminho={`${prefixo}/postins/ins`} rotulo="Efeito" />
          <NomeFx caminho={`${prefixo}/postins/ins`} />
          {def(`${prefixo}/postins/w`) && <Deslizante caminho={`${prefixo}/postins/w`} rotulo="Peso (automix)" />}
          <Estado caminho={`${prefixo}/postins/$stat`} />
        </div>
      )}
      {def(`${prefixo}/proc`) && <Ordem prefixo={prefixo} />}
    </div>
  );
}
