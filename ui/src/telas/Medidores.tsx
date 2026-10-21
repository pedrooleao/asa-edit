// Tela Medidores: tudo ao mesmo tempo, sem faders. Bom para achar de onde vem
// um som ou ver se algum retorno esta clipando. Clique leva ao canal.

import { indiceMedidor, useNumero, useValor } from '../store';
import { mudarUi } from '../ui';
import { corWing, lista, nomeDaTira, numeroCurto, partesDaTira, type TipoTira } from '../util';
import { Medidor, MedidorReducao } from '../comp/Medidor';
import { indicesMedidor, useEstereo } from '../comp/Tira';

function Coluna({ prefixo }: { prefixo: string }) {
  const { tipo, n } = partesDaTira(prefixo);
  const nome = nomeDaTira(prefixo, useValor(`${prefixo}/name`));
  const cor = corWing(useValor(`${prefixo}/col`));
  const mute = useNumero(`${prefixo}/mute`);
  const estereo = useEstereo(prefixo);
  return (
    <button
      className={`col-medidor-g ${mute ? 'mutada' : ''}`}
      style={{ '--cor': cor } as React.CSSProperties}
      onClick={() => mudarUi({ tela: 'mixer', selecionado: prefixo, painelAberto: true })}
      title={`${nome}${mute ? ' (mutado)' : ''}: abrir no mixer`}
    >
      <span className="cor-topo" />
      <span className="barras">
        <Medidor indices={indicesMedidor(prefixo, estereo)} />
        {tipo === 'ch' && <MedidorReducao indice={indiceMedidor('ch', n, 7)} className="gr" />}
      </span>
      <span className="num">{numeroCurto(prefixo)}</span>
      <span className="nome">{nome}</span>
    </button>
  );
}

const GRUPOS: { tipo: TipoTira; nome: string }[] = [
  { tipo: 'ch', nome: 'Canais (entrada)' },
  { tipo: 'aux', nome: 'Aux' },
  { tipo: 'bus', nome: 'Buses (saída)' },
  { tipo: 'main', nome: 'Mains' },
  { tipo: 'mtx', nome: 'Matrizes' },
  { tipo: 'dca', nome: 'DCA' },
];

export function Medidores() {
  return (
    <div className="tela-medidores">
      {GRUPOS.map((g) => (
        <section key={g.tipo} className={`grupo-medidores g-${g.tipo}`}>
          <h3>{g.nome}</h3>
          <div className="fileira">{lista(g.tipo).map((p) => <Coluna key={p} prefixo={p} />)}</div>
        </section>
      ))}
      <p className="dica legenda">Verde até −12 dB, amarelo até −3 dB, vermelho acima. A faixa laranja fina é a redução do compressor.</p>
    </div>
  );
}
