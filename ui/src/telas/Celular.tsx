// Tela do celular do musico (papel "retorno"): so a propria mix. Volume geral
// em cima, um deslizante grande por canal, favoritos (estrela) primeiro.
// O servidor so deixa mexer nos envios do bus escolhido.

import { useEffect, useMemo, useState } from 'react';
import { def, definir, entrarComoTecnico, enviar, indiceMedidor, useGeral, useNumero, useValor, useValores } from '../store';
import { corWing, gravarLocal, lerLocal, lista, nomeDaTira, textoDb, FADER_MIN } from '../util';
import { Fader } from '../comp/Fader';
import { Medidor } from '../comp/Medidor';
import { Icone } from '../comp/Icones';
import { canalVazio } from './Retornos';

const FONTES = [...lista('ch'), ...lista('aux')];
const CAMINHOS_VAZIO = FONTES.flatMap((f) => [`${f}/name`, `${f}/in/conn/grp`]);
const NOMES_BUS = Array.from({ length: 16 }, (_, i) => `/bus/${i + 1}/name`);

function busDaUrl() {
  const n = parseInt(new URLSearchParams(location.search).get('retorno') || '', 10);
  return n >= 1 && n <= 16 ? n : null;
}

function EscolherMix({ escolher }: { escolher: (n: number) => void }) {
  useValores(NOMES_BUS);
  return (
    <main className="cel-escolha">
      <h1>Qual é a sua mix?</h1>
      <p className="dica">Escolha o seu retorno. Dá para trocar depois.</p>
      <div className="cel-buses">
        {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
          <BotaoBus key={n} n={n} escolher={escolher} />
        ))}
      </div>
      <EntrarTecnico />
    </main>
  );
}

const MOTIVOS: Record<string, string> = {
  errada: 'Senha errada.',
  espere: 'Muitas tentativas. Espere um minuto.',
  semSenha: 'Ainda não há senha do técnico. Defina em Ajustes, no aparelho principal.',
};

/** O tecnico entra com a senha e este aparelho passa a controlar a mesa toda. */
function EntrarTecnico() {
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  if (!aberto) {
    return <button className="link cel-tecnico" onClick={() => setAberto(true)}>Sou o técnico: controlar a mesa toda</button>;
  }
  return (
    <form
      className="cel-tecnico-form"
      onSubmit={async (ev) => {
        ev.preventDefault();
        if (!senha) return;
        setEnviando(true);
        const r = await entrarComoTecnico(senha);
        setEnviando(false);
        if (r !== 'ok') { setErro(MOTIVOS[r] || 'Não deu certo. Tente de novo.'); setSenha(''); }
      }}
    >
      <label>
        <span>Senha do técnico</span>
        <input type="password" autoComplete="current-password" autoFocus value={senha} onChange={(ev) => { setSenha(ev.target.value); setErro(''); }} />
      </label>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="linha-info">
        <button type="submit" className="primario" disabled={!senha || enviando}>Entrar</button>
        <button type="button" onClick={() => { setAberto(false); setErro(''); setSenha(''); }}>Cancelar</button>
      </div>
      <p className="dica">Este aparelho fica lembrado. Dá para tirar o acesso depois, em Ajustes.</p>
    </form>
  );
}

function BotaoBus({ n, escolher }: { n: number; escolher: (n: number) => void }) {
  const nome = nomeDaTira(`/bus/${n}`, useValor(`/bus/${n}/name`));
  const cor = corWing(useValor(`/bus/${n}/col`));
  return (
    <button className="cel-bus" style={{ '--cor': cor } as React.CSSProperties} onClick={() => escolher(n)}>
      <span className="item-cor" />
      <span>{nome}</span>
    </button>
  );
}

function LinhaCanal({ fonte, bus, fav, alternarFav }: { fonte: string; bus: number; fav: boolean; alternarFav: () => void }) {
  const base = `${fonte}/send/${bus}`;
  const nome = nomeDaTira(fonte, useValor(`${fonte}/name`));
  const cor = corWing(useValor(`${fonte}/col`));
  const on = useNumero(`${base}/on`);
  const lvl = useNumero(`${base}/lvl`, FADER_MIN);
  const [tipo, n] = fonte.split('/').slice(1);
  return (
    <li className={`cel-canal ${on ? '' : 'desligado'}`} style={{ '--cor': cor } as React.CSSProperties}>
      <div className="cel-canal-cab">
        <button className={`estrela ${fav ? 'ligada' : ''}`} onClick={alternarFav} aria-pressed={fav} aria-label={fav ? `Tirar ${nome} dos favoritos` : `Fixar ${nome} em cima`}>
          <Icone nome="estrela" tamanho={1.15} />
        </button>
        <span className="cel-cor" />
        <button className="cel-nome" onClick={() => definir(`${base}/on`, on ? 0 : 1)} title="Toque para ligar/desligar este canal na sua mix">
          {nome}{!on && <small> · desligado</small>}
        </button>
        <span className="cel-db">{textoDb(lvl)}</span>
      </div>
      <Fader caminho={`${base}/lvl`} horizontal rotulo={`${nome} na minha mix`} desligado={!on} marcas={false} />
      <Medidor indices={[indiceMedidor(tipo, Number(n), 0)]} horizontal className="cel-medidor" />
    </li>
  );
}

export function Celular() {
  const { geral, papel, ligadoAoApp } = useGeral();
  const [bus, setBus] = useState<number | null>(papel?.bus ?? busDaUrl());
  const chaveFav = `favoritos.${bus}`;
  const [favs, setFavs] = useState<string[]>(() => lerLocal(chaveFav, []));
  useEffect(() => { setFavs(lerLocal(`favoritos.${bus}`, [])); }, [bus]);
  const nomesEFontes = useValores(CAMINHOS_VAZIO);
  const estado = geral?.estado.estado;

  function escolher(n: number | null) {
    setBus(n);
    enviar({ t: 'escolherRetorno', bus: n });
    const url = new URL(location.href);
    if (n) url.searchParams.set('retorno', String(n)); else url.searchParams.delete('retorno');
    history.replaceState(null, '', url);
  }
  // Ao reconectar, o servidor precisa saber de novo qual e' a mix.
  useEffect(() => { if (ligadoAoApp && bus) enviar({ t: 'escolherRetorno', bus }); }, [ligadoAoApp, bus]);

  const fontes = useMemo(() => {
    if (!bus) return [];
    const l = FONTES.filter((f) => def(`${f}/send/${bus}/lvl`) && !canalVazio(f));
    return [...l.filter((f) => favs.includes(f)), ...l.filter((f) => !favs.includes(f))];
  }, [bus, favs, nomesEFontes]);

  const aviso = !ligadoAoApp ? 'Sem conexão com o Asa Edit. Tentando de novo…' : estado !== 'conectado' ? 'O Asa Edit perdeu a mesa. Esperando voltar…' : null;

  if (!bus) return <EscolherMix escolher={escolher} />;
  const p = `/bus/${bus}`;
  return (
    <div className="celular">
      <CabecalhoMix bus={bus} trocar={() => escolher(null)} />
      {aviso && <div className="aviso-conexao" role="status"><span className="girando" aria-hidden="true" />{aviso}</div>}
      <section className="cel-geral" aria-label="Volume geral">
        <div className="cel-canal-cab">
          <strong>Volume geral</strong>
          <BotaoMute caminho={`${p}/mute`} />
          <ValorDb caminho={`${p}/fdr`} />
        </div>
        <Fader caminho={`${p}/fdr`} horizontal rotulo="Volume geral da minha mix" marcas={false} />
        <Medidor indices={[indiceMedidor('bus', bus, 2), indiceMedidor('bus', bus, 3)]} horizontal className="cel-medidor" />
      </section>
      <ul className="cel-lista">
        {fontes.map((f) => (
          <LinhaCanal
            key={f}
            fonte={f}
            bus={bus}
            fav={favs.includes(f)}
            alternarFav={() => {
              const novos = favs.includes(f) ? favs.filter((x) => x !== f) : [...favs, f];
              setFavs(novos);
              gravarLocal(chaveFav, novos);
            }}
          />
        ))}
        {!fontes.length && <li className="dica">Nenhum canal com nome na mesa.</li>}
      </ul>
      <p className="dica cel-rodape">Toque no nome para ligar ou desligar o canal. A estrela fixa o canal em cima.</p>
    </div>
  );
}

function CabecalhoMix({ bus, trocar }: { bus: number; trocar: () => void }) {
  const nome = nomeDaTira(`/bus/${bus}`, useValor(`/bus/${bus}/name`));
  const cor = corWing(useValor(`/bus/${bus}/col`));
  return (
    <header className="cel-cab" style={{ '--cor': cor } as React.CSSProperties}>
      <span className="cel-cor" />
      <div>
        <span className="dica">Minha mix</span>
        <h1>{nome}</h1>
      </div>
      <button onClick={trocar}>Trocar</button>
    </header>
  );
}

function BotaoMute({ caminho }: { caminho: string }) {
  const m = useNumero(caminho);
  return <button className={`botao-liga mute ${m ? 'ligado' : ''}`} aria-pressed={!!m} onClick={() => definir(caminho, m ? 0 : 1)}>{m ? 'Mutado' : 'Mute'}</button>;
}

function ValorDb({ caminho }: { caminho: string }) {
  const v = useNumero(caminho, FADER_MIN);
  return <span className="cel-db">{textoDb(v)}</span>;
}
