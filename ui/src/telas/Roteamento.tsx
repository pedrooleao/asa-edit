// Tela Roteamento: de onde vem cada canal (Entradas), o que toca em cada
// saida de cada aparelho (Saidas) e um assistente para ligar os retornos dos
// musicos nas saidas do SD16 em um passo.

import { useMemo, useState } from 'react';
import { def, definir, indiceMedidor, useValor, useValores } from '../store';
import { useUi, mudarUi } from '../ui';
import { caminhoFonte, contarGrupo, corWing, GRUPOS_FONTE, lista, nomeDaFonteInterna, nomeDaTira, textoFonte } from '../util';
import { SeletorFonte, SeletorModo } from '../comp/Fonte';
import { Botao, CampoTexto, Deslizante } from '../comp/Parametro';
import { Medidor } from '../comp/Medidor';
import { canalVazio } from './Retornos';

type Aba = 'entradas' | 'saidas' | 'retornos';

export function Roteamento() {
  const [aba, setAba] = useState<Aba>('entradas');
  return (
    <div className="roteamento">
      <nav className="abas-camada sub" role="tablist">
        <button role="tab" aria-selected={aba === 'entradas'} className={aba === 'entradas' ? 'ativa' : ''} onClick={() => setAba('entradas')}>Entradas</button>
        <button role="tab" aria-selected={aba === 'saidas'} className={aba === 'saidas' ? 'ativa' : ''} onClick={() => setAba('saidas')}>Saídas</button>
        <button role="tab" aria-selected={aba === 'retornos'} className={aba === 'retornos' ? 'ativa' : ''} onClick={() => setAba('retornos')}>Saídas dos retornos</button>
      </nav>
      {aba === 'entradas' && <Entradas />}
      {aba === 'saidas' && <Saidas />}
      {aba === 'retornos' && <AssistenteRetornos />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------
const TIRAS_ENTRADA = [...lista('ch'), ...lista('aux')];
const CAMINHOS_VAZIO = TIRAS_ENTRADA.flatMap((f) => [`${f}/name`, `${f}/in/conn/grp`]);

function LinhaEntrada({ prefixo }: { prefixo: string }) {
  const grp = useValor(`${prefixo}/in/conn/grp`);
  const n = useValor(`${prefixo}/in/conn/in`);
  const fonte = caminhoFonte(grp, n);
  const nome = nomeDaTira(prefixo, useValor(`${prefixo}/name`));
  const cor = corWing(useValor(`${prefixo}/col`));
  const [tipo, num] = prefixo.split('/').slice(1);
  return (
    <tr style={{ '--cor': cor } as React.CSSProperties}>
      <td className="col-canal">
        <span className="envio-cor" />
        <span className="num-canal">{tipo === 'aux' ? `A${num}` : num}</span>
        <button className="link nome-canal" onClick={() => mudarUi({ tela: 'mixer', selecionado: prefixo, painelAberto: true, aba: 'canal' })} title="Abrir no mixer">{nome}</button>
      </td>
      <td><SeletorFonte base={`${prefixo}/in/conn`} compacto /></td>
      <td><SeletorModo base={`${prefixo}/in/conn`} compacto /></td>
      <td>{fonte && def(`${fonte}/name`) ? <CampoTexto caminho={`${fonte}/name`} rotulo="" placeholder={textoFonte(grp, n, true)} /> : <span className="dica">–</span>}</td>
      <td className="col-ganho">{fonte && def(`${fonte}/g`) ? <Deslizante caminho={`${fonte}/g`} rotulo="" compacto /> : <span className="dica">–</span>}</td>
      <td>{fonte && def(`${fonte}/vph`) ? <Botao caminho={`${fonte}/vph`} rotulo="48V" tipo="alerta" /> : null}</td>
      <td>{fonte && def(`${fonte}/pol`) ? <Botao caminho={`${fonte}/pol`} rotulo="Ø" title="Inverter a polaridade da fonte" /> : null}</td>
      <td className="col-medidor"><Medidor indices={[indiceMedidor(tipo, Number(num), 0)]} horizontal /></td>
    </tr>
  );
}

function Entradas() {
  const esconder = useUi('esconderVazios');
  const vals = useValores(CAMINHOS_VAZIO);
  const tiras = useMemo(() => TIRAS_ENTRADA.filter((t) => !esconder || !canalVazio(t)), [esconder, vals]);
  return (
    <div className="rot-corpo">
      <div className="rot-barra">
        <p className="dica">Fonte de cada canal. Para usar duas entradas num fader só (bateria, teclado em L/R), escolha “Estéreo”. Ganho, 48V e fase ficam na fonte (no SD16 ou na mesa).</p>
        <label className="caixa"><input type="checkbox" checked={esconder} onChange={(e) => mudarUi({ esconderVazios: e.target.checked })} /> Esconder canais vazios</label>
      </div>
      <table className="tabela-rot">
        <thead>
          <tr><th>Canal</th><th>Fonte</th><th>Canais</th><th>Nome da fonte</th><th>Ganho</th><th>48V</th><th>Fase</th><th>Sinal</th></tr>
        </thead>
        <tbody>
          {tiras.map((t) => <LinhaEntrada key={t} prefixo={t} />)}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saidas
// ---------------------------------------------------------------------------
const APARELHOS = [
  { id: 'LCL', nome: 'Mesa (Local)' },
  { id: 'AUX', nome: 'Aux out' },
  { id: 'A', nome: 'SD16 A (AES50 A)' },
  { id: 'B', nome: 'SD16 B (AES50 B)' },
  { id: 'C', nome: 'AES50 C' },
  { id: 'USB', nome: 'USB' },
  { id: 'CRD', nome: 'Cartão' },
  { id: 'MOD', nome: 'Módulo (Dante)' },
  { id: 'SC', nome: 'StageConnect' },
  { id: 'AES', nome: 'AES/EBU' },
];

/** O que toca numa saida, com nome e cor quando da para saber. */
export function useOQueToca(base: string) {
  const grp = String(useValor(`${base}/grp`) ?? 'OFF');
  const n = Number(useValor(`${base}/in`) ?? 1);
  const interna = nomeDaFonteInterna(grp, n);
  const nomeInterna = useValor(interna ? `${interna}/name` : null);
  const corInterna = useValor(interna ? `${interna}/col` : null);
  const mono = useValor(interna && interna.startsWith('/bus') ? `${interna}/busmono` : null);
  const fonte = caminhoFonte(grp, n);
  const nomeFonte = useValor(fonte && !interna ? `${fonte}/name` : null);
  if (grp === 'OFF') return { nome: 'Nada', cor: null, detalhe: '' };
  if (interna) {
    const lado = mono ? '' : n % 2 ? ' (E)' : ' (D)';
    return { nome: `${nomeDaTira(interna, nomeInterna)}${lado}`, cor: corWing(corInterna), detalhe: textoFonte(grp, n, true) };
  }
  return { nome: String(nomeFonte || '') || textoFonte(grp, n, true), cor: null, detalhe: textoFonte(grp, n, true) };
}

function CartaoSaida({ grupo, n }: { grupo: string; n: number }) {
  const base = `/io/out/${grupo}/${n}`;
  const toca = useOQueToca(base);
  return (
    <div className={`cartao-saida ${toca.nome === 'Nada' ? 'vazia' : ''}`} style={{ '--cor': toca.cor || 'var(--linha)' } as React.CSSProperties}>
      <div className="saida-cab">
        <span className="saida-num">{n}</span>
        <strong title={toca.detalhe}>{toca.nome}</strong>
      </div>
      <SeletorFonte base={base} compacto />
    </div>
  );
}

function Saidas() {
  const [aparelho, setAparelho] = useState('A');
  const existentes = APARELHOS.filter((a) => contarGrupo('out', a.id) > 0);
  const qtd = contarGrupo('out', aparelho);
  // Conta quantas saidas de cada aparelho estao em uso, para o resumo nas abas.
  const caminhos = useMemo(() => existentes.flatMap((a) => Array.from({ length: contarGrupo('out', a.id) }, (_, i) => `/io/out/${a.id}/${i + 1}/grp`)), []);
  const vals = useValores(caminhos);
  const usadas = (id: string) => caminhos.reduce((s, c, i) => s + (c.startsWith(`/io/out/${id}/`) && vals[i] && vals[i] !== 'OFF' ? 1 : 0), 0);
  return (
    <div className="rot-corpo">
      <div className="aparelhos" role="tablist">
        {existentes.map((a) => (
          <button key={a.id} role="tab" aria-selected={aparelho === a.id} className={aparelho === a.id ? 'ativa' : ''} onClick={() => setAparelho(a.id)}>
            {a.nome}
            <span className="contagem">{usadas(a.id)}/{contarGrupo('out', a.id)}</span>
          </button>
        ))}
      </div>
      <p className="dica">Cada saída mostra o que toca nela. Para mudar, escolha o grupo e o número. Buses, mains e matrizes vêm em pares: E (esquerdo) e D (direito); num bus mono, use o E.</p>
      <div className="grade-saidas">
        {Array.from({ length: qtd }, (_, i) => <CartaoSaida key={`${aparelho}${i}`} grupo={aparelho} n={i + 1} />)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assistente: retornos nas saidas
// ---------------------------------------------------------------------------
const NOMES_BUS = Array.from({ length: 16 }, (_, i) => [`/bus/${i + 1}/name`, `/bus/${i + 1}/busmono`, `/bus/${i + 1}/col`]).flat();

function AssistenteRetornos() {
  const vals = useValores(NOMES_BUS);
  const [aparelho, setAparelho] = useState('A');
  const [inicio, setInicio] = useState(1);
  const [escolhidos, setEscolhidos] = useState<number[]>(() => Array.from({ length: 12 }, (_, i) => i + 1));
  const [feito, setFeito] = useState(false);
  const qtdSaidas = contarGrupo('out', aparelho);
  const plano = useMemo(() => {
    const l: { bus: number; saidas: number[]; estereo: boolean }[] = [];
    let s = inicio;
    for (const b of escolhidos) {
      const estereo = !vals[(b - 1) * 3 + 1];
      const saidas = estereo ? [s, s + 1] : [s];
      l.push({ bus: b, saidas, estereo });
      s += saidas.length;
    }
    return l;
  }, [escolhidos, inicio, vals]);
  const passou = plano.some((p) => p.saidas.some((s) => s > qtdSaidas));

  function aplicar() {
    for (const p of plano) {
      p.saidas.forEach((s, k) => {
        if (s > qtdSaidas) return;
        definir(`/io/out/${aparelho}/${s}/grp`, 'BUS');
        definir(`/io/out/${aparelho}/${s}/in`, (p.bus - 1) * 2 + 1 + k);
      });
    }
    setFeito(true);
    setTimeout(() => setFeito(false), 2500);
  }

  return (
    <div className="rot-corpo assistente">
      <p>Liga cada mix de retorno numa saída, em sequência. Mixes estéreo usam duas saídas (E e D); mixes mono, uma.</p>
      <div className="linha-info">
        <label className="param lista"><span className="param-nome">Aparelho</span>
          <select value={aparelho} onChange={(e) => setAparelho(e.target.value)}>
            {APARELHOS.filter((a) => contarGrupo('out', a.id) > 0).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </label>
        <label className="param lista"><span className="param-nome">Começar na saída</span>
          <select value={inicio} onChange={(e) => setInicio(Number(e.target.value))}>
            {Array.from({ length: qtdSaidas }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
        </label>
      </div>
      <div className="assistente-grade">
        <div>
          <h3>Mixes</h3>
          <div className="lista-escolha">
            {Array.from({ length: 16 }, (_, i) => i + 1).map((b) => {
              const marcado = escolhidos.includes(b);
              return (
                <label key={b} className="caixa linha-escolha" style={{ '--cor': corWing(vals[(b - 1) * 3 + 2]) } as React.CSSProperties}>
                  <input type="checkbox" checked={marcado} onChange={() => setEscolhidos(marcado ? escolhidos.filter((x) => x !== b) : [...escolhidos, b].sort((x, y) => x - y))} />
                  <span className="envio-cor" />
                  {nomeDaTira(`/bus/${b}`, vals[(b - 1) * 3])}
                  <span className="dica">{vals[(b - 1) * 3 + 1] ? 'mono' : 'estéreo'}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <h3>Como vai ficar</h3>
          <table className="tabela-rot previa">
            <tbody>
              {plano.map((p) => (
                <tr key={p.bus} className={p.saidas.some((s) => s > qtdSaidas) ? 'erro' : ''}>
                  <td>{GRUPOS_FONTE[aparelho]?.curto || aparelho} {p.saidas.join(' e ')}</td>
                  <td>← {nomeDaTira(`/bus/${p.bus}`, vals[(p.bus - 1) * 3])}{p.estereo ? ' (E/D)' : ''}</td>
                  <td className="dica">antes: <SaidaAntes base={`/io/out/${aparelho}/${p.saidas[0]}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {passou && <p className="erro">Não cabe: o aparelho tem {qtdSaidas} saídas. Comece mais cedo ou escolha menos mixes.</p>}
          <button className="primario" disabled={!plano.length || passou} onClick={aplicar}>{feito ? 'Pronto!' : 'Ligar as saídas'}</button>
        </div>
      </div>
    </div>
  );
}

function SaidaAntes({ base }: { base: string }) {
  const t = useOQueToca(base);
  return <>{def(`${base}/grp`) ? t.nome : '—'}</>;
}

