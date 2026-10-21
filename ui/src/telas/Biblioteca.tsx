// Biblioteca: shows (snapshots no formato do WING Edit, .snap), presets de
// canal e camadas personalizadas.

import { useRef, useState } from 'react';
import { def, definir, enviar, folhasDe, useGeral, useMensagem, valor, type Preset } from '../store';
import { useUi } from '../ui';
import { nomeDaTira, NOME_TIPO, partesDaTira } from '../util';
import { Icone } from '../comp/Icones';
import { ListaCamadas } from './Camadas';

function baixar(nome: string, texto: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function dataCurta(ms: number) {
  return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Shows() {
  const { geral } = useGeral();
  const arquivo = useRef<HTMLInputElement>(null);
  const [camadas, setCamadas] = useState(true);
  const [guardar, setGuardar] = useState(true);
  const [nome, setNome] = useState('');
  const [carga, setCarga] = useState<{ feito: number; total: number; nome: string } | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  useMensagem('carregando', (m) => setCarga(m.feito >= m.total ? null : m));
  useMensagem('snapErro', (m) => { setErro(m.erro); setCarga(null); });
  useMensagem('arquivo', (m) => baixar(m.nome, m.texto));
  const shows = geral?.shows || [];

  async function abrirArquivo(f: File) {
    setErro('');
    const texto = await f.text();
    const nomeShow = f.name.replace(/\.(snap|json)$/i, '');
    if (!confirm(`Abrir “${nomeShow}” na mesa? Tudo o que está na mesa agora (faders, nomes, EQ, envios, roteamento) será trocado pelo que está no arquivo.`)) return;
    setCarga({ feito: 0, total: 1, nome: nomeShow });
    enviar({ t: 'abrirSnap', texto, nome: nomeShow, camadas, guardarComo: guardar ? nomeShow : undefined });
  }

  return (
    <section className="secao larga">
      <h2>Shows</h2>
      <p className="dica">O Asa Edit abre e salva arquivos <strong>.snap</strong>, o mesmo formato do WING Edit. Abrir um show escreve tudo dele na mesa.</p>
      <div className="linha-info">
        <button className="primario com-icone" onClick={() => arquivo.current?.click()}><Icone nome="abrir" tamanho={1.1} />Abrir arquivo .snap…</button>
        <input ref={arquivo} type="file" accept=".snap,.json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) abrirArquivo(f); e.target.value = ''; }} />
        <label className="caixa"><input type="checkbox" checked={camadas} onChange={(e) => setCamadas(e.target.checked)} /> Trazer as camadas da Compact</label>
        <label className="caixa"><input type="checkbox" checked={guardar} onChange={(e) => setGuardar(e.target.checked)} /> Guardar uma cópia no Mac</label>
      </div>
      {carga && (
        <div className="estado">
          <p>Escrevendo “{carga.nome}” na mesa… {Math.round((carga.feito / carga.total) * 100)}%</p>
          <div className="barra-progresso"><div style={{ width: `${(carga.feito / carga.total) * 100}%` }} /></div>
        </div>
      )}
      {erro && <p className="erro">{erro}</p>}
      <form className="linha-info salvar-show" onSubmit={(e) => {
        e.preventDefault();
        const n = nome.trim();
        if (!n) return;
        if (shows.some((s) => s.nome === n) && !confirm(`Já existe um show “${n}”. Substituir?`)) return;
        enviar({ t: 'salvarSnap', guardarComo: n });
        setAviso(`“${n}” salvo no Mac.`);
        setTimeout(() => setAviso(''), 3000);
        setNome('');
      }}>
        <input aria-label="Nome do show" placeholder="Nome (ex.: Culto domingo)" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} />
        <button type="submit" className="com-icone" disabled={!nome.trim()}><Icone nome="salvar" tamanho={1} />Salvar o estado atual</button>
        <button type="button" className="com-icone" onClick={() => enviar({ t: 'salvarSnap', baixar: true, nome: nome.trim() || 'Asa Edit' })}><Icone nome="baixar" tamanho={1} />Baixar .snap</button>
        {aviso && <span className="ok-txt"><Icone nome="check" tamanho={1} /> {aviso}</span>}
      </form>
      <div className="lista-shows">
        {shows.map((s) => (
          <div key={s.nome} className="linha-camada">
            <strong>{s.nome}</strong>
            <span className="dica">{dataCurta(s.data)}</span>
            <span className="acoes-linha">
              <button onClick={() => { if (confirm(`Abrir “${s.nome}” na mesa? O estado atual da mesa será trocado.`)) { setCarga({ feito: 0, total: 1, nome: s.nome }); enviar({ t: 'abrirShow', nome: s.nome, camadas }); } }}>Abrir na mesa</button>
              <button className="icone-so" aria-label={`Baixar ${s.nome}`} title="Baixar .snap" onClick={() => enviar({ t: 'baixarShow', nome: s.nome })}><Icone nome="baixar" tamanho={1} /></button>
              <button className="icone-so" aria-label={`Apagar ${s.nome}`} title="Apagar" onClick={() => { if (confirm(`Apagar o show “${s.nome}” do Mac?`)) enviar({ t: 'apagarShow', nome: s.nome }); }}><Icone nome="lixo" tamanho={1} /></button>
            </span>
          </div>
        ))}
        {!shows.length && <p className="dica">Nenhum show guardado no Mac ainda.</p>}
      </div>
      <p className="dica">As cenas guardadas dentro da própria mesa ainda não aparecem aqui (falta confirmar como acioná-las pela rede).</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Presets de canal
// ---------------------------------------------------------------------------
const BLOCOS = [
  { id: 'eq', nome: 'EQ', partes: ['/eq', '/peq'] },
  { id: 'din', nome: 'Gate e comp', partes: ['/gate', '/gatesc', '/dyn', '/dynsc', '/dynxo'] },
  { id: 'flt', nome: 'Filtros', partes: ['/flt'] },
  { id: 'ins', nome: 'Inserts e ordem', partes: ['/preins', '/postins', '/proc'] },
  { id: 'nome', nome: 'Nome e cor', partes: ['/name', '/col', '/icon'] },
];

/** Valores de um bloco relativos ao prefixo, so do modelo atual. */
function valoresDoBloco(prefixo: string, parte: string): [string, number | string][] {
  const base = prefixo + parte;
  const d = def(base);
  const folhas = d && d.tipo !== 0 ? [d] : folhasDe(base);
  const out: [string, number | string][] = [];
  for (const f of folhas) {
    if (f.caminho.includes('/$')) continue;
    // /ch/1/eq/SOUL/lf: so entra se SOUL for o modelo atual do bloco.
    const resto = f.caminho.slice(base.length).split('/').filter(Boolean);
    if (resto.length >= 2) {
      const mdl = valor(`${base}/mdl`);
      const ehModelo = def(`${base}/mdl`)?.itens?.some((i) => String(i[0]) === resto[0]);
      if (ehModelo && resto[0] !== mdl) continue;
    }
    const v = valor(f.caminho);
    if (v !== undefined) out.push([f.caminho.slice(prefixo.length), v]);
  }
  return out;
}

function Presets() {
  const { geral } = useGeral();
  const sel = useUi('selecionado');
  const presets = geral?.config.presets || [];
  const [nome, setNome] = useState('');
  const [blocos, setBlocos] = useState<string[]>(['eq', 'din', 'flt']);
  const { tipo } = partesDaTira(sel);
  const nomeSel = nomeDaTira(sel);
  const [aplicado, setAplicado] = useState('');
  const gravar = (l: Preset[]) => enviar({ t: 'presets', lista: l });
  return (
    <section className="secao larga">
      <h2>Presets de canal</h2>
      <p className="dica">Guarde o EQ, a dinâmica e os filtros de um canal (ex.: “Voz pastor”) e aplique em outro. Vale para a tira selecionada no mixer: <strong>{NOME_TIPO[tipo]} {partesDaTira(sel).n} · {nomeSel}</strong>.</p>
      <div className="linha-info">
        {BLOCOS.map((b) => (
          <label key={b.id} className="caixa"><input type="checkbox" checked={blocos.includes(b.id)} onChange={() => setBlocos(blocos.includes(b.id) ? blocos.filter((x) => x !== b.id) : [...blocos, b.id])} /> {b.nome}</label>
        ))}
      </div>
      <form className="linha-info salvar-show" onSubmit={(e) => {
        e.preventDefault();
        const n = nome.trim() || nomeSel;
        const valores = BLOCOS.filter((b) => blocos.includes(b.id)).flatMap((b) => b.partes.flatMap((p) => valoresDoBloco(sel, p)));
        if (!valores.length) return;
        gravar([...presets.filter((p) => p.nome !== n), { nome: n, tipo, valores }]);
        setNome('');
      }}>
        <input aria-label="Nome do preset" placeholder={`Nome (ex.: ${nomeSel})`} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} />
        <button type="submit" className="com-icone" disabled={!blocos.length}><Icone nome="salvar" tamanho={1} />Guardar preset de “{nomeSel}”</button>
      </form>
      <div className="lista-shows">
        {presets.map((p, i) => (
          <div key={p.nome + i} className="linha-camada">
            <strong>{p.nome}</strong>
            <span className="dica">{NOME_TIPO[p.tipo as keyof typeof NOME_TIPO] || p.tipo} · {p.valores.length} ajustes</span>
            <span className="acoes-linha">
              <button onClick={() => {
                for (const [rel, v] of p.valores) if (def(sel + rel)) definir(sel + rel, v);
                setAplicado(p.nome);
                setTimeout(() => setAplicado(''), 2500);
              }}>{aplicado === p.nome ? 'Aplicado!' : `Aplicar em ${nomeSel}`}</button>
              <button className="icone-so" aria-label={`Apagar ${p.nome}`} onClick={() => { if (confirm(`Apagar o preset “${p.nome}”?`)) gravar(presets.filter((_, k) => k !== i)); }}><Icone nome="lixo" tamanho={1} /></button>
            </span>
          </div>
        ))}
        {!presets.length && <p className="dica">Nenhum preset ainda.</p>}
      </div>
    </section>
  );
}

export function Biblioteca() {
  return (
    <div className="tela-form">
      <h1>Biblioteca</h1>
      <Shows />
      <Presets />
      <section className="secao larga">
        <h2>Camadas do mixer</h2>
        <ListaCamadas />
      </section>
    </div>
  );
}
