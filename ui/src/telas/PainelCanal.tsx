// Painel da tira selecionada, embaixo dos faders. A aba "Canal" junta numa
// tela so o que o HOME da WING mostra, na ordem do sinal: entrada, filtros,
// EQ, dinamica, saidas e identidade. As outras abas detalham cada bloco.

import { useMemo, useState } from 'react';
import { def, definir, filhos, indiceMedidor, useNumero, useTexto, useValor, valor } from '../store';
import { mudarUi, useUi, type AbaPainel } from '../ui';
import {
  caminhoFonte, CORES_WING, corWing, lerTags, montarTags, NOME_TIPO, NOMES_CORES, nomeDaTira, partesDaTira, rotuloPadrao,
} from '../util';
import { Botao, CampoTexto, Deslizante, GradeDoModelo, Lista, ValorFader } from '../comp/Parametro';
import { Fader } from '../comp/Fader';
import { EqGrafico, bandasDoEq } from '../comp/EqGrafico';
import { MedidorReducao, Medidor } from '../comp/Medidor';
import { SeletorFonte, SeletorModo } from '../comp/Fonte';
import { Icone } from '../comp/Icones';
import { Inserts } from './Inserts';

const ABAS: { id: AbaPainel; nome: string }[] = [
  { id: 'canal', nome: 'Canal' },
  { id: 'eq', nome: 'EQ' },
  { id: 'gate', nome: 'Gate' },
  { id: 'comp', nome: 'Comp' },
  { id: 'envios', nome: 'Envios' },
  { id: 'inserts', nome: 'Inserts' },
];

function abasDe(prefixo: string) {
  const { tipo } = partesDaTira(prefixo);
  if (tipo === 'dca') return ABAS.filter((a) => a.id === 'canal');
  return ABAS.filter((a) => {
    if (a.id === 'gate') return !!def(`${prefixo}/gate/on`);
    if (a.id === 'comp') return !!def(`${prefixo}/dyn/on`);
    if (a.id === 'eq') return !!def(`${prefixo}/eq/on`);
    if (a.id === 'envios') return !!def(`${prefixo}/send/1/on`) || !!def(`${prefixo}/send/MX1/on`) || !!def(`${prefixo}/main/1/on`);
    if (a.id === 'inserts') return !!def(`${prefixo}/preins/on`);
    return true;
  });
}

export function PainelCanal() {
  const prefixo = useUi('selecionado');
  const aba = useUi('aba');
  const altura = useUi('painelAltura');
  const abas = abasDe(prefixo);
  const abaAtual = abas.find((a) => a.id === aba) ? aba : 'canal';
  const cor = corWing(useValor(`${prefixo}/col`));
  const nome = nomeDaTira(prefixo, useValor(`${prefixo}/name`));
  const { tipo } = partesDaTira(prefixo);

  function arrastarBorda(ev: React.PointerEvent) {
    const y0 = ev.clientY;
    const a0 = altura;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const el = ev.currentTarget as HTMLElement;
    el.setPointerCapture(ev.pointerId);
    const mover = (e: PointerEvent) => mudarUi({ painelAltura: Math.max(12, Math.min(48, a0 + (y0 - e.clientY) / rem)) });
    const soltar = () => { el.removeEventListener('pointermove', mover); el.removeEventListener('pointerup', soltar); };
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerup', soltar);
  }

  return (
    <section className="painel" style={{ height: `${altura}rem`, '--cor': cor } as React.CSSProperties} aria-label={`Painel de ${nome}`}>
      <div className="painel-borda" onPointerDown={arrastarBorda} title="Arraste para mudar a altura" />
      <header className="painel-cab">
        <span className="painel-cor" />
        <strong className="painel-nome">{nome}</strong>
        <span className="painel-tipo">{NOME_TIPO[tipo]} {partesDaTira(prefixo).n}</span>
        <nav className="abas" role="tablist">
          {abas.map((a) => (
            <button key={a.id} role="tab" aria-selected={abaAtual === a.id} className={abaAtual === a.id ? 'ativa' : ''} onClick={() => mudarUi({ aba: a.id })}>
              {a.nome}
              {a.id !== 'canal' && a.id !== 'envios' && <LuzBloco prefixo={prefixo} aba={a.id} />}
            </button>
          ))}
        </nav>
        <button className="icone-so" onClick={() => mudarUi({ painelAberto: false })} aria-label="Fechar painel" title="Fechar painel">
          <Icone nome="fechar" />
        </button>
      </header>
      <div className="painel-corpo" key={prefixo + abaAtual}>
        {abaAtual === 'canal' && <AbaCanal prefixo={prefixo} />}
        {abaAtual === 'eq' && <AbaEq prefixo={prefixo} />}
        {abaAtual === 'gate' && <AbaDinamica prefixo={prefixo} bloco="gate" />}
        {abaAtual === 'comp' && <AbaDinamica prefixo={prefixo} bloco="dyn" />}
        {abaAtual === 'envios' && <AbaEnvios prefixo={prefixo} />}
        {abaAtual === 'inserts' && <Inserts prefixo={prefixo} />}
      </div>
    </section>
  );
}

/** Luz pequena na aba: o bloco esta ligado? */
function LuzBloco({ prefixo, aba }: { prefixo: string; aba: AbaPainel }) {
  const c = aba === 'eq' ? `${prefixo}/eq/on` : aba === 'gate' ? `${prefixo}/gate/on` : aba === 'comp' ? `${prefixo}/dyn/on` : aba === 'inserts' ? `${prefixo}/preins/on` : null;
  const v = useValor(c);
  const v2 = useValor(aba === 'inserts' ? `${prefixo}/postins/on` : null);
  return <span className={`luz ${v || v2 ? 'acesa' : ''}`} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Aba Canal (o HOME)
// ---------------------------------------------------------------------------
function Cartao({ titulo, children, acao, className }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode; className?: string }) {
  return (
    <div className={`cartao ${className || ''}`}>
      <div className="cartao-cab"><h3>{titulo}</h3>{acao}</div>
      {children}
    </div>
  );
}

function AbaCanal({ prefixo }: { prefixo: string }) {
  const { tipo } = partesDaTira(prefixo);
  const temEntrada = tipo === 'ch' || tipo === 'aux';
  return (
    <div className="aba-canal">
      {temEntrada && <CartaoEntrada prefixo={prefixo} />}
      {def(`${prefixo}/flt/lc`) && <CartaoFiltros prefixo={prefixo} />}
      {def(`${prefixo}/eq/on`) && (
        <Cartao titulo="EQ" acao={<Botao caminho={`${prefixo}/eq/on`} rotulo="Ligado" />}>
          <EqGrafico prefixo={prefixo} mini aoClicar={() => mudarUi({ aba: 'eq' })} />
          <span className="dica">Clique no gráfico para ajustar</span>
        </Cartao>
      )}
      {(def(`${prefixo}/gate/on`) || def(`${prefixo}/dyn/on`)) && <CartaoDinamica prefixo={prefixo} />}
      {tipo !== 'dca' && def(`${prefixo}/main/1/on`) && <CartaoMains prefixo={prefixo} />}
      {tipo !== 'ch' && tipo !== 'aux' && tipo !== 'dca' && <CartaoNivel prefixo={prefixo} />}
      <CartaoIdentidade prefixo={prefixo} />
      {(tipo === 'ch' || tipo === 'aux' || tipo === 'bus' || tipo === 'mtx' || tipo === 'main') && def(`${prefixo}/tags`) && <CartaoGrupos prefixo={prefixo} />}
      {tipo === 'dca' && <CartaoMembrosDca prefixo={prefixo} />}
    </div>
  );
}

function CartaoEntrada({ prefixo }: { prefixo: string }) {
  const grp = useValor(`${prefixo}/in/conn/grp`);
  const n = useValor(`${prefixo}/in/conn/in`);
  const fonte = caminhoFonte(grp, n);
  const { tipo, n: num } = partesDaTira(prefixo);
  return (
    <Cartao titulo="Entrada" className="entrada">
      <SeletorFonte base={`${prefixo}/in/conn`} rotulo="Fonte" />
      <SeletorModo base={`${prefixo}/in/conn`} />
      {fonte && def(`${fonte}/g`) ? (
        <>
          <Deslizante caminho={`${fonte}/g`} rotulo="Ganho" />
          <div className="linha-botoes">
            {def(`${fonte}/vph`) && <Botao caminho={`${fonte}/vph`} rotulo="48V" tipo="alerta" title="Phantom power na fonte" />}
            <Botao caminho={`${prefixo}/in/set/inv`} rotulo="Fase Ø" title="Inverter a fase do canal" />
            {def(`${fonte}/mute`) && <Botao caminho={`${fonte}/mute`} rotulo="Mute da fonte" tipo="mute" />}
          </div>
          <CampoTexto caminho={`${fonte}/name`} rotulo="Nome da fonte" />
        </>
      ) : (
        <div className="linha-botoes"><Botao caminho={`${prefixo}/in/set/inv`} rotulo="Fase Ø" /></div>
      )}
      <Deslizante caminho={`${prefixo}/in/set/trim`} rotulo="Trim" />
      <div className="linha-botoes">
        <Botao caminho={`${prefixo}/in/set/dlyon`} rotulo="Delay" />
      </div>
      <ValorDelay prefixo={prefixo} />
      <div className="medidor-entrada">
        <Medidor indices={[indiceMedidor(tipo, num, 0)]} horizontal />
      </div>
    </Cartao>
  );
}

function ValorDelay({ prefixo }: { prefixo: string }) {
  const on = useNumero(`${prefixo}/in/set/dlyon`);
  if (!on) return null;
  return (
    <>
      <Lista caminho={`${prefixo}/in/set/dlymode`} rotulo="Unidade" />
      <Deslizante caminho={`${prefixo}/in/set/dly`} rotulo="Distância" />
    </>
  );
}

function CartaoFiltros({ prefixo }: { prefixo: string }) {
  const lc = useNumero(`${prefixo}/flt/lc`);
  const hc = useNumero(`${prefixo}/flt/hc`);
  const tf = useNumero(`${prefixo}/flt/tf`);
  const mdl = useTexto(`${prefixo}/flt/mdl`, 'TILT');
  return (
    <Cartao titulo="Filtros">
      <div className="linha-filtro">
        <Botao caminho={`${prefixo}/flt/lc`} rotulo="Lo cut" />
        {lc ? <Deslizante caminho={`${prefixo}/flt/lcf`} rotulo="" compacto /> : <span className="dica">desligado</span>}
      </div>
      {!!lc && def(`${prefixo}/flt/lcs`) && <Lista caminho={`${prefixo}/flt/lcs`} rotulo="Inclinação" />}
      <div className="linha-filtro">
        <Botao caminho={`${prefixo}/flt/hc`} rotulo="Hi cut" />
        {hc ? <Deslizante caminho={`${prefixo}/flt/hcf`} rotulo="" compacto /> : <span className="dica">desligado</span>}
      </div>
      {def(`${prefixo}/flt/tf`) && (
        <>
          <div className="linha-filtro">
            <Botao caminho={`${prefixo}/flt/tf`} rotulo="Tilt/extra" />
            {!!tf && <Lista caminho={`${prefixo}/flt/mdl`} sem />}
          </div>
          {!!tf && <GradeDoModelo caminhos={filhos(`${prefixo}/flt/${mdl}`).map((d) => d.caminho)} />}
        </>
      )}
    </Cartao>
  );
}

function CartaoDinamica({ prefixo }: { prefixo: string }) {
  const { tipo, n } = partesDaTira(prefixo);
  return (
    <Cartao titulo="Dinâmica">
      {def(`${prefixo}/gate/on`) && (
        <div className="linha-din">
          <Botao caminho={`${prefixo}/gate/on`} rotulo="Gate" />
          <Lista caminho={`${prefixo}/gate/mdl`} sem />
          <button className="link" onClick={() => mudarUi({ aba: 'gate' })}>Ajustar</button>
          {tipo === 'ch' && <MedidorReducao indice={indiceMedidor('ch', n, 5)} horizontal className="gr-h" />}
        </div>
      )}
      {def(`${prefixo}/dyn/on`) && (
        <div className="linha-din">
          <Botao caminho={`${prefixo}/dyn/on`} rotulo="Comp" />
          {def(`${prefixo}/dyn/mdl`) ? <Lista caminho={`${prefixo}/dyn/mdl`} sem /> : <span />}
          <button className="link" onClick={() => mudarUi({ aba: 'comp' })}>Ajustar</button>
          {tipo === 'ch' && <MedidorReducao indice={indiceMedidor('ch', n, 7)} horizontal className="gr-h" />}
        </div>
      )}
      {def(`${prefixo}/dyn/COMP/thr`) && <ResumoComp prefixo={prefixo} />}
    </Cartao>
  );
}

function ResumoComp({ prefixo }: { prefixo: string }) {
  const mdl = useTexto(`${prefixo}/dyn/mdl`);
  const thr = filhos(`${prefixo}/dyn/${mdl}`).find((d) => d.caminho.endsWith('/thr'));
  if (!thr) return null;
  return <Deslizante caminho={thr.caminho} rotulo="Limiar do comp" />;
}

function CartaoMains({ prefixo }: { prefixo: string }) {
  return (
    <Cartao titulo="Mains">
      {[1, 2, 3, 4].map((m) => def(`${prefixo}/main/${m}/on`) && <LinhaEnvio key={m} base={`${prefixo}/main/${m}`} destino={`/main/${m}`} compacto />)}
    </Cartao>
  );
}

function CartaoNivel({ prefixo }: { prefixo: string }) {
  return (
    <Cartao titulo="Nível">
      {def(`${prefixo}/pan`) && <Deslizante caminho={`${prefixo}/pan`} rotulo="Pan" />}
      {def(`${prefixo}/wid`) && <Deslizante caminho={`${prefixo}/wid`} rotulo="Largura" />}
      {def(`${prefixo}/busmono`) && <div className="linha-botoes"><Botao caminho={`${prefixo}/busmono`} rotulo="Mono" /></div>}
      {def(`${prefixo}/in/set/trim`) && <Deslizante caminho={`${prefixo}/in/set/trim`} rotulo="Trim" />}
    </Cartao>
  );
}

function SeletorCor({ caminho }: { caminho: string }) {
  const atual = useNumero(caminho, 1);
  return (
    <div className="cores" role="radiogroup" aria-label="Cor">
      {Object.entries(CORES_WING).map(([n, c]) => (
        <button
          key={n}
          role="radio"
          aria-checked={atual === Number(n)}
          aria-label={NOMES_CORES[Number(n)]}
          title={NOMES_CORES[Number(n)]}
          className={`cor ${atual === Number(n) ? 'sel' : ''}`}
          style={{ background: c }}
          onClick={() => definir(caminho, Number(n))}
        />
      ))}
    </div>
  );
}

function CartaoIdentidade({ prefixo }: { prefixo: string }) {
  return (
    <Cartao titulo="Nome e cor">
      <CampoTexto caminho={`${prefixo}/name`} rotulo="Nome" placeholder={rotuloPadrao(prefixo)} />
      <SeletorCor caminho={`${prefixo}/col`} />
      {def(`${prefixo}/tags`) && <CampoEtiquetas prefixo={prefixo} />}
    </Cartao>
  );
}

function CampoEtiquetas({ prefixo }: { prefixo: string }) {
  const tags = useValor(`${prefixo}/tags`);
  const { dcas, mgrps, outras } = lerTags(tags);
  const [t, setT] = useState<string | null>(null);
  return (
    <label className="param texto">
      <span className="param-nome">Etiquetas</span>
      <input
        value={t ?? outras.join(', ')}
        placeholder="ex.: Instrumento, Voz"
        onChange={(ev) => setT(ev.target.value)}
        onBlur={() => {
          if (t === null) return;
          const novas = t.split(',').map((x) => x.trim()).filter(Boolean).filter((x) => !/^#[DM]\d+$/.test(x));
          definir(`${prefixo}/tags`, montarTags(dcas, mgrps, novas).slice(0, 80));
          setT(null);
        }}
        onKeyDown={(ev) => { ev.stopPropagation(); if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }}
      />
    </label>
  );
}

function CartaoGrupos({ prefixo }: { prefixo: string }) {
  const tags = useValor(`${prefixo}/tags`);
  const { dcas, mgrps, outras } = lerTags(tags);
  const alternar = (lista: number[], n: number, ehDca: boolean) => {
    const nova = lista.includes(n) ? lista.filter((x) => x !== n) : [...lista, n];
    definir(`${prefixo}/tags`, ehDca ? montarTags(nova, mgrps, outras) : montarTags(dcas, nova, outras));
  };
  return (
    <Cartao titulo="DCA e mute group">
      <span className="param-nome">DCA</span>
      <div className="grade-numeros">
        {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
          <button key={n} className={`num ${dcas.includes(n) ? 'ligado' : ''}`} aria-pressed={dcas.includes(n)} title={nomeDaTira(`/dca/${n}`)} onClick={() => alternar(dcas, n, true)}>{n}</button>
        ))}
      </div>
      <span className="param-nome">Mute group</span>
      <div className="grade-numeros">
        {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
          <button key={n} className={`num mg ${mgrps.includes(n) ? 'ligado' : ''}`} aria-pressed={mgrps.includes(n)} title={String(valor(`/mgrp/${n}/name`) || `Mute group ${n}`)} onClick={() => alternar(mgrps, n, false)}>{n}</button>
        ))}
      </div>
    </Cartao>
  );
}

function CartaoMembrosDca({ prefixo }: { prefixo: string }) {
  const { n } = partesDaTira(prefixo);
  const membros = useMemo(() => {
    const l: string[] = [];
    for (const tipo of ['ch', 'aux', 'bus', 'mtx'] as const) {
      const qtd = { ch: 40, aux: 8, bus: 16, mtx: 8 }[tipo];
      for (let k = 1; k <= qtd; k++) if (lerTags(valor(`/${tipo}/${k}/tags`)).dcas.includes(n)) l.push(`/${tipo}/${k}`);
    }
    return l;
  }, [n]);
  return (
    <Cartao titulo="Neste DCA">
      {membros.length ? (
        <ul className="membros">{membros.map((m) => <li key={m} style={{ '--cor': corWing(valor(`${m}/col`)) } as React.CSSProperties}>{nomeDaTira(m)}</li>)}</ul>
      ) : (
        <p className="dica">Nenhum canal. Atribua pelo painel de cada canal, em "DCA e mute group".</p>
      )}
    </Cartao>
  );
}

// ---------------------------------------------------------------------------
// Aba EQ
// ---------------------------------------------------------------------------
function AbaEq({ prefixo }: { prefixo: string }) {
  const eq = `${prefixo}/eq`;
  const mdl = useTexto(`${eq}/mdl`, 'STD');
  const bandas = bandasDoEq(eq);
  const [sel, setSel] = useState(bandas[1]?.k || 'l');
  const temPeq = !!def(`${prefixo}/peq/on`);
  return (
    <div className="aba-eq">
      <div className="eq-lado">
        <div className="linha-botoes">
          <Botao caminho={`${eq}/on`} rotulo="EQ ligado" />
          <Lista caminho={`${eq}/mdl`} sem />
        </div>
        {def(`${eq}/mix`) && <Deslizante caminho={`${eq}/mix`} rotulo="Mix" />}
        {mdl === 'STD' && def(`${eq}/STD/tilt`) && <Deslizante caminho={`${eq}/STD/tilt`} rotulo="Tilt" />}
        {def(`${prefixo}/flt/lc`) && (
          <>
            <div className="linha-filtro"><Botao caminho={`${prefixo}/flt/lc`} rotulo="Lo cut" /><Deslizante caminho={`${prefixo}/flt/lcf`} rotulo="" compacto /></div>
            <div className="linha-filtro"><Botao caminho={`${prefixo}/flt/hc`} rotulo="Hi cut" /><Deslizante caminho={`${prefixo}/flt/hcf`} rotulo="" compacto /></div>
          </>
        )}
        <button className="link" onClick={() => {
          for (const b of bandas) if (def(`${eq}/STD/${b.k}g`)) definir(`${eq}/STD/${b.k}g`, 0);
        }}>Zerar ganhos das bandas</button>
      </div>
      <div className="eq-centro">
        <EqGrafico prefixo={prefixo} selecionada={sel} aoSelecionar={setSel} />
        {mdl === 'STD' && (
          <div className="bandas">
            {bandas.map((b) => (
              <div key={b.k} className={`banda ${sel === b.k ? 'sel' : ''}`} style={{ '--cor-banda': b.cor } as React.CSSProperties} onPointerDown={() => setSel(b.k)}>
                <div className="banda-cab"><span className="bolinha" />{b.nome}</div>
                {def(`${eq}/STD/${b.k}eq`) && <Lista caminho={`${eq}/STD/${b.k}eq`} rotulo="Tipo" />}
                <Deslizante caminho={`${eq}/STD/${b.k}g`} rotulo="Ganho" compacto />
                <Deslizante caminho={`${eq}/STD/${b.k}f`} rotulo="Freq." compacto />
                <Deslizante caminho={`${eq}/STD/${b.k}q`} rotulo="Q" compacto />
              </div>
            ))}
          </div>
        )}
        {mdl !== 'STD' && <GradeDoModelo caminhos={filhos(`${eq}/${mdl}`).map((d) => d.caminho)} />}
        {temPeq && (
          <details className="peq">
            <summary>EQ de entrada (3 bandas, antes de tudo)</summary>
            <div className="linha-botoes"><Botao caminho={`${prefixo}/peq/on`} rotulo="Ligado" /></div>
            <GradeDoModelo caminhos={filhos(`${prefixo}/peq`).filter((d) => !d.caminho.endsWith('/on')).map((d) => d.caminho)} />
          </details>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Abas Gate e Comp
// ---------------------------------------------------------------------------
function AbaDinamica({ prefixo, bloco }: { prefixo: string; bloco: 'gate' | 'dyn' }) {
  const base = `${prefixo}/${bloco}`;
  const temModelo = !!def(`${base}/mdl`);
  const mdl = useTexto(temModelo ? `${base}/mdl` : null);
  const { tipo, n } = partesDaTira(prefixo);
  const sc = `${prefixo}/${bloco}sc`;
  // Parametros: os do modelo atual (mesmo id para modelos diferentes) ou, sem
  // modelo (aux), os filhos diretos.
  const params = temModelo
    ? filhos(`${base}/${mdl}`).map((d) => d.caminho)
    : filhos(base).filter((d) => !/\/(on|mdl|\$[^/]*)$/.test(d.caminho)).map((d) => d.caminho);
  const extras = ['mix', 'gain'].map((k) => `${base}/${k}`).filter((c) => def(c));
  return (
    <div className="aba-din">
      <div className="din-lado">
        <div className="linha-botoes">
          <Botao caminho={`${base}/on`} rotulo={bloco === 'gate' ? 'Gate ligado' : 'Comp ligado'} />
        </div>
        {temModelo && <Lista caminho={`${base}/mdl`} rotulo="Modelo" />}
        {tipo === 'ch' && (
          <div className="din-medidores">
            <div>
              <span className="param-nome">Entrada</span>
              <Medidor indices={[indiceMedidor('ch', n, bloco === 'gate' ? 4 : 6)]} horizontal />
            </div>
            <div>
              <span className="param-nome">Redução</span>
              <MedidorReducao indice={indiceMedidor('ch', n, bloco === 'gate' ? 5 : 7)} horizontal />
            </div>
          </div>
        )}
        {extras.map((c) => <Deslizante key={c} caminho={c} />)}
      </div>
      <div className="din-centro">
        <GradeDoModelo caminhos={params} />
        {def(`${sc}/type`) && (
          <details className="sidechain">
            <summary>Sidechain (o que dispara o {bloco === 'gate' ? 'gate' : 'compressor'})</summary>
            <GradeDoModelo caminhos={filhos(sc).filter((d) => !d.caminho.includes('$')).map((d) => d.caminho)} />
          </details>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba Envios
// ---------------------------------------------------------------------------
function LinhaEnvio({ base, destino, compacto = false }: { base: string; destino: string; compacto?: boolean }) {
  const on = useNumero(`${base}/on`);
  const nome = nomeDaTira(destino, useValor(`${destino}/name`));
  const cor = corWing(useValor(`${destino}/col`));
  const temModo = !!def(`${base}/mode`);
  const temPre = !!def(`${base}/pre`);
  return (
    <div className={`linha-envio ${on ? '' : 'desligado'}`} style={{ '--cor': cor } as React.CSSProperties}>
      <button className={`envio-nome botao-liga ${on ? 'ligado' : ''}`} aria-pressed={!!on} onClick={() => definir(`${base}/on`, on ? 0 : 1)} title={on ? 'Desligar envio' : 'Ligar envio'}>
        <span className="envio-cor" />{nome}
      </button>
      <Fader caminho={`${base}/lvl`} horizontal rotulo={`Envio para ${nome}`} desligado={!on} marcas={false} />
      <ValorFader caminho={`${base}/lvl`} />
      {!compacto && temModo && <Lista caminho={`${base}/mode`} sem />}
      {!compacto && !temModo && temPre && <Botao caminho={`${base}/pre`} rotulo="Pré" title="Antes do fader" />}
    </div>
  );
}

function AbaEnvios({ prefixo }: { prefixo: string }) {
  const buses = Array.from({ length: 16 }, (_, i) => i + 1).filter((b) => def(`${prefixo}/send/${b}/on`));
  const mtx = Array.from({ length: 8 }, (_, i) => i + 1).filter((m) => def(`${prefixo}/send/MX${m}/on`));
  const mains = [1, 2, 3, 4].filter((m) => def(`${prefixo}/main/${m}/on`));
  return (
    <div className="aba-envios">
      {buses.length > 0 && (
        <div className="coluna-envios">
          <h3>Buses</h3>
          {buses.map((b) => <LinhaEnvio key={b} base={`${prefixo}/send/${b}`} destino={`/bus/${b}`} />)}
        </div>
      )}
      <div className="coluna-envios">
        {mains.length > 0 && <h3>Mains</h3>}
        {mains.map((m) => <LinhaEnvio key={m} base={`${prefixo}/main/${m}`} destino={`/main/${m}`} />)}
        {mtx.length > 0 && <h3>Matrizes</h3>}
        {mtx.map((m) => <LinhaEnvio key={m} base={`${prefixo}/send/MX${m}`} destino={`/mtx/${m}`} />)}
      </div>
    </div>
  );
}

export { LinhaEnvio, SeletorCor, Cartao };
