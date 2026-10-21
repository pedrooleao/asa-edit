// Camadas personalizadas (como USER 1/2 na mesa): cada uma e' uma lista de
// tiras em qualquer ordem. Ficam guardadas no Mac (servidor) e valem para
// todas as janelas. Abrir uma snap pode trazer as camadas da Compact.

import { useState } from 'react';
import { enviar, useGeral, useValor, type Camada } from '../store';
import { mudarUi, useFecharComEsc } from '../ui';
import { corWing, lista, nomeDaTira, numeroCurto, type TipoTira } from '../util';
import { Icone } from '../comp/Icones';
import { confirmar } from '../comp/Confirmar';

const GRUPOS: { tipo: TipoTira; nome: string }[] = [
  { tipo: 'ch', nome: 'Canais' }, { tipo: 'aux', nome: 'Aux' }, { tipo: 'bus', nome: 'Buses' },
  { tipo: 'main', nome: 'Mains' }, { tipo: 'mtx', nome: 'Matrizes' }, { tipo: 'dca', nome: 'DCA' },
];

function Chip({ prefixo, ativo, aoClicar, children }: { prefixo: string; ativo?: boolean; aoClicar?: () => void; children?: React.ReactNode }) {
  const nome = nomeDaTira(prefixo, useValor(`${prefixo}/name`));
  const cor = corWing(useValor(`${prefixo}/col`));
  return (
    <button className={`chip ${ativo ? 'ativo' : ''}`} style={{ '--cor': cor } as React.CSSProperties} onClick={aoClicar} aria-pressed={ativo} title={ativo ? 'Já está na camada (clique para tirar)' : 'Adicionar à camada'}>
      <span className="chip-num">{numeroCurto(prefixo)}</span>{nome}{children}
    </button>
  );
}

export function EditorCamada({ inicial, indice, fechar }: { inicial: Camada; indice: number | null; fechar: () => void }) {
  const { geral } = useGeral();
  const [nome, setNome] = useState(inicial.nome);
  const [tiras, setTiras] = useState<string[]>(inicial.tiras);
  const [arrastando, setArrastando] = useState<number | null>(null);
  useFecharComEsc(fechar);
  const alternar = (t: string) => setTiras(tiras.includes(t) ? tiras.filter((x) => x !== t) : [...tiras, t]);
  const mover = (de: number, para: number) => {
    if (para < 0 || para >= tiras.length) return;
    const l = [...tiras];
    const [x] = l.splice(de, 1);
    l.splice(para, 0, x);
    setTiras(l);
  };
  function salvar() {
    const camadas = [...(geral?.config.camadas || [])];
    const nova = { nome: nome.trim() || 'Minha camada', tiras };
    if (indice === null) camadas.push(nova); else camadas[indice] = nova;
    enviar({ t: 'camadas', lista: camadas });
    mudarUi({ camada: `u:${indice === null ? camadas.length - 1 : indice}` });
    fechar();
  }
  return (
    <div className="fundo-modal" onClick={fechar}>
      <div className="modal largo" role="dialog" aria-modal="true" aria-label="Montar camada" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{indice === null ? 'Nova camada' : 'Editar camada'}</h2>
          <button className="icone-so" onClick={fechar} aria-label="Fechar"><Icone nome="fechar" /></button>
        </header>
        <label className="param texto"><span className="param-nome">Nome</span><input value={nome} maxLength={24} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Culto" autoFocus /></label>
        <div className="editor-camada">
          <div className="disponiveis">
            <p className="dica">Clique para pôr ou tirar da camada.</p>
            {GRUPOS.map((g) => (
              <div key={g.tipo}>
                <h3>{g.nome}</h3>
                <div className="chips">{lista(g.tipo).map((t) => <Chip key={t} prefixo={t} ativo={tiras.includes(t)} aoClicar={() => alternar(t)} />)}</div>
              </div>
            ))}
          </div>
          <div className="escolhidas">
            <h3>Na camada ({tiras.length}), na ordem</h3>
            <ol>
              {tiras.map((t, i) => (
                <li
                  key={t}
                  draggable
                  onDragStart={() => setArrastando(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (arrastando !== null) mover(arrastando, i); setArrastando(null); }}
                  className={arrastando === i ? 'arrastando' : ''}
                >
                  <Icone nome="arrastar" tamanho={1} className="alca" />
                  <Chip prefixo={t} />
                  <span className="acoes-linha">
                    <button className="icone-so" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, i - 1)}><Icone nome="voltar" tamanho={0.9} className="gira90" /></button>
                    <button className="icone-so" aria-label="Descer" disabled={i === tiras.length - 1} onClick={() => mover(i, i + 1)}><Icone nome="seta" tamanho={0.9} className="gira90" /></button>
                    <button className="icone-so" aria-label="Tirar" onClick={() => alternar(t)}><Icone nome="fechar" tamanho={0.9} /></button>
                  </span>
                </li>
              ))}
              {!tiras.length && <li className="dica">Nenhuma tira ainda.</li>}
            </ol>
          </div>
        </div>
        <footer className="modal-pe">
          <button onClick={fechar}>Cancelar</button>
          <button className="primario" onClick={salvar} disabled={!tiras.length}>Salvar camada</button>
        </footer>
      </div>
    </div>
  );
}

/** Lista das camadas pessoais, com editar, apagar e ordem. Usada na Biblioteca. */
export function ListaCamadas() {
  const { geral } = useGeral();
  const camadas = geral?.config.camadas || [];
  const [editando, setEditando] = useState<{ c: Camada; i: number | null } | null>(null);
  const gravar = (l: Camada[]) => enviar({ t: 'camadas', lista: l });
  return (
    <div className="lista-camadas">
      {camadas.map((c, i) => (
        <div key={i} className="linha-camada">
          <strong>{c.nome}</strong>
          <span className="dica">{c.tiras.length} tiras: {c.tiras.slice(0, 6).map((t) => nomeDaTira(t)).join(', ')}{c.tiras.length > 6 ? '…' : ''}</span>
          <span className="acoes-linha">
            <button onClick={() => setEditando({ c, i })}>Editar</button>
            <button className="icone-so" aria-label="Subir" disabled={i === 0} onClick={() => { const l = [...camadas]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; gravar(l); }}><Icone nome="voltar" tamanho={0.9} className="gira90" /></button>
            <button className="icone-so" aria-label="Apagar" onClick={async () => { if (await confirmar(`Apagar a camada “${c.nome}”?`, { sim: 'Apagar', perigo: true })) gravar(camadas.filter((_, k) => k !== i)); }}><Icone nome="lixo" tamanho={1} /></button>
          </span>
        </div>
      ))}
      {!camadas.length && <p className="dica">Nenhuma camada ainda. Abrir uma snap da WING Compact traz as camadas dela.</p>}
      <button className="com-icone" onClick={() => setEditando({ c: { nome: '', tiras: [] }, i: null })}><Icone nome="mais" tamanho={1} />Nova camada</button>
      {editando && <EditorCamada inicial={editando.c} indice={editando.i} fechar={() => setEditando(null)} />}
    </div>
  );
}
