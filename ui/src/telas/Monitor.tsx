// Tela Monitor: o que o operador ouve nos fones e nos alto-falantes da
// tecnica, como o solo funciona e o talkback (falar no retorno dos musicos).

import { def, definir, useNumero, useTexto, useValor } from '../store';
import { corWing, nomeDaTira, textoDb, FADER_MIN } from '../util';
import { Botao, Deslizante, Lista } from '../comp/Parametro';
import { Fader } from '../comp/Fader';

/** "BUS.3" -> nome do bus 3. */
function nomeDaFonteMon(k: string) {
  if (k === 'OFF') return 'Nada';
  const [g, n] = k.split('.');
  const p = { MAIN: '/main', MTX: '/mtx', BUS: '/bus', AUX: '/aux' }[g];
  return p ? nomeDaTira(`${p}/${n}`) : k;
}

export function FonteMonitor({ saida, rotulo = 'Ouvir' }: { saida: 1 | 2; rotulo?: string }) {
  const c = `/cfg/mon/${saida}/src`;
  const v = useTexto(c, 'OFF');
  const d = def(c);
  // Re-renderiza quando os nomes mudam.
  useValor('/bus/1/name');
  if (!d?.itens) return null;
  const grupos: Record<string, string[]> = { Mains: [], Matrizes: [], Buses: [], Aux: [] };
  for (const [k] of d.itens) {
    const s = String(k);
    if (s.startsWith('MAIN')) grupos.Mains.push(s);
    else if (s.startsWith('MTX')) grupos.Matrizes.push(s);
    else if (s.startsWith('BUS')) grupos.Buses.push(s);
    else if (s.startsWith('AUX')) grupos.Aux.push(s);
  }
  return (
    <label className="param lista">
      <span className="param-nome">{rotulo}</span>
      <select value={v} onChange={(e) => definir(c, e.target.value)}>
        <option value="OFF">Nada</option>
        {Object.entries(grupos).map(([g, l]) => (
          <optgroup key={g} label={g}>{l.map((k) => <option key={k} value={k}>{nomeDaFonteMon(k)}</option>)}</optgroup>
        ))}
      </select>
    </label>
  );
}

function Saida({ n, nome }: { n: 1 | 2; nome: string }) {
  const b = `/cfg/mon/${n}`;
  const nivel = useNumero(`${b}/$lvl`, FADER_MIN);
  const dly = useNumero(`${b}/dly/on`);
  return (
    <div className="cartao">
      <div className="cartao-cab"><h3>{nome}</h3><span className="dica">volume no botão da mesa: {textoDb(nivel)} dB</span></div>
      <FonteMonitor saida={n} />
      <div className="param desl"><span className="param-nome">Nível da fonte</span><Fader caminho={`${b}/srclvl`} horizontal rotulo={`Nível da fonte nos ${nome.toLowerCase()}`} marcas={false} /><ValorDb caminho={`${b}/srclvl`} /></div>
      <div className="param desl"><span className="param-nome">Fonte no solo</span><Fader caminho={`${b}/srcmix`} horizontal rotulo="Quanto da fonte continua tocando quando há solo" marcas={false} /><ValorDb caminho={`${b}/srcmix`} /></div>
      <Deslizante caminho={`${b}/dim`} rotulo="Dim" />
      <Deslizante caminho={`${b}/lim`} rotulo="Limitador" />
      <Deslizante caminho={`${b}/pan`} rotulo="Pan" />
      <div className="linha-botoes">
        <Botao caminho={`${b}/inv`} rotulo="Fase Ø" />
        <Botao caminho={`${b}/dly/on`} rotulo="Delay" />
        <Botao caminho={`${b}/eq/on`} rotulo="EQ" />
      </div>
      {!!dly && <Deslizante caminho={`${b}/dly/m`} rotulo="Distância" />}
    </div>
  );
}

function ValorDb({ caminho }: { caminho: string }) {
  const v = useNumero(caminho, FADER_MIN);
  return <span className="param-valor">{textoDb(v)} dB</span>;
}

function Destino({ base, chave, prefixo }: { base: string; chave: string; prefixo: string }) {
  const c = `${base}/${chave}`;
  const on = useNumero(c);
  const nome = nomeDaTira(prefixo, useValor(`${prefixo}/name`));
  const cor = corWing(useValor(`${prefixo}/col`));
  if (!def(c)) return null;
  return (
    <button className={`chip ${on ? 'ativo' : ''}`} style={{ '--cor': cor } as React.CSSProperties} aria-pressed={!!on} onClick={() => definir(c, on ? 0 : 1)}>
      {nome}
    </button>
  );
}

function Talkback({ k }: { k: 'A' | 'B' }) {
  const b = `/cfg/talk/${k}`;
  const on = useNumero(`${b}/$on`);
  const modo = useTexto(`${b}/mode`);
  const falar = (v: number) => definir(`${b}/$on`, v);
  return (
    <div className="cartao talk">
      <div className="cartao-cab"><h3>Talkback {k}</h3><Lista caminho={`${b}/mode`} sem /></div>
      <button
        className={`botao-falar ${on ? 'ligado' : ''}`}
        aria-pressed={!!on}
        onPointerDown={() => { if (modo === 'PUSH') falar(1); }}
        onPointerUp={() => { if (modo === 'PUSH') falar(0); }}
        onPointerLeave={() => { if (modo === 'PUSH' && on) falar(0); }}
        onClick={() => { if (modo !== 'PUSH') falar(on ? 0 : 1); }}
      >
        {on ? 'Falando…' : modo === 'PUSH' ? 'Segure para falar' : 'Falar'}
      </button>
      <span className="param-nome">Para quem</span>
      <div className="chips">
        {Array.from({ length: 16 }, (_, i) => <Destino key={i} base={b} chave={`B${i + 1}`} prefixo={`/bus/${i + 1}`} />)}
        {Array.from({ length: 4 }, (_, i) => <Destino key={`m${i}`} base={b} chave={`M${i + 1}`} prefixo={`/main/${i + 1}`} />)}
        {Array.from({ length: 8 }, (_, i) => <Destino key={`x${i}`} base={b} chave={`MX${i + 1}`} prefixo={`/mtx/${i + 1}`} />)}
      </div>
      <Deslizante caminho={`${b}/busdim`} rotulo="Abaixar a mix" />
      <Deslizante caminho={`${b}/mondim`} rotulo="Abaixar os fones" />
    </div>
  );
}

export function Monitor() {
  return (
    <div className="tela-form">
      <h1>Monitor</h1>
      <section className="grade-monitor">
        <Saida n={1} nome="Fones" />
        <Saida n={2} nome="Alto-falantes" />
        <div className="cartao">
          <div className="cartao-cab"><h3>Solo</h3></div>
          <Lista caminho="/cfg/solo/mode" rotulo="Modo" />
          <Lista caminho="/cfg/solo/mon" rotulo="Onde ouvir" />
          <Lista caminho="/cfg/solo/chtap" rotulo="Canais" />
          <Lista caminho="/cfg/solo/bustap" rotulo="Buses" />
          <Lista caminho="/cfg/solo/maintap" rotulo="Mains" />
          <Lista caminho="/cfg/solo/mtxtap" rotulo="Matrizes" />
          <div className="linha-botoes">
            <Botao caminho="/cfg/solo/$dim" rotulo="Dim" />
            <Botao caminho="/cfg/solo/$mono" rotulo="Mono" />
            <Botao caminho="/cfg/solo/$flip" rotulo="Inverter E/D" />
          </div>
          <p className="dica">“Antes do fader” (PFL) ouve o canal mesmo com o fader embaixo. Para ouvir a mix de um músico, escolha o bus dele em “Ouvir”, nos fones.</p>
        </div>
      </section>
      <section className="grade-monitor">
        <Talkback k="A" />
        <Talkback k="B" />
      </section>
    </div>
  );
}
