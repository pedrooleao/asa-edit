// Tela Retornos (no Mac): a mix de cada musico. Escolhe o bus na lista da
// esquerda; os faders passam a ser os envios de cada canal para aquele bus
// ("envios nos faders"). Do lado direito, o volume geral do bus.

import { useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import { def, definir, enviar, indiceMedidor, useGeral, useNumero, useTexto, useValor, useValores, valor } from '../store';
import { mudarUi, useFecharComEsc, useUi } from '../ui';
import { corWing, lista, nomeDaTira, partesDaTira, textoDb, FADER_MIN } from '../util';
import { Fader } from '../comp/Fader';
import { Medidor } from '../comp/Medidor';
import { Icone } from '../comp/Icones';
import { useRolarDeLado } from '../comp/roda';
import { confirmar } from '../comp/Confirmar';

const FONTES = [...lista('ch'), ...lista('aux')];
const CAMINHOS_VAZIO = FONTES.flatMap((f) => [`${f}/name`, `${f}/in/conn/grp`]);

/** Canal "vazio": sem nome e sem fonte (nao aparece quando esconder vazios). */
export function canalVazio(prefixo: string) {
  const nome = String(valor(`${prefixo}/name`) || '').trim();
  const grp = valor(`${prefixo}/in/conn/grp`);
  return !nome && (!grp || grp === 'OFF');
}

function ItemBus({ n, sel }: { n: number; sel: boolean }) {
  const p = `/bus/${n}`;
  const nome = nomeDaTira(p, useValor(`${p}/name`));
  const cor = corWing(useValor(`${p}/col`));
  const mute = useNumero(`${p}/mute`);
  return (
    <button className={`item-bus ${sel ? 'sel' : ''}`} style={{ '--cor': cor } as React.CSSProperties} onClick={() => mudarUi({ retornoBus: n })} aria-current={sel ? 'true' : undefined}>
      <span className="item-cor" />
      <span className="item-num">{n}</span>
      <span className="item-nome">{nome}</span>
      {!!mute && <span className="item-mute">M</span>}
      <Medidor indices={[indiceMedidor('bus', n, 2)]} horizontal className="item-medidor" />
    </button>
  );
}

function TiraEnvio({ fonte, bus }: { fonte: string; bus: number }) {
  const base = `${fonte}/send/${bus}`;
  const on = useNumero(`${base}/on`);
  const nome = nomeDaTira(fonte, useValor(`${fonte}/name`));
  const cor = corWing(useValor(`${fonte}/col`));
  const lvl = useNumero(`${base}/lvl`, FADER_MIN);
  const modo = useTexto(`${base}/mode`);
  const { tipo, n } = partesDaTira(fonte);
  return (
    <div className={`tira tira-envio ${on ? '' : 'desligada'}`} style={{ '--cor': cor } as React.CSSProperties}>
      <div className="tira-cor" />
      <div className="tira-topo"><span className="tira-nome">{nome}</span></div>
      <button className={`botao-liga envio-on ${on ? 'ligado' : ''}`} aria-pressed={!!on} onClick={() => definir(`${base}/on`, on ? 0 : 1)} title={on ? 'Desligar este canal na mix' : 'Ligar este canal na mix'}>
        {on ? 'Ligado' : 'Desligado'}
      </button>
      {def(`${base}/mode`) && (
        <div className="pre-pos" role="group" aria-label="Antes ou depois do fader do canal">
          <button className={modo === 'PRE' ? 'ativo' : ''} aria-pressed={modo === 'PRE'} onClick={() => definir(`${base}/mode`, 'PRE')} title="Pré: não muda quando o fader do PA mexe">Pré</button>
          <button className={modo === 'POST' ? 'ativo' : ''} aria-pressed={modo === 'POST'} onClick={() => definir(`${base}/mode`, 'POST')} title="Pós: acompanha o fader do PA">Pós</button>
        </div>
      )}
      <div className="tira-meio">
        <Fader caminho={`${base}/lvl`} rotulo={`${nome} na mix`} desligado={!on} />
        <Medidor indices={[indiceMedidor(tipo, n, 0)]} />
      </div>
      <span className="tira-db">{textoDb(lvl)}</span>
      <div className="tira-pe"><span className="tira-num">{tipo === 'aux' ? `A${n}` : n}</span></div>
    </div>
  );
}

function MestreBus({ bus }: { bus: number }) {
  const p = `/bus/${bus}`;
  const mute = useNumero(`${p}/mute`);
  const db = useNumero(`${p}/fdr`, FADER_MIN);
  const mono = useNumero(`${p}/busmono`);
  return (
    <div className="mestre-bus">
      <h3>Volume geral</h3>
      <button className={`botao-liga mute ${mute ? 'ligado' : ''}`} aria-pressed={!!mute} onClick={() => definir(`${p}/mute`, mute ? 0 : 1)}>{mute ? 'Mutado' : 'Mute'}</button>
      <div className="tira-meio">
        <Fader caminho={`${p}/fdr`} rotulo="Volume geral do bus" />
        <Medidor indices={mono ? [indiceMedidor('bus', bus, 2)] : [indiceMedidor('bus', bus, 2), indiceMedidor('bus', bus, 3)]} />
      </div>
      <span className="tira-db">{textoDb(db)} dB</span>
    </div>
  );
}

export function Qr({ texto, tamanho = 12 }: { texto: string; tamanho?: number }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(texto);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [texto]);
  return <div className="qr" style={{ width: `${tamanho}rem`, height: `${tamanho}rem` }} dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label={`Código QR para ${texto}`} />;
}

function JanelaCelular({ bus, fechar }: { bus: number; fechar: () => void }) {
  const { geral } = useGeral();
  const rede = geral?.rede || [];
  // Prefere a rede cabeada/Wi-Fi comum (192.168, 10.) e evita as de VPN.
  const ordenada = [...rede].sort((a, b) => Number(/^(192\.168|10\.)/.test(b.ip)) - Number(/^(192\.168|10\.)/.test(a.ip)));
  const [ip, setIp] = useState(ordenada[0]?.ip || location.hostname);
  const porta = geral?.porta || location.port || 8730;
  const url = `http://${ip}:${porta}/?retorno=${bus}`;
  const acesso = geral?.config.acessoRede;
  const nome = nomeDaTira(`/bus/${bus}`);
  useFecharComEsc(fechar);
  return (
    <div className="fundo-modal" onClick={fechar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Abrir no celular" onClick={(e) => e.stopPropagation()}>
        <header><h2>Abrir “{nome}” no celular</h2><button className="icone-so" onClick={fechar} aria-label="Fechar"><Icone nome="fechar" /></button></header>
        {acesso === 'desligado' ? (
          <div className="aviso-caixa">
            <p>O acesso pela rede está desligado: o celular não vai conseguir entrar.</p>
            <button className="primario" onClick={() => enviar({ t: 'config', acessoRede: 'retorno' })}>Ligar acesso só para retornos</button>
          </div>
        ) : (
          <div className="qr-corpo">
            <Qr texto={url} />
            <ol className="passos">
              <li>O celular precisa estar no <strong>mesmo Wi-Fi</strong> do Mac.</li>
              <li>Aponte a câmera para o código.</li>
              <li>O músico só consegue mexer na mix “{nome}”.</li>
            </ol>
          </div>
        )}
        <div className="qr-endereco">
          <code>{url}</code>
          {ordenada.length > 1 && (
            <select aria-label="Rede" value={ip} onChange={(e) => setIp(e.target.value)}>
              {ordenada.map((r) => <option key={r.ip} value={r.ip}>{r.nome}: {r.ip}</option>)}
            </select>
          )}
          {!ordenada.length && <span className="aviso-txt">O Mac não está em nenhuma rede.</span>}
        </div>
      </div>
    </div>
  );
}

/** Poe a mix do musico nos fones do operador (e volta para o PA). */
function OuvirNosFones({ bus }: { bus: number }) {
  const src = useTexto('/cfg/mon/1/src');
  const ouvindo = src === `BUS.${bus}`;
  if (!def('/cfg/mon/1/src')) return null;
  return (
    <button
      className={`com-icone ${ouvindo ? 'ouvindo' : ''}`}
      aria-pressed={ouvindo}
      onClick={() => definir('/cfg/mon/1/src', ouvindo ? 'MAIN.1' : `BUS.${bus}`)}
      title={ouvindo ? 'Voltar a ouvir o PA nos fones' : 'Ouvir esta mix nos fones da mesa'}
    >
      <Icone nome="retornos" tamanho={1.1} />{ouvindo ? 'Ouvindo nos fones' : 'Ouvir nos fones'}
    </button>
  );
}

export function Retornos() {
  const bus = useUi('retornoBus');
  const esconder = useUi('esconderVazios');
  const [qr, setQr] = useState(false);
  const areaTiras = useRef<HTMLDivElement>(null);
  useRolarDeLado(areaTiras);
  const [copiarDe, setCopiarDe] = useState('');
  const [feito, setFeito] = useState('');
  const avisar = (t: string) => { setFeito(t); setTimeout(() => setFeito(''), 2500); };
  const p = `/bus/${bus}`;
  const nome = nomeDaTira(p, useValor(`${p}/name`));
  const cor = corWing(useValor(`${p}/col`));
  // Re-renderiza ao trocar nomes/fontes para saber quais canais estao vazios.
  useValores(CAMINHOS_VAZIO);
  const fontes = FONTES.filter((f) => def(`${f}/send/${bus}/lvl`) && (!esconder || !canalVazio(f)));

  // definir() junta tudo e manda em lotes de 25 ms.
  function lote(pares: [string, unknown][]) {
    for (const [c, v] of pares) definir(c, v as number | string);
  }
  function copiar(de: number) {
    if (!de || de === bus) return;
    const pares: [string, unknown][] = [];
    for (const f of FONTES) {
      for (const k of ['on', 'lvl', 'mode', 'pan']) {
        const c = `${f}/send/${de}/${k}`;
        if (def(c) && valor(c) !== undefined) pares.push([`${f}/send/${bus}/${k}`, valor(c)]);
      }
    }
    lote(pares);
    avisar(`Mix de ${nomeDaTira(`/bus/${de}`)} copiada`);
  }

  return (
    <div className="retornos">
      <aside className="lista-buses" aria-label="Mixes">
        <h3>Mixes</h3>
        {Array.from({ length: 16 }, (_, i) => <ItemBus key={i} n={i + 1} sel={bus === i + 1} />)}
      </aside>
      <section className="retorno-mix">
        <header className="retorno-cab" style={{ '--cor': cor } as React.CSSProperties}>
          <span className="painel-cor" />
          <h2>Mix de {nome}</h2>
          <button className="primario com-icone" onClick={() => setQr(true)}><Icone nome="celular" tamanho={1.1} />Abrir no celular</button>
          <OuvirNosFones bus={bus} />
          <div className="retorno-acoes">
            <select aria-label="Copiar a mix de outro músico" value={copiarDe} onChange={(e) => { setCopiarDe(''); const n = Number(e.target.value); if (n) confirmar(`Copiar a mix de ${nomeDaTira(`/bus/${n}`)} para ${nome}? A mix atual será substituída.`, { sim: 'Copiar' }).then((ok) => { if (ok) copiar(n); }); }}>
              <option value="">Copiar de…</option>
              {Array.from({ length: 16 }, (_, i) => i + 1).filter((n) => n !== bus).map((n) => <option key={n} value={n}>{nomeDaTira(`/bus/${n}`)}</option>)}
            </select>
            {feito && <span className="feito" role="status"><Icone nome="check" tamanho={1} />{feito}</span>}
            <button onClick={async () => { if (await confirmar(`Zerar a mix de ${nome}? Todos os envios vão para −∞.`, { sim: 'Zerar', perigo: true })) { lote(FONTES.filter((f) => def(`${f}/send/${bus}/lvl`)).map((f) => [`${f}/send/${bus}/lvl`, FADER_MIN])); avisar('Mix zerada'); } }}>Zerar mix</button>
            <button onClick={() => { lote(FONTES.filter((f) => def(`${f}/send/${bus}/on`) && !canalVazio(f)).map((f) => [`${f}/send/${bus}/on`, 1])); avisar('Todos ligados'); }}>Ligar todos</button>
            <label className="caixa">
              <input type="checkbox" checked={esconder} onChange={(e) => mudarUi({ esconderVazios: e.target.checked })} />
              Esconder canais vazios
            </label>
          </div>
        </header>
        <div className="retorno-corpo">
          <div className="tiras" ref={areaTiras}>
            {fontes.map((f) => <TiraEnvio key={f} fonte={f} bus={bus} />)}
          </div>
          <MestreBus bus={bus} />
        </div>
      </section>
      {qr && <JanelaCelular bus={bus} fechar={() => setQr(false)} />}
    </div>
  );
}
